package com.tendays.proofpack

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.text.DateFormat
import java.util.Date

private fun time(t: Long) = DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(t))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PackList(packs: List<Pack>, onOpen: (String) -> Unit, onNew: () -> Unit) {
    Scaffold(
        topBar = { TopAppBar(title = { Text("Proof Pack") }) },
        bottomBar = {
            Surface(tonalElevation = 2.dp) {
                Button(onClick = onNew, modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp).heightIn(min = 52.dp)) { Text("New pack") }
            }
        },
    ) { pad ->
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = pad.calculateTopPadding() + 8.dp, bottom = pad.calculateBottomPadding() + 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (packs.isEmpty()) item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Photos that hold up in a dispute", style = MaterialTheme.typography.headlineSmall)
                    Text("Before you drive off in a rental car or move into a flat, Proof Pack walks you round a fixed list of photos. Each one is stamped with the time, the place if you allow it, and a fingerprint that shows it hasn't been edited. Do it again when you hand back, and send both as one PDF.", style = MaterialTheme.typography.bodyLarge)
                }
            }
            itemsIndexed(packs, key = { _, p -> p.id }) { _, p ->
                Card(onClick = { onOpen(p.id) }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(p.title, style = MaterialTheme.typography.titleMedium)
                        Text(listOf(p.kind.label, p.place).filter { it.isNotBlank() }.joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        p.phases.forEach { ph ->
                            Text("${ph.name}: ${ph.doneCount} of ${ph.shots.size} photos", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewPack(onCreate: (Kind, String, String) -> Unit, onCancel: () -> Unit) {
    var kind by remember { mutableStateOf(Kind.CAR) }
    var title by remember { mutableStateOf("") }
    var place by remember { mutableStateOf("") }
    Scaffold(topBar = { TopAppBar(title = { Text("New pack") }, navigationIcon = { TextButton(onClick = onCancel) { Text("Cancel") } }) }) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("What are you recording?", style = MaterialTheme.typography.titleMedium)
            Kind.entries.forEach { k ->
                val selected = k == kind
                Card(
                    onClick = { kind = k },
                    colors = CardDefaults.cardColors(containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerLow),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(k.label, style = MaterialTheme.typography.titleMedium, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                        Text("${k.phases.joinToString(" and ")}, ${k.shots.size} photos each", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            OutlinedTextField(title, { title = it.take(60) }, label = { Text(if (kind == Kind.CAR) "Car and plate" else "Address") }, placeholder = { Text(if (kind == Kind.CAR) "Toyota Corolla, LND 482 XY" else "Flat 3, 12 Allen Avenue") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(place, { place = it.take(60) }, label = { Text(if (kind == Kind.CAR) "Rental company (optional)" else "Landlord or agent (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(onClick = { onCreate(kind, title.trim().ifBlank { kind.label }, place.trim()) }, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Start") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PackScreen(
    pack: Pack, phase: Int, store: Store, useLocation: Boolean, busy: Boolean,
    onPhase: (Int) -> Unit, onShoot: (Int) -> Unit, onNote: (Int, String) -> Unit, onExtra: (String) -> Unit,
    onLocation: (Boolean) -> Unit, onExport: () -> Unit, onDelete: () -> Unit, onBack: () -> Unit,
) {
    val ph = pack.phases[phase]
    var noting by remember { mutableStateOf<Int?>(null) }
    var adding by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    val total = pack.phases.sumOf { it.doneCount }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(pack.title, maxLines = 1) },
                navigationIcon = { TextButton(onClick = onBack) { Text("Back") } },
                actions = { TextButton(onClick = { deleting = true }) { Text("Delete") } },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 2.dp) {
                Column(Modifier.navigationBarsPadding().padding(16.dp)) {
                    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth().padding(bottom = 8.dp))
                    Button(onClick = onExport, enabled = total > 0 && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)) {
                        Text(if (total == 0) "Take a photo to make the PDF" else "Make the PDF ($total photos)")
                    }
                }
            }
        },
    ) { pad ->
        LazyColumn(contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = pad.calculateBottomPadding() + 16.dp)) {
            item {
                PrimaryTabRow(selectedTabIndex = phase) {
                    pack.phases.forEachIndexed { i, p -> Tab(selected = i == phase, onClick = { onPhase(i) }, text = { Text("${p.name}  ${p.doneCount}/${p.shots.size}") }) }
                }
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        if (ph.doneCount == ph.shots.size) "All ${ph.shots.size} photos taken." else "${ph.shots.size - ph.doneCount} photos to go. Take them in order, standing back far enough to show the whole part.",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                    LinearProgressIndicator(progress = { ph.doneCount / ph.shots.size.toFloat() }, modifier = Modifier.fillMaxWidth())
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text("Add the place to each photo", style = MaterialTheme.typography.bodyMedium)
                            Text("Uses the phone's last location fix", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(checked = useLocation, onCheckedChange = onLocation)
                    }
                }
                HorizontalDivider()
            }
            itemsIndexed(ph.shots, key = { i, s -> "$phase-$i-${s.label}" }) { i, s ->
                ShotRow(s, store, pack, onShoot = { onShoot(i) }, onNote = { noting = i })
                HorizontalDivider(Modifier.padding(start = 96.dp))
            }
            item {
                TextButton(onClick = { adding = true }, modifier = Modifier.padding(8.dp).heightIn(min = 48.dp)) { Text("Add another photo") }
            }
        }
    }

    noting?.let { i ->
        var text by remember(i) { mutableStateOf(ph.shots[i].note) }
        AlertDialog(
            onDismissRequest = { noting = null },
            title = { Text(ph.shots[i].label) },
            text = { OutlinedTextField(text, { text = it.take(120) }, label = { Text("Note, for example a scratch already there") }, modifier = Modifier.fillMaxWidth()) },
            confirmButton = { TextButton(onClick = { onNote(i, text.trim()); noting = null }) { Text("Save") } },
            dismissButton = { TextButton(onClick = { noting = null }) { Text("Cancel") } },
        )
    }
    if (adding) {
        var label by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { adding = false },
            title = { Text("Another photo") },
            text = { OutlinedTextField(label, { label = it.take(40) }, label = { Text("What it shows") }, singleLine = true) },
            confirmButton = { TextButton(onClick = { if (label.isNotBlank()) onExtra(label.trim()); adding = false }) { Text("Add") } },
            dismissButton = { TextButton(onClick = { adding = false }) { Text("Cancel") } },
        )
    }
    if (deleting) AlertDialog(
        onDismissRequest = { deleting = false },
        title = { Text("Delete ${pack.title}?") },
        text = { Text("This removes all ${pack.phases.sumOf { it.doneCount }} photos from this phone. A PDF you already sent is not affected.") },
        confirmButton = { TextButton(onClick = { deleting = false; onDelete() }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { deleting = false }) { Text("Keep") } },
    )
}

@Composable
private fun ShotRow(s: Shot, store: Store, pack: Pack, onShoot: () -> Unit, onNote: () -> Unit) {
    val thumb by produceState<ImageBitmap?>(null, s.file) {
        value = s.file?.let { f -> withContext(Dispatchers.IO) { decodeThumb(store.photo(pack, f)) } }
    }
    Row(Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onShoot).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(64.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
            thumb?.let { Image(it, contentDescription = "Photo of ${s.label}", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
                ?: Text("Take", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(s.label, style = MaterialTheme.typography.bodyLarge, fontWeight = if (s.done) FontWeight.Normal else FontWeight.SemiBold)
            Text(
                when {
                    s.takenAt != null -> "Taken ${time(s.takenAt)}${if (s.lat != null) " · place recorded" else ""}"
                    else -> "Not taken yet"
                },
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (s.note.isNotBlank()) Text(s.note, style = MaterialTheme.typography.bodySmall)
        }
        if (s.done) {
            TextButton(onClick = onNote, modifier = Modifier.heightIn(min = 48.dp)) { Text(if (s.note.isBlank()) "Note" else "Edit note") }
        } else {
            OutlinedButton(onClick = onShoot, modifier = Modifier.heightIn(min = 48.dp)) { Text("Take") }
        }
    }
}

private fun decodeThumb(f: File): ImageBitmap? {
    if (!f.exists()) return null
    val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(f.path, b)
    var sample = 1
    while (b.outWidth / (sample * 2) >= 192) sample *= 2
    return BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
}
