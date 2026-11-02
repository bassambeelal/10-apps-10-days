package com.tendays.keepnumber

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class LineTest {
    private val today = LocalDate.of(2026, 11, 2)
    private fun line(daysAgo: Long) = Line("a", "Old MTN", "MTN", "08031234567", today.minusDays(daysAgo))

    @Test fun stagesFollowTheNccDays() {
        assertEquals(Stage.SAFE, line(0).stage(today))
        assertEquals(Stage.SAFE, line(149).stage(today))
        assertEquals(Stage.SOON, line(150).stage(today))
        assertEquals(Stage.SOON, line(180).stage(today))   // "over 180 days" makes it inactive, so 180 is still the last safe day
        assertEquals(Stage.INACTIVE, line(181).stage(today))
        assertEquals(Stage.INACTIVE, line(359).stage(today))
        assertEquals(Stage.CHURN, line(360).stage(today))
    }

    @Test fun datesAreWorkedOutFromLastUse() {
        val l = line(10)
        assertEquals(today.minusDays(10).plusDays(181), l.inactiveOn())
        assertEquals(today.minusDays(10).plusDays(360), l.churnOn())
    }

    @Test fun numberIsMasked() {
        assertEquals("0803 ••• 567", line(1).masked())
    }

    @Test fun jsonRoundTrip() {
        val lines = listOf(line(5).copy(links = setOf("BVN", "WhatsApp")), line(200).copy(id = "b", number = ""))
        assertEquals(lines, Line.listFromJson(Line.listToJson(lines)))
    }
}
