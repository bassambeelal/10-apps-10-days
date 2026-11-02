package com.tendays.lightlog

import com.tendays.lightlog.PowerLog.Event
import com.tendays.lightlog.PowerLog.Kind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class PowerLogTest {
    private val zone = ZoneOffset.UTC
    private val day = LocalDate.of(2026, 11, 2)
    private fun t(h: Int, m: Int = 0, s: Int = 0) = day.atTime(h, m, s).toInstant(zone).toEpochMilli()
    private val min = 60_000L

    @Test fun oneCutIsOneOutage() {
        val e = listOf(Event(t(0), Kind.WATCH_START), Event(t(0), Kind.ON), Event(t(9, 12), Kind.OFF), Event(t(12, 52), Kind.ON))
        val o = PowerLog.outages(e)
        assertEquals(1, o.size)
        assertEquals(t(9, 12), o[0].start)
        assertEquals(t(12, 52), o[0].end)
    }

    @Test fun flickerUnderAMinuteIsDropped() {
        val e = listOf(Event(t(0), Kind.ON), Event(t(10), Kind.OFF), Event(t(10, 0, 40), Kind.ON))
        assertTrue(PowerLog.outages(e).isEmpty())
    }

    @Test fun shortRestoreInsideACutIsMerged() {
        // off 10:00, back for 90 s at 11:00, off again until 12:00: one cut of two hours
        val e = listOf(
            Event(t(0), Kind.ON), Event(t(10), Kind.OFF), Event(t(11), Kind.ON),
            Event(t(11, 1, 30), Kind.OFF), Event(t(12), Kind.ON),
        )
        val o = PowerLog.outages(e)
        assertEquals(1, o.size)
        assertEquals(2 * 60 * min, o[0].end!! - o[0].start)
    }

    @Test fun ongoingCutHasNoEnd() {
        val e = listOf(Event(t(0), Kind.ON), Event(t(20), Kind.OFF))
        assertNull(PowerLog.outages(e).single().end)
    }

    @Test fun stoppingDuringACutEndsItAsApproximate() {
        val e = listOf(Event(t(0), Kind.ON), Event(t(8), Kind.OFF), Event(t(9), Kind.WATCH_STOP))
        val o = PowerLog.outages(e).single()
        assertEquals(t(9), o.end)
        assertTrue(o.approx)
    }

    @Test fun dayCountsLightOnlyWhileWatching() {
        // watched from 06:00 to 18:00 (12 h), one cut of 3 h inside: 9 h of light
        val e = listOf(
            Event(t(6), Kind.WATCH_START), Event(t(6), Kind.ON),
            Event(t(9), Kind.OFF), Event(t(12), Kind.ON), Event(t(18), Kind.WATCH_STOP),
        )
        val d = PowerLog.day(day, e, PowerLog.outages(e), now = t(23), zone = zone)
        assertEquals(12 * 60 * min, d.watchedMs)
        assertEquals(9 * 60 * min, d.lightMs)
        assertEquals(1, d.cuts)
    }

    @Test fun cutAcrossMidnightCountsTowardsBothDays() {
        val e = listOf(Event(t(0), Kind.WATCH_START), Event(t(0), Kind.ON), Event(t(22), Kind.OFF), Event(t(23, 59, 59) + 1000 + 2 * 3_600_000, Kind.ON))
        val o = PowerLog.outages(e)
        val now = t(23, 59, 59) + 1000 + 24 * 3_600_000
        val d1 = PowerLog.day(day, e, o, now, zone)
        val d2 = PowerLog.day(day.plusDays(1), e, o, now, zone)
        assertEquals(2 * 60 * min, d1.offMs)
        assertEquals(2 * 60 * min, d2.offMs)
        assertEquals(1, d1.cuts)
        assertEquals(0, d2.cuts)
    }

    @Test fun sampleWeekHasCutsEveryDay() {
        val now = t(23)
        val e = PowerLog.sampleWeek(now, zone)
        val o = PowerLog.outages(e)
        for (i in 0L..6L) assertTrue(PowerLog.day(day.minusDays(i), e, o, now, zone).cuts >= 1)
    }
}
