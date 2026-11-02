package com.tendays.keepnumber

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import java.time.LocalDate

object Store {
    private const val PREFS = "keep"
    fun load(c: Context) = Line.listFromJson(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("lines", null))
    fun save(c: Context, lines: List<Line>) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("lines", Line.listToJson(lines)).apply()
}

/** Once a day, Android wakes this receiver; it posts a notification for any line that needs using. No internet. */
object Reminders {
    private const val CHANNEL = "lines"

    fun schedule(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(c, 0, Intent(c, CheckReceiver::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + AlarmManager.INTERVAL_HOUR, AlarmManager.INTERVAL_DAY, pi)
    }

    fun check(c: Context, today: LocalDate = LocalDate.now()) {
        val due = Store.load(c).filter { it.stage(today) != Stage.SAFE }
        if (due.isEmpty()) return
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Lines that need using", NotificationManager.IMPORTANCE_DEFAULT))
        val worst = due.maxBy { it.days(today) }
        val text = if (due.size == 1) "${worst.label}: ${worst.days(today)} days without use. Make a call, send an SMS or use a little data."
        else "${due.size} lines need using. ${worst.label} is at ${worst.days(today)} days."
        val open = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        nm.notify(1, NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(if (worst.stage(today) == Stage.SOON) "Use your ${worst.operator} line soon" else "A line may be recycled")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build())
    }
}

class CheckReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) Reminders.schedule(context)
        else Reminders.check(context)
    }
}
