package com.tendays.proofpack

import android.content.Context
import org.json.JSONObject
import java.io.File

/** Each pack is a folder: pack.json plus the original photos, untouched, so their fingerprints keep matching. */
class Store(context: Context) {
    val root = File(context.filesDir, "packs").apply { mkdirs() }

    fun dir(id: String) = File(root, id).apply { mkdirs() }

    fun all(): List<Pack> = root.listFiles().orEmpty()
        .mapNotNull { f -> runCatching { Pack.fromJson(JSONObject(File(f, "pack.json").readText())) }.getOrNull() }
        .sortedByDescending { it.createdAt }

    fun save(p: Pack) {
        val tmp = File(dir(p.id), "pack.json.tmp")
        tmp.writeText(p.toJson().toString())
        tmp.renameTo(File(dir(p.id), "pack.json"))
    }

    fun delete(id: String) = File(root, id).deleteRecursively()

    fun photo(p: Pack, name: String) = File(dir(p.id), name)
}
