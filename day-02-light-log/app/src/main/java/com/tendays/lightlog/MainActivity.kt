package com.tendays.lightlog

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class MainActivity : ComponentActivity() {

    private var watching by mutableStateOf(false)
    private var unrestricted by mutableStateOf(true)

    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        // Watching works either way; without the permission Android just hides the notification.
        startWatching()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        PowerLog.init(this)
        val prefs = getSharedPreferences(Prefs.NAME, Context.MODE_PRIVATE)
        watching = prefs.getBoolean(Prefs.WATCHING, false)
        // The service may have been killed while the setting still says "watching": bring it back.
        if (watching) WatchService.start(this)
        setContent {
            LightLogTheme {
                LightLogScreen(
                    watching = watching,
                    unrestricted = unrestricted,
                    onStart = ::requestStart,
                    onStop = { WatchService.stop(this); watching = false },
                    onAllowBackground = ::openBatterySettings,
                    onShare = ::shareReport,
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        unrestricted = getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)
    }

    private fun requestStart() {
        if (Build.VERSION.SDK_INT >= 33) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS) else startWatching()
    }

    private fun startWatching() {
        val prefs = getSharedPreferences(Prefs.NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(Prefs.SAMPLE, false)) {
            PowerLog.replaceAll(this, emptyList())
            prefs.edit().putBoolean(Prefs.SAMPLE, false).apply()
        }
        WatchService.start(this)
        watching = true
    }

    private fun openBatterySettings() {
        runCatching { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
            .onFailure { startActivity(Intent(Settings.ACTION_SETTINGS)) }
    }

    private fun shareReport(text: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, "Power supply record")
            .putExtra(Intent.EXTRA_TEXT, text)
        startActivity(Intent.createChooser(send, "Share the report"))
    }
}
