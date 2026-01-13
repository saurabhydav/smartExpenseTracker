package com.expensetracker.sms;

import android.content.Intent;
import android.os.Bundle;

import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

import javax.annotation.Nullable;

/**
 * HeadlessJS service for processing SMS in the background.
 * This runs the React Native task even when the app is in background.
 */
public class SmsHeadlessTaskService extends HeadlessJsTaskService {

    @Nullable
    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Intent intent) {
        Bundle extras = intent.getExtras();

        if (extras == null) {
            return null;
        }

        WritableMap data = Arguments.createMap();
        data.putString("sender", extras.getString("sender", ""));
        data.putString("body", extras.getString("body", ""));
        data.putDouble("timestamp", extras.getLong("timestamp", System.currentTimeMillis()));

        return new HeadlessJsTaskConfig(
                "SmsReceivedTask", // Task name registered in React Native
                data,
                5000, // Timeout in ms
                true // Allow task in foreground
        );
    }
}
