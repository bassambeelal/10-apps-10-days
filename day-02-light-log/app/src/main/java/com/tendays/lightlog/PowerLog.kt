package com.tendays.lightlog

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * The record. Every power change is one line in events.csv: time, kind, inferred.
 * Outages are worked out from the raw events when they are read, so the file stays the plain truth.
 */
object PowerLog {
    enum class Kind(val code: Int) { OFF(0), ON(1), WATCH_START(2), WATCH_STOP(3) }

    data class Event(val at: Long, val kind: Kind, val inferred: Boolean = false)

    /** end == null means the outage is still going on. approx: one end was inferred, not heard live. */
    data class Outage(val start: Long, val end: Long?, val approx: Boolean) {
        fun endOr(now: Long) = end ?: now
    }

    data class Day(val date: LocalDate, val watchedMs: Long, val offMs: Long, val cuts: Int) {
        val lightMs get() = watchedMs - offMs
    }

    /** A drop shorter than this is a flicker, not a cut. */
    const val MIN_CUT_MS = 60_000L
    /** Power that comes back for less than this before going again belongs to the same cut. */
    const val MERGE_MS = 120_000L

    private val _events = MutableStateFlow<List<Event>>(emptyList())
    val events: StateFlow<List<Event>> = _events.asStateFlow()
    private var file: File? = null

    @Synchronized
    fun init(context: Context) {
        if (file != null) return
        val f = File(context.applicationContext.filesDir, "events.csv")
        file = f
        _events.value = if (f.exists()) f.readLines().mapNotNull(::parse).sortedBy { it.at } else emptyList()
    }

    private fun parse(line: String): Event? {
        val p = line.split(',')
        if (p.size < 2) return null
        val at = p[0].toLongOrNull() ?: return null
        val kind = Kind.entries.firstOrNull { it.code == p[1].toIntOrNull() } ?: return null
        return Event(at, kind, p.getOrNull(2) == "1")
    }

    private fun line(e: Event) = "${e.at},${e.kind.code},${if (e.inferred) 1 else 0}\n"

    @Synchronized
    fun record(context: Context, kind: Kind, at: Long = System.currentTimeMillis(), inferred: Boolean = false) {
        init(context)
        val e = Event(at, kind, inferred)
        file!!.appendText(line(e))
        _events.value = (_events.value + e).sortedBy { it.at }
    }

    /** The last ON or OFF heard, or null if nothing yet. */
    fun lastPowerState(): Boolean? = _events.value.lastOrNull { it.kind == Kind.ON || it.kind == Kind.OFF }?.let { it.kind == Kind.ON }

    /** "I unplugged it": drops the OFF and ON events that make up this outage. */
    @Synchronized
    fun remove(context: Context, o: Outage) {
        init(context)
        val keep = _events.value.filterNot { e ->
            (e.kind == Kind.OFF && e.at >= o.start && e.at <= o.endOr(Long.MAX_VALUE)) ||
                (e.kind == Kind.ON && o.end != null && e.at > o.start && e.at <= o.end)
        }
        rewrite(keep)
    }

    @Synchronized
    fun replaceAll(context: Context, events: List<Event>) {
        init(context)
        rewrite(events.sortedBy { it.at })
    }

    private fun rewrite(list: List<Event>) {
        file!!.writeText(list.joinToString("") { line(it) })
        _events.value = list
    }

    // ---------- reading the record ----------

    fun outages(events: List<Event>): List<Outage> {
        val raw = mutableListOf<Outage>()
        var start: Long? = null
        var approx = false
        for (e in events) when (e.kind) {
            Kind.OFF -> if (start == null) { start = e.at; approx = e.inferred }
            Kind.ON -> if (start != null) { raw += Outage(start, e.at, approx || e.inferred); start = null }
            // Stopped watching during a cut: we only know it lasted at least this long.
            Kind.WATCH_STOP -> if (start != null) { raw += Outage(start, e.at, true); start = null }
            Kind.WATCH_START -> Unit
        }
        if (start != null) raw += Outage(start, null, approx)
        val merged = mutableListOf<Outage>()
        for (o in raw) {
            val last = merged.lastOrNull()
            if (last?.end != null && o.start - last.end < MERGE_MS) {
                merged[merged.lastIndex] = Outage(last.start, o.end, last.approx || o.approx)
            } else merged += o
        }
        return merged.filter { it.end == null || it.end - it.start >= MIN_CUT_MS }
    }

    /** Spans of time the app was watching: from WATCH_START (or the first event) to WATCH_STOP, or now. */
    fun watched(events: List<Event>, now: Long): List<LongRange> {
        val spans = mutableListOf<LongRange>()
        var from: Long? = null
        for (e in events) when (e.kind) {
            Kind.WATCH_STOP -> { if (from != null) spans += from until e.at; from = null }
            else -> if (from == null) from = e.at
        }
        if (from != null) spans += from until now
        return spans
    }

    private fun overlap(a: LongRange, from: Long, to: Long) = (minOf(a.last + 1, to) - maxOf(a.first, from)).coerceAtLeast(0)

    fun day(date: LocalDate, events: List<Event>, outages: List<Outage>, now: Long, zone: ZoneId = ZoneId.systemDefault()): Day {
        val from = date.atStartOfDay(zone).toInstant().toEpochMilli()
        val to = minOf(date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(), now)
        val spans = watched(events, now)
        val watchedMs = spans.sumOf { overlap(it, from, to) }
        var off = 0L
        var cuts = 0
        for (o in outages) {
            val r = o.start until o.endOr(now)
            val inDay = spans.sumOf { s -> overlap(r, maxOf(from, s.first), minOf(to, s.last + 1)) }
            if (inDay > 0) { off += inDay; if (o.start in from until to) cuts++ }
        }
        return Day(date, watchedMs, off.coerceAtMost(watchedMs), cuts)
    }

    fun firstDay(events: List<Event>, zone: ZoneId = ZoneId.systemDefault()): LocalDate? =
        events.firstOrNull()?.let { Instant.ofEpochMilli(it.at).atZone(zone).toLocalDate() }

    /** A made-up week, so a new user can see what the record looks like. Clearly flagged as a sample in the UI. */
    fun sampleWeek(now: Long, zone: ZoneId = ZoneId.systemDefault()): List<Event> {
        val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        val start = today.minusDays(6)
        val at = { d: LocalDate, h: Int, m: Int -> d.atTime(h, m).atZone(zone).toInstant().toEpochMilli() }
        // hours of each cut, per day: [start h, start m, end h, end m]
        val plan = listOf(
            listOf(intArrayOf(1, 10, 6, 40), intArrayOf(13, 5, 17, 30)),
            listOf(intArrayOf(0, 0, 5, 15), intArrayOf(9, 20, 9, 50), intArrayOf(18, 5, 23, 55)),
            listOf(intArrayOf(7, 45, 14, 10)),
            listOf(intArrayOf(2, 30, 8, 0), intArrayOf(12, 0, 19, 20)),
            listOf(intArrayOf(10, 15, 12, 45), intArrayOf(20, 40, 23, 59)),
            listOf(intArrayOf(0, 0, 4, 30), intArrayOf(15, 10, 21, 0)),
            listOf(intArrayOf(6, 0, 9, 12)),
        )
        val out = mutableListOf(Event(at(start, 0, 0) - 1, Kind.WATCH_START), Event(at(start, 0, 0), Kind.ON))
        plan.forEachIndexed { i, cuts ->
            val d = start.plusDays(i.toLong())
            for (c in cuts) {
                val off = at(d, c[0], c[1]); val on = at(d, c[2], c[3])
                if (off < now) out += Event(off, Kind.OFF)
                if (on < now) out += Event(on, Kind.ON)
            }
        }
        return out.sortedBy { it.at }
    }
}
