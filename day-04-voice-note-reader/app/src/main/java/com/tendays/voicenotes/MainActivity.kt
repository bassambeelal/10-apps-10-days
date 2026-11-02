package com.tendays.voicenotes

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

sealed interface Ui {
    data object Idle : Ui
    data class Opening(val progress: Float) : Ui
    data class Reading(val text: String, val seconds: Int) : Ui
    data class Done(val text: String, val seconds: Int) : Ui
    data class Failed(val message: String, val download: Boolean = false, val online: Boolean = false, val permission: Boolean = false) : Ui
}

class MainActivity : ComponentActivity() {

    private var ui by mutableStateOf<Ui>(Ui.Idle)
    private var language by mutableStateOf(Locale.getDefault().toLanguageTag())
    private var pcm: ShortArray? = null
    private var transcriber: Transcriber? = null
    private var pendingOnline = false

    private val pick = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> if (uri != null) open(uri) }
    private val askMic = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) read(online = pendingOnline)
        else ui = Ui.Failed("Android only lets apps use its speech recognizer with the microphone permission. Voice Note Reader never records anything; it only reads the file you share.", permission = true)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handle(intent)
        setContent {
            VoiceNotesTheme {
                VoiceNotesScreen(
                    ui = ui,
                    language = language,
                    offlineReady = Transcriber.available(this),
                    onPick = { pick.launch(arrayOf("audio/*", "application/ogg")) },
                    onLanguage = { language = it; if (pcm != null) read(online = false) },
                    onRetry = { read(online = false) },
                    onOnline = { read(online = true) },
                    onDownload = ::downloadLanguage,
                    onPermission = { askMic.launch(Manifest.permission.RECORD_AUDIO) },
                    onCopy = ::copy,
                    onShare = ::share,
                    onReset = { transcriber?.release(); pcm = null; ui = Ui.Idle },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    private fun handle(intent: Intent?) {
        if (intent?.action != Intent.ACTION_SEND) return
        val uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) ?: return
        open(uri)
    }

    private fun open(uri: Uri) {
        transcriber?.release()
        ui = Ui.Opening(0f)
        lifecycleScope.launch {
            val decoded = withContext(Dispatchers.Default) {
                runCatching { AudioDecoder.decode(this@MainActivity, uri) { p -> lifecycleScope.launch { if (ui is Ui.Opening) ui = Ui.Opening(p) } } }
            }
            decoded.onSuccess { pcm = it; read(online = false) }
                .onFailure { ui = Ui.Failed(if (it is AudioDecoder.Unsupported) it.message!! else "This file couldn't be opened. Share the voice note again, or try another file.") }
        }
    }

    private fun read(online: Boolean) {
        val audio = pcm ?: return
        if (Build.VERSION.SDK_INT < 33) {
            ui = Ui.Failed("Reading a voice note from a file needs Android 13 or newer. This phone runs Android ${Build.VERSION.RELEASE}.")
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingOnline = online
            askMic.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        if (!online && !Transcriber.available(this)) {
            ui = Ui.Failed(
                "This phone doesn't have offline speech recognition. It comes with Google's speech services on most Android 13+ phones; check for updates to \"Speech Services by Google\" in the Play Store.",
                online = SpeechRecognizer.isRecognitionAvailable(this),
            )
            return
        }
        val seconds = audio.size / AudioDecoder.RATE
        transcriber?.release()
        ui = Ui.Reading("", seconds)
        transcriber = Transcriber(
            this,
            onText = { text -> ui = Ui.Reading(text, seconds) },
            onDone = { val t = (ui as? Ui.Reading)?.text.orEmpty(); ui = if (t.isBlank()) Ui.Failed(Transcriber.explain(SpeechRecognizer.ERROR_NO_MATCH)) else Ui.Done(t, seconds) },
            onError = { code ->
                ui = Ui.Failed(
                    Transcriber.explain(code),
                    download = code == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE,
                    online = !online && code in listOf(SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE),
                    permission = code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS,
                )
            },
        ).also { it.start(audio, language, onDevice = !online) }
    }

    private fun downloadLanguage() {
        if (Build.VERSION.SDK_INT < 33) return
        val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
        r.triggerModelDownload(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE, language))
        r.destroy()
        ui = Ui.Failed("The download has started in the background. When it finishes, tap Try again.")
    }

    private fun copy(text: String) {
        getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Voice note", text))
    }

    private fun share(text: String) {
        startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share the text"))
    }

    override fun onDestroy() {
        transcriber?.release()
        super.onDestroy()
    }
}
