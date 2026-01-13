package com.expensetracker.sms;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;

/**
 * Native module for SMS permission handling and status checking.
 */
@ReactModule(name = SmsModule.NAME)
public class SmsModule extends ReactContextBaseJavaModule {
    public static final String NAME = "SmsModule";

    public SmsModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Check if SMS read permission is granted
     */
    @ReactMethod
    public void checkSmsPermission(Promise promise) {
        try {
            boolean hasPermission = ContextCompat.checkSelfPermission(
                    getReactApplicationContext(),
                    Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;

            promise.resolve(hasPermission);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to check SMS permission", e);
        }
    }

    /**
     * Check if all required SMS permissions are granted
     */
    @ReactMethod
    public void checkAllSmsPermissions(Promise promise) {
        try {
            boolean hasReceive = ContextCompat.checkSelfPermission(
                    getReactApplicationContext(),
                    Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;

            boolean hasRead = ContextCompat.checkSelfPermission(
                    getReactApplicationContext(),
                    Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;

            promise.resolve(hasReceive && hasRead);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to check SMS permissions", e);
        }
    }

    /**
     * Get all SMS messages from inbox
     */
    @ReactMethod
    public void getAllSms(int limit, Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(getReactApplicationContext(),
                    Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted");
                return;
            }

            WritableArray smsList = Arguments.createArray();
            Uri uriSms = Uri.parse("content://sms/inbox");
            Cursor cursor = getReactApplicationContext().getContentResolver().query(
                    uriSms,
                    new String[] { "_id", "address", "date", "body" },
                    null,
                    null,
                    "date DESC LIMIT " + limit);

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap sms = Arguments.createMap();
                    sms.putString("id", cursor.getString(0));
                    sms.putString("address", cursor.getString(1));
                    sms.putDouble("date", cursor.getLong(2)); // Use double for JS number compatibility
                    sms.putString("body", cursor.getString(3));
                    smsList.pushMap(sms);
                }
                cursor.close();
            }

            promise.resolve(smsList);
        } catch (Exception e) {
            promise.reject("ERROR", "Failed to read SMS inbox", e);
        }
    }
}
