package com.tendays.keepnumber

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

private val dayFmt = DateTimeFormatter.ofPattern("EEE d MMM yyyy")

class MainActivity : ComponentActivity() {
    private var lines by mutableStateOf(emptyList<Line>())
    private val askNotify = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        lines = Store.load(this)
        Reminders.schedule(this)
        setContent { KeepTheme { App() } }
    }

    private fun save(new: List<Line>) {
        lines = new
        Store.save(this, new)
        if (new.isNotEmpty() && Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    private fun App() {
        val today = LocalDate.now()
        var editing by remember { mutableStateOf<Line?>(null) }
        var adding by remember { mutableStateOf(false) }
        Scaffold(
            topBar = { TopAppBar(title = { Text("Keep My Number") }) },
            bottomBar = {
                Surface(tonalElevation = 2.dp) {
                    Button(onClick = { adding = true }, modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp).heightIn(min = 52.dp)) { Text("Add a line") }
                }
            },
        ) { pad ->
            LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = pad.calculateTopPadding() + 8.dp, bottom = pad.calculateBottomPadding() + 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (lines.isEmpty()) item { Intro() }
                items(lines.sortedByDescending { it.days(today) }, key = { it.id }) { line ->
                    LineCard(line, today, onUsed = { save(lines.map { if (it.id == line.id) it.copy(lastUsed = today) else it }) }, onEdit = { editing = line })
                }
                if (lines.isNotEmpty()) item { Rule() }
            }
        }
        if (adding || editing != null) {
            EditDialog(
                start = editing,
                onSave = { l -> save(if (lines.any { it.id == l.id }) lines.map { if (it.id == l.id) l else it } else lines + l); adding = false; editing = null },
                onDelete = editing?.let { e -> { save(lines.filterNot { it.id == e.id }); editing = null } },
                onDismiss = { adding = false; editing = null },
            )
        }
    }

    @Composable
    private fun Intro() {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
            Text("Don't lose a number your bank still texts", style = MaterialTheme.typography.headlineSmall)
            Text(
                "A prepaid line that goes unused is switched off and later given to a stranger, along with the OTPs, alerts and account recoveries still tied to it. Add every SIM you own, even the one in a drawer, and Keep My Number reminds you before it's too late.",
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }

    @Composable
    private fun Rule() {
        Text(
            "The rule: with no paid activity (a call, an SMS, a charged USSD session or data use) for over ${Rules.INACTIVE} days, a line is inactive. After ${Rules.CHURN} days it can be recycled to someone else. Source: NCC guidelines as reported by Vanguard, June 2025. Your network may act differently, so don't cut it close.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp),
        )
        TextButton(onClick = { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Rules.SOURCE))) }) { Text("Read the source") }
    }

    @Composable
    private fun LineCard(line: Line, today: LocalDate, onUsed: () -> Unit, onEdit: () -> Unit) {
        val stage = line.stage(today)
        val days = line.days(today)
        val (bg, fg) = when (stage) {
            Stage.SAFE -> MaterialTheme.colorScheme.surfaceContainerLow to MaterialTheme.colorScheme.onSurface
            Stage.SOON -> Color(0xFFFFF4D6) to Color(0xFF5A3E00)
            Stage.INACTIVE, Stage.CHURN -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        }
        Card(colors = CardDefaults.cardColors(containerColor = bg, contentColor = fg), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(line.label, style = MaterialTheme.typography.titleMedium)
                        Text(listOf(line.operator, line.masked()).filter { it.isNotBlank() }.joinToString(" · "), style = MaterialTheme.typography.bodyMedium)
                    }
                    Text(stage.label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                }
                Text(
                    when (stage) {
                        Stage.SAFE -> "$days days since you last used it. Safe until ${line.inactiveOn().format(dayFmt)}."
                        Stage.SOON -> "$days days since you last used it. It becomes inactive on ${line.inactiveOn().format(dayFmt)}: use it before then."
                        Stage.INACTIVE -> "$days days without use: the line is inactive. It can be recycled from ${line.churnOn().format(dayFmt)}. Use it now, or visit your network to reactivate it."
                        Stage.CHURN -> "$days days without use. The network can now give this number to someone else. Visit your network today, and move anything tied to it."
                    },
                    style = MaterialTheme.typography.bodyLarge,
                )
                LinearProgressIndicator(progress = { (days / Rules.CHURN.toFloat()).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp))
                if (line.links.isNotEmpty()) Text("Tied to it: ${line.links.joinToString(", ")}", style = MaterialTheme.typography.bodyMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onUsed, modifier = Modifier.heightIn(min = 48.dp)) { Text("I used it today") }
                    OutlinedButton(onClick = onEdit, modifier = Modifier.heightIn(min = 48.dp)) { Text("Edit") }
                }
                Text("Using it means a call, an SMS, a charged USSD code or some data. Recharging alone may not count.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }

    @Composable
    private fun EditDialog(start: Line?, onSave: (Line) -> Unit, onDelete: (() -> Unit)?, onDismiss: () -> Unit) {
        var label by remember { mutableStateOf(start?.label ?: "") }
        var operator by remember { mutableStateOf(start?.operator ?: "MTN") }
        var number by remember { mutableStateOf(start?.number ?: "") }
        var daysAgo by remember { mutableStateOf(start?.days(LocalDate.now())?.toString() ?: "0") }
        var links by remember { mutableStateOf(start?.links ?: emptySet()) }
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(if (start == null) "Add a line" else "Edit ${start.label}") },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(label, { label = it.take(30) }, label = { Text("Name it") }, placeholder = { Text("Old MTN line") }, singleLine = true)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OPERATORS.forEach { op -> FilterChip(selected = operator == op, onClick = { operator = op }, label = { Text(op) }) }
                    }
                    OutlinedTextField(number, { number = it.filter { c -> c.isDigit() || c == '+' }.take(15) }, label = { Text("Number (optional)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                    OutlinedTextField(daysAgo, { daysAgo = it.filter(Char::isDigit).take(4) }, label = { Text("Days since you last used it") }, supportingText = { Text("A call, SMS, charged USSD code or data. Guess high if unsure.") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                    Text("What's tied to this number?", style = MaterialTheme.typography.labelLarge)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LINKS.forEach { l -> FilterChip(selected = l in links, onClick = { links = if (l in links) links - l else links + l }, label = { Text(l) }) }
                    }
                    if (onDelete != null) TextButton(onClick = onDelete) { Text("Remove this line", color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val d = daysAgo.toIntOrNull() ?: 0
                    onSave(Line(start?.id ?: UUID.randomUUID().toString().take(8), label.trim().ifBlank { "$operator line" }, operator, number.trim(), LocalDate.now().minusDays(d.toLong()), links))
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        )
    }
}
