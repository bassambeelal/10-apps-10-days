package com.tendays.proofpack

import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

enum class Kind(val label: String, val phases: List<String>, val shots: List<String>) {
    CAR(
        "Rental car", listOf("Pickup", "Return"),
        listOf(
            "Number plate", "Front", "Front left corner", "Left side", "Rear left corner", "Back", "Rear right corner",
            "Right side", "Front right corner", "Windscreen", "Wheels and tyres", "Odometer (mileage)", "Fuel gauge",
            "Front seats", "Back seats", "Boot",
        ),
    ),
    HOME(
        "Moving in or out", listOf("Moving in", "Moving out"),
        listOf(
            "Front door and lock", "Keys handed over", "Living room walls", "Living room floor", "Windows and burglary proof",
            "Ceilings", "Kitchen", "Bathroom", "Toilet", "Bedroom", "Electricity meter reading", "Water and plumbing",
            "Anything already damaged",
        ),
    ),
}

data class Shot(
    val label: String,
    val file: String? = null,
    val takenAt: Long? = null,
    val sha256: String? = null,
    val lat: Double? = null,
    val lon: Double? = null,
    val note: String = "",
) {
    val done get() = file != null
}

data class Phase(val name: String, val shots: List<Shot>) {
    val doneCount get() = shots.count { it.done }
    val startedAt get() = shots.mapNotNull { it.takenAt }.minOrNull()
    val endedAt get() = shots.mapNotNull { it.takenAt }.maxOrNull()
}

data class Pack(val id: String, val kind: Kind, val title: String, val place: String, val createdAt: Long, val phases: List<Phase>) {
    fun withShot(phase: Int, index: Int, shot: Shot) = copy(
        phases = phases.mapIndexed { p, ph -> if (p != phase) ph else ph.copy(shots = ph.shots.mapIndexed { i, s -> if (i == index) shot else s }) },
    )

    fun withExtra(phase: Int, label: String) = copy(
        phases = phases.mapIndexed { p, ph -> if (p != phase) ph else ph.copy(shots = ph.shots + Shot(label)) },
    )

    fun toJson(): JSONObject = JSONObject()
        .put("id", id).put("kind", kind.name).put("title", title).put("place", place).put("createdAt", createdAt)
        .put("phases", JSONArray(phases.map { ph ->
            JSONObject().put("name", ph.name).put("shots", JSONArray(ph.shots.map { s ->
                JSONObject().put("label", s.label).put("file", s.file ?: JSONObject.NULL).put("takenAt", s.takenAt ?: JSONObject.NULL)
                    .put("sha256", s.sha256 ?: JSONObject.NULL).put("lat", s.lat ?: JSONObject.NULL).put("lon", s.lon ?: JSONObject.NULL).put("note", s.note)
            }))
        }))

    companion object {
        fun new(id: String, kind: Kind, title: String, place: String, now: Long) =
            Pack(id, kind, title, place, now, kind.phases.map { name -> Phase(name, kind.shots.map { Shot(it) }) })

        fun fromJson(o: JSONObject): Pack {
            fun JSONObject.str(k: String) = if (isNull(k)) null else getString(k)
            fun JSONObject.long(k: String) = if (isNull(k)) null else getLong(k)
            fun JSONObject.dbl(k: String) = if (isNull(k)) null else getDouble(k)
            val phases = o.getJSONArray("phases").let { arr ->
                (0 until arr.length()).map { i ->
                    val ph = arr.getJSONObject(i)
                    val shots = ph.getJSONArray("shots").let { sa ->
                        (0 until sa.length()).map { j ->
                            val s = sa.getJSONObject(j)
                            Shot(s.getString("label"), s.str("file"), s.long("takenAt"), s.str("sha256"), s.dbl("lat"), s.dbl("lon"), s.optString("note"))
                        }
                    }
                    Phase(ph.getString("name"), shots)
                }
            }
            return Pack(o.getString("id"), Kind.valueOf(o.getString("kind")), o.getString("title"), o.optString("place"), o.getLong("createdAt"), phases)
        }
    }
}

fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
