package com.tendays.lettersorter

import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

enum class Pile(val title: String) { ACT("Do this"), FILE("File it"), BIN("Bin it"), LOOK("Have a look") }

data class Reading(
    val pile: Pile,
    val due: LocalDate?,
    val amount: String?,
    val from: String?,
    val why: List<String>,
    val lines: List<String>,
)

/**
 * Turns the text of a letter, bill or screenshot into one calm answer. Plain Kotlin, no Android,
 * so every rule here is unit-tested. Dates are read day-first (12/11/2026 is 12 November), as in Nigeria and the UK.
 */
object LetterReader {
    private val URGENT = listOf(
        "final notice", "final reminder", "overdue", "past due", "arrears", "disconnection", "disconnect", "suspension",
        "suspended", "penalty", "late fee", "court", "summons", "legal action", "eviction", "quit notice", "notice to quit",
        "debt collector", "last chance", "outstanding balance", "amount due", "pay by", "payment due", "due date", "deadline",
    )
    private val FILE = listOf("receipt", "statement", "thank you for your payment", "payment received", "confirmation", "has been paid", "paid in full", "for your records", "invoice no", "tax certificate")
    private val BIN = listOf("special offer", "promo", "limited time", "discount", "you have won", "congratulations you", "unsubscribe", "sale ends", "free gift", "apply now", "pre-approved", "pre approved")
    private val DUE_WORDS = listOf("due", "pay by", "payable by", "before", "deadline", "by ", "no later than", "on or before", "expires", "expiry")

    private val MONTHS = (1..12).associateBy { java.time.Month.of(it).getDisplayName(TextStyle.FULL, Locale.ENGLISH).lowercase() } +
        (1..12).associateBy { java.time.Month.of(it).getDisplayName(TextStyle.SHORT, Locale.ENGLISH).lowercase().take(3) } +
        mapOf("sept" to 9)

    private val NUMERIC = Regex("""\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b""")
    private val ISO = Regex("""\b(\d{4})-(\d{2})-(\d{2})\b""")
    private val DAY_MONTH = Regex("""\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]{3,9})\.?,?\s+(\d{4})\b""")
    private val MONTH_DAY = Regex("""\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b""")
    private val MONEY = Regex("""(₦|NGN|N(?=\s?\d)|£|GBP|\$|USD|€|EUR)\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)(\.\d{2})?""")

    data class Found(val date: LocalDate, val at: Int)

    fun dates(text: String): List<Found> {
        val out = mutableListOf<Found>()
        fun year(y: String) = y.toInt().let { if (it < 100) 2000 + it else it }
        fun add(d: Int, m: Int, y: Int, at: Int) { runCatching { LocalDate.of(y, m, d) }.getOrNull()?.let { out += Found(it, at) } }
        ISO.findAll(text).forEach { add(it.groupValues[3].toInt(), it.groupValues[2].toInt(), it.groupValues[1].toInt(), it.range.first) }
        NUMERIC.findAll(text).forEach {
            val a = it.groupValues[1].toInt(); val b = it.groupValues[2].toInt(); val y = year(it.groupValues[3])
            if (b <= 12) add(a, b, y, it.range.first) else if (a <= 12) add(b, a, y, it.range.first) // 11/25/2026 can only be month-first
        }
        DAY_MONTH.findAll(text).forEach { m -> MONTHS[m.groupValues[2].lowercase()]?.let { add(m.groupValues[1].toInt(), it, m.groupValues[3].toInt(), m.range.first) } }
        MONTH_DAY.findAll(text).forEach { m -> MONTHS[m.groupValues[1].lowercase()]?.let { add(m.groupValues[2].toInt(), it, m.groupValues[3].toInt(), m.range.first) } }
        return out.distinctBy { it.at }
    }

    fun amount(text: String): String? {
        val lower = text.lowercase()
        val all = MONEY.findAll(text).map { m ->
            val value = m.groupValues[2].replace(Regex("[,\\s]"), "").toDouble() + (m.groupValues[3].drop(1).toIntOrNull() ?: 0) / 100.0
            val near = lower.substring((m.range.first - 40).coerceAtLeast(0), m.range.first)
            val cue = listOf("total", "amount due", "balance", "pay", "outstanding", "due").any { it in near }
            Triple(m.value.replace(Regex("\\s+"), " ").trim(), value, cue)
        }.toList()
        return (all.filter { it.third }.maxByOrNull { it.second } ?: all.maxByOrNull { it.second })?.first
    }

    fun read(text: String, today: LocalDate): Reading {
        val lower = text.lowercase()
        val urgent = URGENT.filter { it in lower }
        val filing = FILE.filter { it in lower }
        val junk = BIN.filter { it in lower }
        val found = dates(text)
        // The due date: a date right after a due word ("pay by", "on or before"), not long past. Only an urgent letter
        // falls back to its earliest future date; a receipt's payment date is not a deadline.
        val near = found.filter { f -> DUE_WORDS.any { w -> lower.substring((f.at - 30).coerceAtLeast(0), f.at).contains(w) } }
        val due = near.map { it.date }.filter { !it.isBefore(today.minusDays(30)) }.minOrNull()
            ?: if (urgent.isNotEmpty()) found.map { it.date }.filter { !it.isBefore(today) }.minOrNull() else null
        val amount = amount(text)
        val from = text.lines().map { it.trim() }.firstOrNull { it.length in 3..60 && it.any(Char::isLetter) && !Regex("""^\d""").containsMatchIn(it) }
        val why = mutableListOf<String>()
        val actByDate = due != null && !due.isBefore(today) && amount != null
        val pile = when {
            urgent.isNotEmpty() || (actByDate && filing.isEmpty()) -> {
                if (urgent.isNotEmpty()) why += "It says \"${urgent.first()}\""
                if (due != null) why += "There's a date to act by"
                if (amount != null) why += "It asks for $amount"
                Pile.ACT
            }
            filing.isNotEmpty() -> { why += "It reads like a record (\"${filing.first()}\")"; Pile.FILE }
            junk.isNotEmpty() -> { why += "It reads like an advert (\"${junk.first()}\")"; Pile.BIN }
            else -> { why += "Nothing in it asks you to act, but nothing says it's safe to bin either"; Pile.LOOK }
        }
        val keys = (URGENT + FILE + DUE_WORDS.map { it.trim() } + listOf("₦", "ngn", "£", "$", "€", "total", "balance"))
        val lines = text.lines().map { it.trim() }.filter { l -> l.isNotEmpty() && keys.any { it in l.lowercase() } }.distinct().take(6)
        return Reading(pile, due, amount, from, why, lines)
    }
}
