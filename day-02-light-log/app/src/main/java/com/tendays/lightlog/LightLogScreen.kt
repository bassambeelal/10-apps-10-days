package com.tendays.lightlog

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

private const val HOUR = 3_600_000L
private const val DAY = 24 * HOUR
private val dayFmt = DateTimeFormatter.ofPattern("EEE d MMM")
private val timeFmt = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)
private fun time(ms: Long) = Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()).toLocalTime().format(timeFmt)
private fun date(ms: Long) = Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()).toLocalDate()

fun dur(ms: Long): String {
    val m = ms / 60_000
    return when {
        m < 1 -> "under 1 m"
        m < 60 -> "$m m"
        else -> "${m / 60} h ${m % 60} m"
    }
}

private fun hours(ms: Long) = "%.1f h".format(ms / HOUR.toDouble())

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LightLogScreen(
    watching: Boolean,
    unrestricted: Boolean,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onAllowBackground: () -> Unit,
    onShare: (String) -> Unit,
) {
    val context = LocalContext.current
    val events by PowerLog.events.collectAsStateWithLifecycle()
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(events) {
        now = System.currentTimeMillis()
        while (true) { delay(30_000); now = System.currentTimeMillis() }
    }
    val prefs = remember { context.getSharedPreferences(Prefs.NAME, Context.MODE_PRIVATE) }
    var promised by remember { mutableStateOf(prefs.getString(Prefs.PROMISED_HOURS, "") ?: "") }
    var sample by remember { mutableStateOf(prefs.getBoolean(Prefs.SAMPLE, false)) }
    var removing by remember { mutableStateOf<PowerLog.Outage?>(null) }

    val outages = remember(events) { PowerLog.outages(events) }
    val zone = ZoneId.systemDefault()
    val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
    val first = PowerLog.firstDay(events)
    val days = if (first == null) emptyList() else (0L..6L).map { today.minusDays(it) }
        .filter { !it.isBefore(first) }
        .map { PowerLog.day(it, events, outages, now) }
    val promisedH = promised.toDoubleOrNull()?.takeIf { it in 0.5..24.0 }

    Scaffold(topBar = { TopAppBar(title = { Text("Light Log") }) }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = 16.dp, end = 16.dp,
                top = padding.calculateTopPadding() + 8.dp,
                bottom = padding.calculateBottomPadding() + 24.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            if (sample) item {
                Notice("This is a sample week with made-up times, so you can see what the record looks like. Start watching to clear it and record your own.")
            }
            item { StatusCard(watching, events, now, onStart) }
            if (watching && !unrestricted) item {
                Notice(
                    "Some phones stop apps in the background to save battery. Let Light Log run unrestricted so it doesn't miss a cut.",
                    action = "Allow" to onAllowBackground,
                )
            }
            if (events.isEmpty() && !watching) item {
                TextButton(onClick = {
                    PowerLog.replaceAll(context, PowerLog.sampleWeek(System.currentTimeMillis()))
                    prefs.edit().putBoolean(Prefs.SAMPLE, true).apply(); sample = true
                }) { Text("See an example week first") }
            }
            if (days.isNotEmpty()) {
                item { TodayCard(days.first(), events, outages, now) }
                item { WeekCard(days, events, outages, now, promisedH) }
            }
            if (outages.isNotEmpty()) {
                item { Text("Cuts", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp)) }
                items(outages.reversed().take(40), key = { it.start }) { o -> CutRow(o, now) { removing = o } }
            }
            item {
                SettingsCard(
                    promised = promised,
                    onPromised = { promised = it.filter { c -> c.isDigit() || c == '.' }.take(4); prefs.edit().putString(Prefs.PROMISED_HOURS, promised).apply() },
                    watching = watching,
                    hasRecord = days.isNotEmpty(),
                    onStop = onStop,
                    onShare = { onShare(report(days, outages, now, promisedH)) },
                    sample = sample,
                    onClearSample = { PowerLog.replaceAll(context, emptyList()); prefs.edit().putBoolean(Prefs.SAMPLE, false).apply(); sample = false },
                )
            }
        }
    }

    removing?.let { o ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("Remove this cut?") },
            text = { Text("Only remove it if you unplugged the phone yourself, so the record stays true. ${date(o.start).format(dayFmt)}, ${time(o.start)}, ${dur(o.endOr(now) - o.start)}.") },
            confirmButton = { TextButton(onClick = { PowerLog.remove(context, o); removing = null }) { Text("Remove") } },
            dismissButton = { TextButton(onClick = { removing = null }) { Text("Keep") } },
        )
    }
}

@Composable
private fun Notice(text: String, action: Pair<String, () -> Unit>? = null) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
        Column(Modifier.padding(16.dp)) {
            Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)
            if (action != null) TextButton(onClick = action.second, modifier = Modifier.padding(top = 4.dp)) { Text(action.first) }
        }
    }
}

@Composable
private fun StatusCard(watching: Boolean, events: List<PowerLog.Event>, now: Long, onStart: () -> Unit) {
    val last = events.lastOrNull { it.kind == PowerLog.Kind.ON || it.kind == PowerLog.Kind.OFF }
    val on = last?.kind == PowerLog.Kind.ON
    val container = when {
        !watching || last == null -> MaterialTheme.colorScheme.surfaceVariant
        on -> Supply.light
        else -> Supply.off
    }
    val ink = when {
        !watching || last == null -> MaterialTheme.colorScheme.onSurfaceVariant
        on -> Color(0xFF2B1A00)
        else -> Color(0xFFF7F3EA)
    }
    Card(colors = CardDefaults.cardColors(containerColor = container, contentColor = ink), shape = RoundedCornerShape(24.dp)) {
        Column(Modifier.fillMaxWidth().padding(24.dp)) {
            when {
                !watching -> {
                    Text("Not watching", style = MaterialTheme.typography.headlineMedium)
                    Text(
                        "Plug this phone into a wall socket on the grid, not an inverter or generator. Light Log notes every time power to the charger goes off and comes back.",
                        style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
                    )
                    Button(onClick = onStart, modifier = Modifier.height(48.dp)) { Text("Start watching") }
                }
                last == null -> {
                    Text("Watching", style = MaterialTheme.typography.headlineMedium)
                    Text("Waiting for the first reading from the charger.", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp))
                }
                else -> {
                    Text(if (on) "Light is on" else "No light", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                    Text(
                        "${dur(now - last.at)}, since ${time(last.at)}${if (date(last.at) != date(now)) " on ${date(last.at).format(dayFmt)}" else ""}",
                        style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun TodayCard(day: PowerLog.Day, events: List<PowerLog.Event>, outages: List<PowerLog.Outage>, now: Long) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(16.dp)) {
            Text("Today", style = MaterialTheme.typography.titleMedium)
            Text(
                "${dur(day.lightMs)} of light so far · ${day.cuts} ${if (day.cuts == 1) "cut" else "cuts"}",
                style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )
            DayStrip(day.date, events, outages, now, Modifier.height(28.dp), "${dur(day.lightMs)} of light today, ${day.cuts} cuts")
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf("00", "06", "12", "18", "24").forEach {
                    Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Legend()
        }
    }
}

@Composable
private fun Legend() {
    val offColor = if (isSystemInDarkTheme()) Supply.offDark else Supply.off
    Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Swatch(Supply.light, "Light")
        Swatch(offColor, "No light")
        Swatch(MaterialTheme.colorScheme.surfaceVariant, "Not watched")
    }
}

@Composable
private fun Swatch(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.width(12.dp).height(12.dp).clip(RoundedCornerShape(3.dp))) { drawRect(color) }
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 6.dp))
    }
}

@Composable
private fun DayStrip(day: LocalDate, events: List<PowerLog.Event>, outages: List<PowerLog.Outage>, now: Long, modifier: Modifier, description: String) {
    val zone = ZoneId.systemDefault()
    val from = day.atStartOfDay(zone).toInstant().toEpochMilli()
    val to = minOf(from + DAY, now)
    val spans = remember(events, now) { PowerLog.watched(events, now) }
    val unwatched = MaterialTheme.colorScheme.surfaceVariant
    val offColor = if (isSystemInDarkTheme()) Supply.offDark else Supply.off
    val tick = MaterialTheme.colorScheme.surface
    Canvas(modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).semantics { contentDescription = description }) {
        val w = size.width
        fun x(t: Long) = ((t - from).toFloat() / DAY) * w
        drawRect(unwatched)
        for (s in spans) {
            val a = maxOf(s.first, from); val b = minOf(s.last + 1, to)
            if (b > a) drawRect(Supply.light, Offset(x(a), 0f), Size(x(b) - x(a), size.height))
        }
        for (o in outages) {
            val a = maxOf(o.start, from); val b = minOf(o.endOr(now), to)
            if (b > a) drawRect(offColor, Offset(x(a), 0f), Size(maxOf(x(b) - x(a), 1f), size.height))
        }
        for (h in listOf(6, 12, 18)) {
            val tx = x(from + h * HOUR)
            drawLine(tick.copy(alpha = 0.7f), Offset(tx, 0f), Offset(tx, size.height), strokeWidth = 1.dp.toPx())
        }
    }
}

@Composable
private fun WeekCard(days: List<PowerLog.Day>, events: List<PowerLog.Event>, outages: List<PowerLog.Outage>, now: Long, promisedH: Double?) {
    val watched = days.sumOf { it.watchedMs }
    val light = days.sumOf { it.lightMs }
    val avg = if (watched > 0) light.toDouble() / watched * 24 else 0.0
    val inRange = outages.filter { o -> days.any { d -> date(o.start) == d.date } }
    val longest = inRange.maxByOrNull { it.endOr(now) - it.start }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(16.dp)) {
            Text(if (days.size >= 7) "Last 7 days" else "Since you started", style = MaterialTheme.typography.titleMedium)
            Text(
                buildString {
                    append("Light for %.1f h out of every 24 on average · ${inRange.size} cuts".format(avg))
                    if (longest != null) append(" · longest ${dur(longest.endOr(now) - longest.start)}")
                },
                style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )
            days.forEachIndexed { i, d ->
                if (i > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.surfaceVariant)
                val complete = i > 0 && d.watchedMs >= DAY - 60_000
                val below = promisedH != null && complete && d.lightMs < promisedH * HOUR
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (i == 0) "Today" else d.date.format(dayFmt), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.width(84.dp))
                    DayStrip(d.date, events, outages, now, Modifier.weight(1f).height(16.dp), "${d.date.format(dayFmt)}: ${dur(d.lightMs)} of light, ${d.cuts} cuts")
                    Column(Modifier.width(76.dp), horizontalAlignment = Alignment.End) {
                        Text(
                            hours(d.lightMs), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold,
                            color = if (below) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface, textAlign = TextAlign.End,
                        )
                        val note = when {
                            below -> "below ${promisedH!!.toInt()} h"
                            d.watchedMs < DAY - 60_000 && i > 0 -> "of ${hours(d.watchedMs)}"
                            else -> null
                        }
                        if (note != null) Text(note, style = MaterialTheme.typography.labelSmall, color = if (below) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun CutRow(o: PowerLog.Outage, now: Long, onRemove: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(
                if (o.end == null) "Since ${time(o.start)}, still off" else "${time(o.start)} – ${time(o.end)}${if (date(o.end) != date(o.start)) " next day" else ""}",
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                "${date(o.start).format(dayFmt)} · ${if (o.approx) "about " else ""}${dur(o.endOr(now) - o.start)}",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (o.end != null) TextButton(onClick = onRemove, modifier = Modifier.height(48.dp)) { Text("Remove") }
    }
}

@Composable
private fun SettingsCard(
    promised: String,
    onPromised: (String) -> Unit,
    watching: Boolean,
    hasRecord: Boolean,
    onStop: () -> Unit,
    onShare: () -> Unit,
    sample: Boolean,
    onClearSample: () -> Unit,
) {
    Column(Modifier.padding(top = 8.dp)) {
        OutlinedTextField(
            value = promised,
            onValueChange = onPromised,
            label = { Text("Promised hours a day (optional)") },
            supportingText = { Text("If your tariff band promises a minimum supply, enter it to see the days that fell short. Check your bill or your distribution company's website.") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (hasRecord) Button(onClick = onShare, modifier = Modifier.height(48.dp)) { Text("Share report") }
            if (watching) OutlinedButton(onClick = onStop, modifier = Modifier.height(48.dp)) { Text("Stop watching") }
            if (sample) OutlinedButton(onClick = onClearSample, modifier = Modifier.height(48.dp)) { Text("Clear sample") }
        }
    }
}

fun report(days: List<PowerLog.Day>, outages: List<PowerLog.Outage>, now: Long, promisedH: Double?): String = buildString {
    if (days.isEmpty()) return@buildString
    val ordered = days.reversed()
    appendLine("Power supply record, ${ordered.first().date.format(dayFmt)} to ${ordered.last().date.format(dayFmt)}")
    appendLine("Recorded by Light Log from the times my phone charger lost and got back mains power.")
    appendLine()
    appendLine("Hours of light per day:")
    for (d in ordered) {
        append("${d.date.format(dayFmt)}: ${dur(d.lightMs)}, ${d.cuts} ${if (d.cuts == 1) "cut" else "cuts"}")
        if (d.watchedMs < DAY - 60_000) append(" (recorded for ${dur(d.watchedMs)})")
        if (promisedH != null && d.watchedMs >= DAY - 60_000 && d.lightMs < promisedH * HOUR) append(", below the promised ${promisedH.toInt()} h")
        appendLine()
    }
    val first = ordered.first().date
    appendLine()
    appendLine("Cuts:")
    outages.filter { !date(it.start).isBefore(first) }.forEach { o ->
        appendLine("${date(o.start).format(dayFmt)} ${time(o.start)} to ${o.end?.let { time(it) } ?: "still off"}: ${if (o.approx) "about " else ""}${dur(o.endOr(now) - o.start)}")
    }
}
