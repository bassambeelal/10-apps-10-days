package com.tendays.proofpack

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ModelTest {
    @Test fun newPackHasBothPhasesWithTheFullList() {
        val p = Pack.new("a", Kind.CAR, "Corolla", "Hertz", 1L)
        assertEquals(listOf("Pickup", "Return"), p.phases.map { it.name })
        assertEquals(Kind.CAR.shots.size, p.phases[1].shots.size)
    }

    @Test fun takingAShotOnlyChangesThatShot() {
        val p = Pack.new("a", Kind.HOME, "Flat 3", "", 1L)
        val q = p.withShot(0, 2, p.phases[0].shots[2].copy(file = "x.jpg", takenAt = 5L, sha256 = "abc"))
        assertEquals(1, q.phases[0].doneCount)
        assertEquals(0, q.phases[1].doneCount)
        assertEquals(5L, q.phases[0].startedAt)
    }

    @Test fun jsonRoundTripKeepsEverything() {
        val p = Pack.new("a", Kind.CAR, "Corolla", "Hertz", 1L)
            .withShot(1, 0, Shot("Number plate", "p1.jpg", 10L, "ff00", 6.5244, 3.3792, "already scratched"))
            .withExtra(0, "Spare tyre")
        val back = Pack.fromJson(JSONObject(p.toJson().toString()))
        assertEquals(p, back)
    }

    @Test fun fingerprintIsSha256AndChangesWithOneByte() {
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", sha256(ByteArray(0)))
        assertNotEquals(sha256(byteArrayOf(1, 2, 3)), sha256(byteArrayOf(1, 2, 4)))
    }
}
