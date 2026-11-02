package com.tendays.lettersorter

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.core.content.IntentCompat
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

private val dayFmt = DateTimeFormatter.ofPattern("EEE d MMM")

data class Item(val id: Long, val pile: Pile, val due: LocalDate?, val amount: String?, val from: String?, val added: LocalDate, val done: Boolean = false) {
    fun json(): JSONObject = JSONObject().put("id", id).put("pile", pile.name).put("due", due?.toString() ?: JSONObject.NULL)
        .put("amount", amount ?: JSONObject.NULL).put("from", from ?: JSONObject.NULL).put("added", added.toString()).put("done", done)
    companion object {
        fun of(o: JSONObject) = Item(
            o.getLong("id"), Pile.valueOf(o.getString("pile")),
            if (o.isNull("due")) null else LocalDate.parse(o.getString("due")),
            if (o.isNull("amount")) null else o.getString("amount"),
            if (o.isNull("from")) null else o.getString("from"),
            LocalDate.parse(o.getString("added")), o.optBoolean("done"),
        )
    }
}

sealed interface Ui {
    data object Home : Ui
    data object Reading : Ui
    data class Result(val reading: com.tendays.lettersorter.Reading, val pile: Pile) : Ui
}

class MainActivity : ComponentActivity() {
    private var items by mutableStateOf(emptyList<Item>())
    private var ui by mutableStateOf<Ui>(Ui.Home)
    private var photo: File? = null

    private val camera = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok -> photo?.let { f -> if (ok) read(FileProvider.getUriForFile(this, "$packageName.files", f)) } }
    private val gallery = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> uri?.let(::read) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        items = load()
        intent?.let(::handle)
        setContent { SorterTheme { App() } }
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handle(intent) }

    private fun handle(i: Intent) {
        if (i.action == Intent.ACTION_SEND) IntentCompat.getParcelableExtra(i, Intent.EXTRA_STREAM, Uri::class.java)?.let(::read)
    }

    private fun load(): List<Item> = getSharedPreferences("letters", Context.MODE_PRIVATE).getString("items", null)
        ?.let { s -> JSONArray(s).let { a -> (0 until a.length()).mapNotNull { runCatching { Item.of(a.getJSONObject(it)) }.getOrNull() } } } ?: emptyList()

    private fun save(list: List<Item>) {
        items = list
        getSharedPreferences("letters", Context.MODE_PRIVATE).edit().putString("items", JSONArray(list.map { it.json() }).toString()).apply()
    }

    private fun shoot() {
        val f = File(filesDir, "packs/letter.jpg").apply { parentFile?.mkdirs() }
        photo = f
        try { camera.launch(FileProvider.getUriForFile(this, "$packageName.files", f)) } catch (e: ActivityNotFoundException) { Toast.makeText(this, "No camera app found.", Toast.LENGTH_LONG).show() }
    }

    /** On-device text recognition; the photo is read and then forgotten. */
    private fun read(uri: Uri) {
        ui = Ui.Reading
        val image = runCatching { InputImage.fromFilePath(this, uri) }.getOrElse { ui = Ui.Home; Toast.makeText(this, "That image couldn't be opened.", Toast.LENGTH_LONG).show(); return }
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).process(image)
            .addOnSuccessListener { text ->
                if (text.text.isBlank()) { ui = Ui.Home; Toast.makeText(this, "No writing found. Take the photo straight on, in good light.", Toast.LENGTH_LONG).show() }
                else LetterReader.read(text.text, LocalDate.now()).let { ui = Ui.Result(it, it.pile) }
            }
            .addOnFailureListener { ui = Ui.Home; Toast.makeText(this, "Reading failed: ${it.message}", Toast.LENGTH_LONG).show() }
            .addOnCompleteListener { photo?.delete() }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun App() {
        Scaffold(topBar = { TopAppBar(title = { Text("Letter Sorter") }) }) { pad ->
            LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = pad.calculateTopPadding() + 8.dp, bottom = pad.calculateBottomPadding() + 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                when (val s = ui) {
                    Ui.Reading -> item {
                        Text("Reading it…", style = MaterialTheme.typography.titleLarge)
                        LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 12.dp))
                    }
                    is Ui.Result -> item { ResultCard(s) }
                    Ui.Home -> item { Start() }
                }
                val today = LocalDate.now()
                val todo = items.filter { it.pile == Pile.ACT && !it.done }.sortedBy { it.due ?: LocalDate.MAX }
                if (ui == Ui.Home) item { Summary(today) }
                if (todo.isNotEmpty()) {
                    item { Text("To do", style = MaterialTheme.typography.titleMedium) }
                    items(todo, key = { it.id }) { t -> TodoRow(t, today) }
                }
            }
        }
    }

    @Composable
    private fun Start() {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("One letter at a time", style = MaterialTheme.typography.headlineSmall)
            Text("Photograph a letter or bill, or pick a screenshot of one. Letter Sorter reads it on this phone and tells you one thing: do it by a date, file it, or bin it.", style = MaterialTheme.typography.bodyLarge)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = ::shoot, modifier = Modifier.heightIn(min = 52.dp)) { Text("Photograph a letter") }
                OutlinedButton(onClick = { gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, modifier = Modifier.heightIn(min = 52.dp)) { Text("Pick a screenshot") }
            }
        }
    }

    @Composable
    private fun Summary(today: LocalDate) {
        val sorted = items.filter { it.added == today }
        if (sorted.isEmpty()) return
        val act = sorted.count { it.pile == Pile.ACT }; val filed = sorted.count { it.pile == Pile.FILE }; val binned = sorted.count { it.pile == Pile.BIN }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
            Column(Modifier.padding(16.dp)) {
                Text("Today you sorted ${sorted.size} ${if (sorted.size == 1) "letter" else "letters"}.", style = MaterialTheme.typography.titleMedium)
                Text(listOfNotNull(act.takeIf { it > 0 }?.let { "$it to do" }, filed.takeIf { it > 0 }?.let { "$it filed" }, binned.takeIf { it > 0 }?.let { "$it binned" }).joinToString(", ") + ". That's the hard part done.", style = MaterialTheme.typography.bodyLarge)
            }
        }
    }

    @Composable
    private fun ResultCard(s: Ui.Result) {
        val r = s.reading
        val headline = when (s.pile) {
            Pile.ACT -> r.due?.let { "Do this by ${it.format(dayFmt)}" } ?: "Do this soon"
            Pile.FILE -> "File it"
            Pile.BIN -> "Bin it"
            Pile.LOOK -> "Have a look"
        }
        Card(colors = CardDefaults.cardColors(containerColor = if (s.pile == Pile.ACT) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.surfaceContainerLow)) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                r.from?.let { Text(it, style = MaterialTheme.typography.labelLarge) }
                Text(headline, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                if (s.pile == Pile.ACT && r.amount != null) Text("Amount: ${r.amount}", style = MaterialTheme.typography.titleMedium)
                r.why.forEach { Text("· $it", style = MaterialTheme.typography.bodyMedium) }
                if (r.lines.isNotEmpty()) {
                    Text("The lines that decided it", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp))
                    r.lines.forEach { Text(it, style = MaterialTheme.typography.bodySmall) }
                }
                Text("Not right? Choose the pile yourself:", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(Pile.ACT, Pile.FILE, Pile.BIN).forEach { p -> FilterChip(selected = s.pile == p, onClick = { ui = s.copy(pile = p) }, label = { Text(p.title) }, modifier = Modifier.heightIn(min = 48.dp)) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = {
                        val pile = if (s.pile == Pile.LOOK) Pile.FILE else s.pile
                        save(items + Item(System.currentTimeMillis(), pile, r.due, r.amount, r.from, LocalDate.now()))
                        ui = Ui.Home
                    }, modifier = Modifier.heightIn(min = 52.dp)) { Text(if (s.pile == Pile.ACT) "Add to my to-do" else "Done, next letter") }
                    TextButton(onClick = { ui = Ui.Home }) { Text("Cancel") }
                }
            }
        }
    }

    @Composable
    private fun TodoRow(t: Item, today: LocalDate) {
        val days = t.due?.let { ChronoUnit.DAYS.between(today, it) }
        Card(Modifier.fillMaxWidth()) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(t.from ?: "A letter", style = MaterialTheme.typography.titleMedium)
                    Text(
                        listOfNotNull(
                            t.amount,
                            when { days == null -> "no date found"; days < 0 -> "${-days} days late"; days == 0L -> "due today"; days == 1L -> "due tomorrow"; else -> "by ${t.due!!.format(dayFmt)}, in $days days" },
                        ).joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (days != null && days <= 2) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TextButton(onClick = { save(items.map { if (it.id == t.id) it.copy(done = true) else it }) }, modifier = Modifier.heightIn(min = 48.dp)) { Text("Done") }
            }
        }
    }
}
