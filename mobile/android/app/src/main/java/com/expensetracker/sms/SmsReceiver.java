package com.expensetracker.sms;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import com.facebook.react.HeadlessJsTaskService;

/**
 * BroadcastReceiver that intercepts incoming SMS messages.
 * Filters for bank transaction SMS and forwards to React Native via HeadlessJS.
 */
public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsReceiver";
    private static final String SMS_RECEIVED_ACTION = "android.provider.Telephony.SMS_RECEIVED";

    // Bank SMS sender IDs - add more as needed
    private static final String[] BANK_SENDER_PREFIXES = {
            "AD-HDFC", "AX-HDFC", "VK-HDFC", // HDFC Bank
            "AD-ICICI", "VK-ICICI", // ICICI Bank
            "AD-SBIINB", "VK-SBIINB", // SBI
            "AD-AXIS", "VK-AXIS", // Axis Bank
            "AD-KOTAK", "VK-KOTAK", // Kotak
            "AD-PAYTM", "VK-PAYTM", // Paytm
            "AD-GPAY", "VK-GPAY", // Google Pay
            "AD-PHONEPE", "VK-PHONEPE", // PhonePe
            "JD-AMZN", "AD-AMAZON", // Amazon Pay
    };

    // Keywords that indicate a transaction SMS
    private static final String[] TRANSACTION_KEYWORDS = {
            "debited", "credited", "spent", "received",
            "withdrawn", "deposited", "transferred",
            "transaction", "INR", "Rs."
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) {
            return;
        }

        try {
            Object[] pdus = (Object[]) bundle.get("pdus");
            String format = bundle.getString("format");

            if (pdus == null) {
                return;
            }

            for (Object pdu : pdus) {
                SmsMessage smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                String sender = smsMessage.getDisplayOriginatingAddress();
                String body = smsMessage.getMessageBody();

                Log.d(TAG, "SMS received from: " + sender);

                if (isBankSms(sender, body)) {
                    Log.i(TAG, "Bank SMS detected, forwarding to React Native");
                    forwardToReactNative(context, sender, body);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing SMS", e);
        }
    }

    /**
     * Check if SMS is from a bank based on sender ID and content
     */
    private boolean isBankSms(String sender, String body) {
        // Check sender ID
        if (sender != null) {
            String upperSender = sender.toUpperCase();
            for (String prefix : BANK_SENDER_PREFIXES) {
                if (upperSender.contains(prefix)) {
                    return true;
                }
            }
        }

        // Check message content for transaction keywords
        if (body != null) {
            String upperBody = body.toUpperCase();
            for (String keyword : TRANSACTION_KEYWORDS) {
                if (upperBody.contains(keyword.toUpperCase())) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Forward SMS to React Native via HeadlessJS task
     */
    private void forwardToReactNative(Context context, String sender, String body) {
        Intent serviceIntent = new Intent(context, SmsHeadlessTaskService.class);
        serviceIntent.putExtra("sender", sender);
        serviceIntent.putExtra("body", body);
        serviceIntent.putExtra("timestamp", System.currentTimeMillis());

        context.startService(serviceIntent);
        HeadlessJsTaskService.acquireWakeLockNow(context);
    }
}
