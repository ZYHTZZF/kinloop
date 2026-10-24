package com.kinloop.app

import android.content.res.AssetManager

data class FeatureConfig(
    var sampleRate: Int = 16000,
    var featureDim: Int = 80,
)

data class OnlineTransducerModelConfig(
    var encoder: String = "",
    var decoder: String = "",
    var joiner: String = "",
)

data class OnlineParaformerModelConfig(
    var encoder: String = "",
    var decoder: String = "",
)

data class OnlineZipformer2CtcModelConfig(
    var model: String = "",
)

data class OnlineNeMoCtcModelConfig(
    var model: String = "",
)

data class OnlineToneCtcModelConfig(
    var model: String = "",
)

data class OnlineModelConfig(
    var transducer: OnlineTransducerModelConfig = OnlineTransducerModelConfig(),
    var paraformer: OnlineParaformerModelConfig = OnlineParaformerModelConfig(),
    var zipformer2Ctc: OnlineZipformer2CtcModelConfig = OnlineZipformer2CtcModelConfig(),
    var neMoCtc: OnlineNeMoCtcModelConfig = OnlineNeMoCtcModelConfig(),
    var toneCtc: OnlineToneCtcModelConfig = OnlineToneCtcModelConfig(),
    var tokens: String = "",
    var numThreads: Int = 1,
    var debug: Boolean = false,
    var provider: String = "cpu",
    var modelType: String = "",
    var modelingUnit: String = "",
    var bpeVocab: String = "",
)

data class KeywordSpotterConfig(
    var featConfig: FeatureConfig = FeatureConfig(),
    var modelConfig: OnlineModelConfig = OnlineModelConfig(),
    var maxActivePaths: Int = 4,
    var keywordsFile: String = "keywords.txt",
    var keywordsScore: Float = 1.5f,
    var keywordsThreshold: Float = 0.25f,
    var numTrailingBlanks: Int = 2,
)

data class KeywordSpotterResult(
    val keyword: String,
    val tokens: Array<String>,
    val timestamps: FloatArray,
)

class OnlineStream(var ptr: Long = 0) {
    fun acceptWaveform(samples: FloatArray, sampleRate: Int) =
        acceptWaveform(ptr, samples, sampleRate)

    fun release() {
        if (ptr != 0L) {
            delete(ptr)
            ptr = 0
        }
    }

    private external fun acceptWaveform(ptr: Long, samples: FloatArray, sampleRate: Int)
    private external fun delete(ptr: Long)

    companion object {
        init {
            System.loadLibrary("sherpa-onnx-jni")
        }
    }
}

class KeywordSpotter(
    assetManager: AssetManager,
    private val config: KeywordSpotterConfig,
) {
    private var ptr: Long = newFromAsset(assetManager, config)

    fun createStream(keywords: String = ""): OnlineStream {
        return OnlineStream(createStream(ptr, keywords))
    }

    fun decode(stream: OnlineStream) = decode(ptr, stream.ptr)
    fun reset(stream: OnlineStream) = reset(ptr, stream.ptr)
    fun isReady(stream: OnlineStream) = isReady(ptr, stream.ptr)
    fun getResult(stream: OnlineStream): KeywordSpotterResult = getResult(ptr, stream.ptr)

    fun release() {
        if (ptr != 0L) {
            delete(ptr)
            ptr = 0
        }
    }

    private external fun delete(ptr: Long)
    private external fun newFromAsset(assetManager: AssetManager, config: KeywordSpotterConfig): Long
    private external fun createStream(ptr: Long, keywords: String): Long
    private external fun isReady(ptr: Long, streamPtr: Long): Boolean
    private external fun decode(ptr: Long, streamPtr: Long)
    private external fun reset(ptr: Long, streamPtr: Long)
    private external fun getResult(ptr: Long, streamPtr: Long): KeywordSpotterResult

    companion object {
        init {
            System.loadLibrary("sherpa-onnx-jni")
        }
    }
}

fun createKinloopKwsConfig(): KeywordSpotterConfig {
    val modelDir = "sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01"
    return KeywordSpotterConfig(
        featConfig = FeatureConfig(sampleRate = 16000, featureDim = 80),
        modelConfig = OnlineModelConfig(
            transducer = OnlineTransducerModelConfig(
                encoder = "$modelDir/encoder-epoch-12-avg-2-chunk-16-left-64.onnx",
                decoder = "$modelDir/decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
                joiner = "$modelDir/joiner-epoch-12-avg-2-chunk-16-left-64.onnx",
            ),
            tokens = "$modelDir/tokens.txt",
            numThreads = 2,
            modelType = "zipformer2",
        ),
        keywordsFile = "$modelDir/keywords.txt",
        keywordsScore = 1.0f,
        keywordsThreshold = 0.12f,
        numTrailingBlanks = 2,
    )
}
