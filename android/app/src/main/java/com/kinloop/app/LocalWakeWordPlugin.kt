package com.kinloop.app

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.Locale
import kotlin.concurrent.thread

@CapacitorPlugin(name = "LocalWakeWord")
class LocalWakeWordPlugin : Plugin() {
    private val sampleRate = 16000
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT

    @Volatile
    private var listening = false

    private var audioRecord: AudioRecord? = null
    private var keywordSpotter: KeywordSpotter? = null
    private var stream: OnlineStream? = null
    private var recordingThread: Thread? = null
    private var textToSpeech: TextToSpeech? = null
    private var textToSpeechReady = false

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", true)
        call.resolve(result)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("microphone-permission-denied")
            return
        }

        if (listening) {
            call.resolve(statusPayload("listening"))
            return
        }

        val keywordSpec = call.getString("keywordSpec", DEFAULT_KEYWORD_SPEC) ?: DEFAULT_KEYWORD_SPEC

        try {
            val spotter = keywordSpotter ?: KeywordSpotter(context.assets, createKinloopKwsConfig()).also {
                keywordSpotter = it
            }
            val createdStream = spotter.createStream(keywordSpec)
            if (createdStream.ptr == 0L) {
                call.reject("keyword-stream-unavailable")
                return
            }

            val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                sampleRate,
                channelConfig,
                audioFormat,
                minBufferSize * 2,
            )

            stream = createdStream
            listening = true
            audioRecord?.startRecording()
            notifyStatus("listening")

            recordingThread = thread(start = true, name = "kinloop-local-wake-word") {
                processSamples(spotter, createdStream)
            }

            call.resolve(statusPayload("listening"))
        } catch (error: Throwable) {
            Log.e(TAG, "Failed to start local wake word", error)
            stopListening()
            call.reject("local-wake-word-start-failed", error.message ?: "unknown")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        stopListening()
        call.resolve(statusPayload("stopped"))
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        val text = call.getString("text", "\u6211\u5728") ?: "\u6211\u5728"
        speakNative(text)
        call.resolve(statusPayload("speaking"))
    }

    override fun handleOnDestroy() {
        stopListening()
        keywordSpotter?.release()
        keywordSpotter = null
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        super.handleOnDestroy()
    }

    private fun processSamples(spotter: KeywordSpotter, activeStream: OnlineStream) {
        val buffer = ShortArray((sampleRate * 0.1).toInt())

        try {
            while (listening) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                if (read <= 0) continue

                val samples = FloatArray(read) { index -> buffer[index] / 32768.0f }
                activeStream.acceptWaveform(samples, sampleRate)

                while (listening && spotter.isReady(activeStream)) {
                    spotter.decode(activeStream)
                    val keyword = spotter.getResult(activeStream).keyword.trim()

                    if (keyword.isNotEmpty()) {
                        spotter.reset(activeStream)
                        val payload = JSObject()
                        payload.put("keyword", keyword)
                        notifyListeners("wakeWordDetected", payload)
                        stopListening()
                        return
                    }
                }
            }
        } catch (error: Throwable) {
            Log.e(TAG, "Local wake word loop failed", error)
            notifyStatus("error")
        } finally {
            releaseAudio()
        }
    }

    private fun stopListening() {
        listening = false
        releaseAudio()
        stream?.release()
        stream = null
        recordingThread = null
        notifyStatus("stopped")
    }

    private fun releaseAudio() {
        try {
            audioRecord?.stop()
        } catch (_: Throwable) {
        }
        audioRecord?.release()
        audioRecord = null
    }

    private fun notifyStatus(status: String) {
        notifyListeners("wakeWordStatus", statusPayload(status))
    }

    private fun speakNative(text: String) {
        val currentTextToSpeech = textToSpeech
        if (currentTextToSpeech != null && textToSpeechReady) {
            currentTextToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kinloop-wake-reply")
            return
        }

        textToSpeech = TextToSpeech(context) { status ->
            textToSpeechReady = status == TextToSpeech.SUCCESS
            if (textToSpeechReady) {
                textToSpeech?.language = Locale.CHINESE
                textToSpeech?.setSpeechRate(1.0f)
                textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kinloop-wake-reply")
            }
        }
    }

    private fun statusPayload(status: String): JSObject {
        val payload = JSObject()
        payload.put("status", status)
        return payload
    }

    companion object {
        private const val TAG = "LocalWakeWord"
        private const val DEFAULT_KEYWORD_SPEC = "x i\u01ceo zh \u00ec x i\u01ceo zh \u00ec @\u5c0f\u667a\u5c0f\u667a"
    }
}
