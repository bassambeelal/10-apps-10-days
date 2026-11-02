package com.tendays.keepnumber

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * NCC rule (reported by Vanguard, June 2025): a line with no revenue generating event for over 180 days is
 * inactive; after another 180 days (360 in all) it can be churned and given to someone else.
 * The QoS Regulation and Business Rules 2024 are quoted as 365 days; we warn on the earlier number.
 */
object Rules {
    const val INACTIVE = 180
    const val CHURN = 360
    const val WARN = 150
    const val SOURCE = "https://www.vanguardngr.com/2025/06/fg-sets-new-rules-to-deactivating-dormant-lines/amp/"
}

enum class Stage(val label: String) {
    SAFE("Safe"),
    SOON("Use it soon"),
    INACTIVE("Inactive"),
    CHURN("Can be recycled"),
}

val LINKS = listOf("Bank alerts and OTPs", "BVN", "NIN", "Mobile money or wallet", "WhatsApp", "Email or social recovery", "Other apps")
val OPERATORS = listOf("MTN", "Airtel", "Glo", "9mobile", "Other")

data class Line(
    val id: String,
    val label: String,
    val operator: String,
    val number: String,
    val lastUsed: LocalDate,
    val links: Set<String> = emptySet(),
) {
    fun days(today: LocalDate) = ChronoUnit.DAYS.between(lastUsed, today).toInt().coerceAtLeast(0)

    fun stage(today: LocalDate) = days(today).let {
        when {
            it >= Rules.CHURN -> Stage.CHURN
            it > Rules.INACTIVE -> Stage.INACTIVE
            it >= Rules.WARN -> Stage.SOON
            else -> Stage.SAFE
        }
    }

    fun inactiveOn(): LocalDate = lastUsed.plusDays(Rules.INACTIVE.toLong() + 1)
    fun churnOn(): LocalDate = lastUsed.plusDays(Rules.CHURN.toLong())

    /** A masked number for the list, so a shoulder-surfer can't read it. */
    fun masked() = if (number.length >= 7) number.take(4) + " ••• " + number.takeLast(3) else number

    fun toJson(): JSONObject = JSONObject().put("id", id).put("label", label).put("operator", operator).put("number", number)
        .put("lastUsed", lastUsed.toString()).put("links", JSONArray(links.toList()))

    companion object {
        fun fromJson(o: JSONObject) = Line(
            o.getString("id"), o.getString("label"), o.getString("operator"), o.optString("number"),
            LocalDate.parse(o.getString("lastUsed")),
            o.optJSONArray("links")?.let { a -> (0 until a.length()).map { a.getString(it) }.toSet() } ?: emptySet(),
        )

        fun listToJson(lines: List<Line>) = JSONArray(lines.map { it.toJson() }).toString()
        fun listFromJson(s: String?): List<Line> = if (s.isNullOrBlank()) emptyList()
        else JSONArray(s).let { a -> (0 until a.length()).mapNotNull { runCatching { fromJson(a.getJSONObject(it)) }.getOrNull() } }
    }
}
