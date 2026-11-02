package com.tendays.voicenotes

import org.junit.Assert.assertEquals
import org.junit.Test

class LogicTest {
    @Test fun downsample48kTo16kKeepsLength() {
        val input = ShortArray(48_000) { (it % 100).toShort() }
        assertEquals(16_000, Resample.linear(input, 48_000, 16_000).size)
    }

    @Test fun sameRateIsUntouched() {
        val input = shortArrayOf(1, 2, 3)
        assertEquals(input.toList(), Resample.linear(input, 16_000, 16_000).toList())
    }

    @Test fun upsampleInterpolates() {
        val out = Resample.linear(shortArrayOf(0, 100), 8_000, 16_000)
        assertEquals(listOf<Short>(0, 50, 100, 100), out.toList())
    }

    @Test fun segmentsJoinIntoSentences() {
        assertEquals("Hello there.", Transcriber.join("", "hello there"))
        assertEquals("Hello there. Are you coming?", Transcriber.join("Hello there.", "are you coming?"))
    }

    @Test fun builderGrowsPastItsFirstBlock() {
        val b = ShortBuilder()
        repeat(200_000) { b.add((it % 7).toShort()) }
        assertEquals(200_000, b.toArray().size)
        assertEquals(6.toShort(), b.toArray()[6])
    }
}
