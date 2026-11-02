package com.tendays.lightlog

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.text.DateFormat
import java.util.Date

/** Holds the power receiver alive. One quiet notification is the price Android charges for that. */
class WatchService : Service() {

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_POWER_CONNECTED -> PowerLog.record(context, PowerLog.Kind.ON)
                Intent.ACTION_POWER_DISCONNECTED -> PowerLog.record(context, PowerLog.Kind.OFF)
            }
            notifyStatus()
        }
    }

    override fun onCreate() {
        super.onCreate()
        PowerLog.init(this)
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Watching for power cuts", NotificationManager.IMPORTANCE_LOW))
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTE_ID, notification(), type)
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
        }
        ContextCompat.registerReceiver(this, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        syncWithCharger()
    }

    /** If power changed while we were not running (phone off, app updated), record the change as inferred. */
    private fun syncWithCharger() {
        val events = PowerLog.events.value
        val watching = events.lastOrNull { it.kind == PowerLog.Kind.WATCH_START || it.kind == PowerLog.Kind.WATCH_STOP }
        if (watching?.kind != PowerLog.Kind.WATCH_START) PowerLog.record(this, PowerLog.Kind.WATCH_START)
        val now = pluggedIn(this)
        val last = PowerLog.lastPowerState()
        if (last != now) PowerLog.record(this, if (now) PowerLog.Kind.ON else PowerLog.Kind.OFF, inferred = last != null)
        notifyStatus()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        runCatching { unregisterReceiver(receiver) }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun notifyStatus() {
        getSystemService(NotificationManager::class.java).notify(NOTE_ID, notification())
    }

    private fun notification() = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(R.drawable.ic_launcher_foreground)
        .setContentTitle(statusLine())
        .setContentText("Light Log is recording power cuts. Keep the phone on the charger.")
        .setOngoing(true)
        .setSilent(true)
        .setContentIntent(
            PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE),
        )
        .build()

    private fun statusLine(): String {
        val last = PowerLog.events.value.lastOrNull { it.kind == PowerLog.Kind.ON || it.kind == PowerLog.Kind.OFF }
            ?: return "Watching for power cuts"
        val time = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(last.at))
        return if (last.kind == PowerLog.Kind.ON) "Light on since $time" else "No light since $time"
    }

    companion object {
        private const val CHANNEL = "watch"
        private const val NOTE_ID = 1

        fun pluggedIn(context: Context): Boolean {
            val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            return (battery?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
        }

        fun start(context: Context) {
            context.getSharedPreferences(Prefs.NAME, MODE_PRIVATE).edit().putBoolean(Prefs.WATCHING, true).apply()
            ContextCompat.startForegroundService(context, Intent(context, WatchService::class.java))
        }

        fun stop(context: Context) {
            context.getSharedPreferences(Prefs.NAME, MODE_PRIVATE).edit().putBoolean(Prefs.WATCHING, false).apply()
            context.stopService(Intent(context, WatchService::class.java))
            PowerLog.record(context, PowerLog.Kind.WATCH_STOP)
        }
    }
}

object Prefs {
    const val NAME = "lightlog"
    const val WATCHING = "watching"
    const val PROMISED_HOURS = "promised_hours"
    const val SAMPLE = "sample"
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val watching = context.getSharedPreferences(Prefs.NAME, Context.MODE_PRIVATE).getBoolean(Prefs.WATCHING, false)
        if (watching) ContextCompat.startForegroundService(context, Intent(context, WatchService::class.java))
    }
}
