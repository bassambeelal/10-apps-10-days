package com.tendays.voicenotes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.util.Locale

private fun len(s: Int) = "%d:%02d".format(s / 60, s % 60)

private val LANGUAGES = listOf("en-NG" to "English (Nigeria)", "en-GB" to "English (UK)", "en-US" to "English (US)", "fr-FR" to "French")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoiceNotesScreen(
    ui: Ui,
    language: String,
    offlineReady: Boolean,
    onPick: () -> Unit,
    onLanguage: (String) -> Unit,
    onRetry: () -> Unit,
    onOnline: () -> Unit,
    onDownload: () -> Unit,
    onPermission: () -> Unit,
    onCopy: (String) -> Unit,
    onShare: (String) -> Unit,
    onReset: () -> Unit,
) {
    Scaffold(topBar = { TopAppBar(title = { Text("Voice Note Reader") }) }) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            when (ui) {
                Ui.Idle -> Intro(offlineReady, onPick)
                is Ui.Opening -> {
                    Text("Opening the voice note", style = MaterialTheme.typography.titleLarge)
                    LinearProgressIndicator(progress = { ui.progress }, modifier = Modifier.fillMaxWidth())
                }
                is Ui.Reading -> Transcript(ui.text.ifBlank { "Listening to the note…" }, "Reading a ${len(ui.seconds)} voice note", live = true)
                is Ui.Done -> {
                    Transcript(ui.text, "${len(ui.seconds)} voice note, read on this phone", live = false)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { onCopy(ui.text) }, modifier = Modifier.heightIn(min = 48.dp)) { Text("Copy text") }
                        OutlinedButton(onClick = { onShare(ui.text) }, modifier = Modifier.heightIn(min = 48.dp)) { Text("Share") }
                        TextButton(onClick = onReset, modifier = Modifier.heightIn(min = 48.dp)) { Text("Done") }
                    }
                    Languages(language, onLanguage, "Wrong language? Read it again in:")
                }
                is Ui.Failed -> {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                        Text(ui.message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(16.dp))
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (ui.permission) Button(onClick = onPermission, modifier = Modifier.heightIn(min = 48.dp)) { Text("Allow and read") }
                        if (ui.download) Button(onClick = onDownload, modifier = Modifier.heightIn(min = 48.dp)) { Text("Download offline speech") }
                        OutlinedButton(onClick = onRetry, modifier = Modifier.heightIn(min = 48.dp)) { Text("Try again") }
                        if (ui.online) TextButton(onClick = onOnline, modifier = Modifier.heightIn(min = 48.dp)) { Text("Use Google's online recognition") }
                        TextButton(onClick = onReset, modifier = Modifier.heightIn(min = 48.dp)) { Text("Start over") }
                    }
                    if (ui.online) Text("Online recognition sends the audio to Google. Only use it for notes you're happy to send.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Languages(language, onLanguage, "Or read it in another language:")
                }
            }
        }
    }
}

@Composable
private fun Intro(offlineReady: Boolean, onPick: () -> Unit) {
    Text("Read a voice note without playing it", style = MaterialTheme.typography.headlineSmall)
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("In WhatsApp or Telegram, press and hold the voice note, tap Share, and choose Voice Note Reader.", style = MaterialTheme.typography.bodyLarge)
            Text("The words are worked out on this phone. The audio isn't uploaded anywhere.", style = MaterialTheme.typography.bodyMedium)
        }
    }
    if (!offlineReady) {
        Text(
            "This phone doesn't report offline speech recognition yet. It needs Android 13 or newer with Google's speech services, so reading may not work here.",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error,
        )
    }
    OutlinedButton(onClick = onPick, modifier = Modifier.heightIn(min = 48.dp)) { Text("Open an audio file instead") }
}

@Composable
private fun Transcript(text: String, caption: String, live: Boolean) {
    Text(caption, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (live) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
    SelectionContainer {
        Text(
            text,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun Languages(language: String, onLanguage: (String) -> Unit, label: String) {
    val device = Locale.getDefault().toLanguageTag()
    val options = (listOf(device to "Phone's language") + LANGUAGES.filter { it.first != device })
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { (tag, name) ->
                FilterChip(selected = language == tag, onClick = { onLanguage(tag) }, label = { Text(name) }, modifier = Modifier.heightIn(min = 48.dp))
            }
        }
    }
}
