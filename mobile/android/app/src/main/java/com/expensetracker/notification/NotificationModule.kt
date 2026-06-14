package com.expensetracker.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*

class NotificationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "NotificationModule"
    }

    @ReactMethod
    fun showNotification(title: String, message: String, notificationId: Int) {
        val context = reactApplicationContext
        val channelId = "expense_tracker_alerts"
        val channelName = "Expense Tracker Alerts"
        
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = "Alerts and reminders from Expense Tracker"
            notificationManager.createNotificationChannel(channel)
        }
        
        val iconId = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
        val smallIcon = if (iconId != 0) iconId else android.R.drawable.ic_dialog_info
        
        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            
        notificationManager.notify(notificationId, builder.build())
    }
}
