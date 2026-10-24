package com.kinloop.app

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
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

            audioRecord = createBestAudioRecord()
            if (audioRecord == null) {
                createdStream.release()
                call.reject("audio-record-unavailable")
                return
            }

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

    private fun createBestAudioRecord(): AudioRecord? {
        val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
        if (minBufferSize <= 0) {
            Log.w(TAG, "Unable to resolve min buffer size: $minBufferSize")
            return null
        }

        val bufferSize = minBufferSize * 2
        val audioSources = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                add(MediaRecorder.AudioSource.UNPROCESSED)
            }
            add(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            add(MediaRecorder.AudioSource.MIC)
            add(MediaRecorder.AudioSource.DEFAULT)
        }.distinct()

        for (source in audioSources) {
            try {
                val candidate = AudioRecord(
                    source,
                    sampleRate,
                    channelConfig,
                    audioFormat,
                    bufferSize,
                )

                if (candidate.state == AudioRecord.STATE_INITIALIZED) {
                    try {
                        candidate.preferredDevice = null
                    } catch (_: Throwable) {
                    }
                    try {
                        candidate.setPreferredMicrophoneDirection(AudioRecord.MIC_DIRECTION_TOWARDS_USER)
                    } catch (_: Throwable) {
                    }
                    Log.i(TAG, "Using audio source: ${describeAudioSource(source)}")
                    return candidate
                }

                Log.w(TAG, "Audio source not initialized: ${describeAudioSource(source)}")
                candidate.release()
            } catch (error: Throwable) {
                Log.w(TAG, "Audio source failed: ${describeAudioSource(source)}", error)
            }
        }

        return null
    }

    private fun describeAudioSource(source: Int): String {
        return when (source) {
            MediaRecorder.AudioSource.UNPROCESSED -> "UNPROCESSED"
            MediaRecorder.AudioSource.VOICE_RECOGNITION -> "VOICE_RECOGNITION"
            MediaRecorder.AudioSource.MIC -> "MIC"
            MediaRecorder.AudioSource.DEFAULT -> "DEFAULT"
            MediaRecorder.AudioSource.CAMCORDER -> "CAMCORDER"
            MediaRecorder.AudioSource.VOICE_COMMUNICATION -> "VOICE_COMMUNICATION"
            else -> source.toString()
        }
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
        private val DEFAULT_KEYWORD_SPEC = """
            x iǎo zh ì x iǎo zh ì @小智小智
            x iǎo zh ì t óng x ué @小智同学
            x iǎo zh ì @小智
            x iǎo zh ī t óng x ué @小知同学
            x iǎo zh ī x iǎo zh ī @小知小知
            x iǎo zh ī @小知
            x iǎo zh ì t óng x ué @小志同学
            x iǎo zh ì x iǎo zh ì @小志小志
            x iǎo zh ì @小志
            x iǎo zh ì t óng x ué @晓智同学
            x iǎo zh ì x iǎo zh ì @晓智晓智
            x iǎo zh ì @晓智
            x iǎo zh ì x iǎo zh ì @小智小志
            x iǎo zh ì x iǎo zh ì @小志小智
        """.trimIndent()
    }
}
