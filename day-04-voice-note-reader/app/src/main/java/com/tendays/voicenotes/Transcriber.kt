package com.tendays.voicenotes

import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.annotation.RequiresApi
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread

/**
 * Feeds decoded audio to Android's speech recognizer through a pipe instead of the microphone (Android 13+).
 * With onDevice = true the audio never leaves the phone.
 */
@RequiresApi(33)
class Transcriber(
    private val context: Context,
    private val onText: (String) -> Unit,
    private val onDone: () -> Unit,
    private val onError: (Int) -> Unit,
) {
    private var recognizer: SpeechRecognizer? = null
    private val segments = StringBuilder()

    fun start(pcm: ShortArray, language: String, onDevice: Boolean) {
        val rec = if (onDevice) SpeechRecognizer.createOnDeviceSpeechRecognizer(context) else SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = rec
        val (read, write) = ParcelFileDescriptor.createPipe()
        rec.setRecognitionListener(object : RecognitionListener {
            override fun onSegmentResults(segmentResults: Bundle) = add(segmentResults)
            override fun onResults(results: Bundle) { add(results); finish() }
            override fun onEndOfSegmentedSession() = finish()
            override fun onPartialResults(partialResults: Bundle) {
                val partial = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                if (partial.isNotBlank()) onText(join(segments.toString(), partial))
            }
            override fun onError(error: Int) {
                // Running out of audio after some text is a normal ending, not a failure.
                if (segments.isNotEmpty() && (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) finish()
                else { release(); onError(error) }
            }
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })
        rec.startListening(intent(language, read))
        thread(name = "voice-note-feed") {
            ParcelFileDescriptor.AutoCloseOutputStream(write).use { out ->
                val chunk = ByteBuffer.allocate(8192).order(ByteOrder.LITTLE_ENDIAN)
                var i = 0
                while (i < pcm.size) {
                    chunk.clear()
                    while (chunk.remaining() >= 2 && i < pcm.size) chunk.putShort(pcm[i++])
                    runCatching { out.write(chunk.array(), 0, chunk.position()) }.onFailure { return@thread }
                }
            }
        }
    }

    private fun intent(language: String, source: ParcelFileDescriptor) = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, source)
        putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
        putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
        putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, AudioDecoder.RATE)
        putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION, RecognizerIntent.EXTRA_AUDIO_SOURCE)
    }

    private fun add(b: Bundle) {
        val text = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty().trim()
        if (text.isNotEmpty()) {
            segments.replace(0, segments.length, join(segments.toString(), text))
            onText(segments.toString())
        }
    }

    private var finished = false
    private fun finish() {
        if (finished) return
        finished = true
        release()
        onDone()
    }

    fun release() {
        recognizer?.destroy()
        recognizer = null
    }

    companion object {
        fun join(a: String, b: String): String = when {
            a.isBlank() -> sentence(b)
            b.isBlank() -> a
            else -> "$a ${sentence(b)}"
        }

        private fun sentence(s: String) = s.trim().replaceFirstChar { it.uppercase() }.let { if (it.last() in ".?!") it else "$it." }

        fun available(context: Context): Boolean = Build.VERSION.SDK_INT >= 33 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)

        fun explain(error: Int): String = when (error) {
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> "Offline recognition doesn't support this language on your phone. Try another language below."
            SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "The offline speech pack for this language isn't on your phone yet. Download it, then try again."
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Android needs the microphone permission for speech recognition, even though this app never uses the microphone."
            SpeechRecognizer.ERROR_NO_MATCH -> "No words were recognised. The note may be music, silence or a language the phone can't read."
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "The speech recognizer is busy. Close other apps using it and try again."
            SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER -> "Online recognition couldn't reach the internet."
            SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> "Too many requests. Wait a minute and try again."
            else -> "Speech recognition stopped (error $error). Try again."
        }
    }
}
