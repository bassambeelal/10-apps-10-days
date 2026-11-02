package com.tendays.lettersorter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class LetterReaderTest {
    private val today = LocalDate.of(2026, 11, 2)

    @Test fun disconnectionNoticeIsActWithDateAndAmount() {
        val text = """
            IKEJA ELECTRIC
            FINAL NOTICE BEFORE DISCONNECTION
            Account: 0123456789
            Bill date: 20/10/2026
            Outstanding balance: ₦48,350.75
            Please pay on or before 12/11/2026 to avoid disconnection.
        """.trimIndent()
        val r = LetterReader.read(text, today)
        assertEquals(Pile.ACT, r.pile)
        assertEquals(LocalDate.of(2026, 11, 12), r.due)
        assertEquals("₦48,350.75", r.amount)
        assertEquals("IKEJA ELECTRIC", r.from)
    }

    @Test fun writtenDatesAndPoundsAreRead() {
        val r = LetterReader.read("Council Tax\nAmount due £1,204.00\nPayment due 3rd December 2026", today)
        assertEquals(Pile.ACT, r.pile)
        assertEquals(LocalDate.of(2026, 12, 3), r.due)
        assertEquals("£1,204.00", r.amount)
    }

    @Test fun receiptIsFiled() {
        val r = LetterReader.read("GTBank\nPayment received\nThank you for your payment of NGN 15,000 on 01/11/2026\nKeep this receipt for your records", today)
        assertEquals(Pile.FILE, r.pile)
    }

    @Test fun advertIsBinned() {
        val r = LetterReader.read("Mega Store\nSPECIAL OFFER! 50% discount\nLimited time only. Unsubscribe at any time.", today)
        assertEquals(Pile.BIN, r.pile)
    }

    @Test fun nothingClearMeansHaveALook() {
        val r = LetterReader.read("Dear customer\nWe are updating our terms and conditions.", today)
        assertEquals(Pile.LOOK, r.pile)
        assertNull(r.due)
    }

    @Test fun datesAreDayFirstUnlessImpossible() {
        val d = LetterReader.dates("on 05/11/2026 and 11/25/2026 and 2026-12-31 and Nov 9, 2026").map { it.date }
        assertTrue(LocalDate.of(2026, 11, 5) in d)   // 05/11 is 5 November
        assertTrue(LocalDate.of(2026, 11, 25) in d)  // 11/25 can only be 25 November
        assertTrue(LocalDate.of(2026, 12, 31) in d)
        assertTrue(LocalDate.of(2026, 11, 9) in d)
    }

    @Test fun oldDatesAreNotDueDates() {
        val r = LetterReader.read("Statement for 01/01/2025\nOverdue amount N2,000", today)
        assertEquals(Pile.ACT, r.pile)
        assertNull(r.due)
        assertEquals("N2,000", r.amount)
    }
}
