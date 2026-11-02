package com.tendays.proofpack

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

sealed interface Screen {
    data object List : Screen
    data object New : Screen
    data class Open(val id: String, val phase: Int = 0) : Screen
}

class MainActivity : ComponentActivity() {
    private lateinit var store: Store
    private var packs by mutableStateOf(emptyList<Pack>())
    private var screen by mutableStateOf<Screen>(Screen.List)
    private var useLocation by mutableStateOf(false)
    private var busy by mutableStateOf(false)
    private var pending: Triple<String, Int, Int>? = null // pack id, phase, shot index
    private var pendingFile: File? = null

    private val camera = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok -> onPhoto(ok) }
    private val askLocation = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        useLocation = r.values.any { it }
        getPreferences(MODE_PRIVATE).edit().putBoolean("location", useLocation).apply()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        store = Store(this)
        packs = store.all()
        useLocation = getPreferences(MODE_PRIVATE).getBoolean("location", false) && hasLocation()
        savedInstanceState?.getString("pending")?.split('|')?.let { p -> if (p.size == 4) { pending = Triple(p[0], p[1].toInt(), p[2].toInt()); pendingFile = File(p[3]) } }
        setContent {
            ProofPackTheme {
                BackHandler(enabled = screen != Screen.List) { screen = Screen.List }
                when (val s = screen) {
                    Screen.List -> PackList(packs, onOpen = { screen = Screen.Open(it) }, onNew = { screen = Screen.New })
                    Screen.New -> NewPack(onCreate = ::create, onCancel = { screen = Screen.List })
                    is Screen.Open -> packs.firstOrNull { it.id == s.id }?.let { pack ->
                        PackScreen(
                            pack = pack, phase = s.phase, store = store, useLocation = useLocation, busy = busy,
                            onPhase = { screen = s.copy(phase = it) },
                            onShoot = { index -> shoot(pack, s.phase, index) },
                            onNote = { index, note -> update(pack.withShot(s.phase, index, pack.phases[s.phase].shots[index].copy(note = note))) },
                            onExtra = { label -> update(pack.withExtra(s.phase, label)) },
                            onLocation = ::toggleLocation,
                            onExport = { export(pack) },
                            onDelete = { store.delete(pack.id); packs = store.all(); screen = Screen.List },
                            onBack = { screen = Screen.List },
                        )
                    }
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        // The camera app can push us out of memory; remember which shot it was for.
        pending?.let { (id, ph, i) -> outState.putString("pending", "$id|$ph|$i|${pendingFile?.path}") }
    }

    private fun create(kind: Kind, title: String, place: String) {
        val p = Pack.new(UUID.randomUUID().toString().take(8), kind, title, place, System.currentTimeMillis())
        store.save(p)
        packs = store.all()
        screen = Screen.Open(p.id)
    }

    private fun update(p: Pack) {
        store.save(p)
        packs = packs.map { if (it.id == p.id) p else it }
    }

    private fun shoot(pack: Pack, phase: Int, index: Int) {
        val file = store.photo(pack, "p$phase-s$index-${System.currentTimeMillis()}.jpg")
        pending = Triple(pack.id, phase, index)
        pendingFile = file
        val uri: Uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        try { camera.launch(uri) } catch (e: ActivityNotFoundException) { Toast.makeText(this, "No camera app found on this phone.", Toast.LENGTH_LONG).show() }
    }

    private fun onPhoto(ok: Boolean) {
        val (id, phase, index) = pending ?: return
        val file = pendingFile ?: return
        pending = null; pendingFile = null
        if (!ok || !file.exists() || file.length() == 0L) { file.delete(); return }
        val takenAt = System.currentTimeMillis()
        val where = if (useLocation) lastLocation() else null
        lifecycleScope.launch {
            val hash = withContext(Dispatchers.IO) { sha256(file.readBytes()) }
            val pack = store.all().firstOrNull { it.id == id } ?: return@launch
            pack.phases[phase].shots[index].file?.let { old -> store.photo(pack, old).delete() } // a retake replaces the old photo
            update(pack.withShot(phase, index, pack.phases[phase].shots[index].copy(file = file.name, takenAt = takenAt, sha256 = hash, lat = where?.latitude, lon = where?.longitude)))
        }
    }

    private fun hasLocation() = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun toggleLocation(on: Boolean) {
        if (on && !hasLocation()) askLocation.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        else { useLocation = on; getPreferences(MODE_PRIVATE).edit().putBoolean("location", on).apply() }
    }

    /** The freshest fix the phone already has, if it's under ten minutes old. No waiting, no network calls. */
    @SuppressLint("MissingPermission")
    private fun lastLocation(): Location? {
        if (!hasLocation()) return null
        val lm = getSystemService(LocationManager::class.java)
        return lm.getProviders(true).mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .filter { System.currentTimeMillis() - it.time < 10 * 60_000 }
            .minByOrNull { it.accuracy }
    }

    private fun export(pack: Pack) {
        busy = true
        lifecycleScope.launch {
            val out = File(cacheDir, "exports/Proof Pack - ${pack.title.replace(Regex("[^A-Za-z0-9 ,.-]"), "")}.pdf")
            val made = withContext(Dispatchers.IO) { runCatching { Pdf.write(pack, store, out) } }
            busy = false
            made.onSuccess {
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", out)
                val send = Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri)
                    .putExtra(Intent.EXTRA_SUBJECT, "Proof Pack: ${pack.title}").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                startActivity(Intent.createChooser(send, "Send the PDF"))
            }.onFailure { Toast.makeText(this@MainActivity, "Couldn't make the PDF: ${it.message}", Toast.LENGTH_LONG).show() }
        }
    }
}
