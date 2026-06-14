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

    // Bank SMS sender keywords - matches typical DLT headers (e.g., JX-HDFCBK) robustly
    private static final String[] BANK_SENDER_KEYWORDS = {
            "HDFC", "ICICI", "SBI", "AXIS", "KOTAK", "PAYTM", "GPAY", "PHONEPE", "AMZN", "AMAZON",
            "PNB", "IDFC", "YESBNK", "CANARA", "UNIONB", "RBL", "INDZB", "CBSSMS", "BOBSMS", "BOBTXN"
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
        if (sender == null || body == null) {
            return false;
        }

        String upperSender = sender.toUpperCase();
        String upperBody = body.toUpperCase();

        // 1. Check if sender matches any bank keyword
        boolean isFromBank = false;
        for (String keyword : BANK_SENDER_KEYWORDS) {
            if (upperSender.contains(keyword)) {
                isFromBank = true;
                break;
            }
        }

        // 2. Check body content for transaction indicators
        boolean isTransaction = false;
        for (String keyword : TRANSACTION_KEYWORDS) {
            if (upperBody.contains(keyword.toUpperCase())) {
                isTransaction = true;
                break;
            }
        }

        return isFromBank && isTransaction;
    }

    /**
     * Forward SMS to React Native via HeadlessJS task
     */
    private void forwardToReactNative(Context context, String sender, String body) {
        Intent serviceIntent = new Intent(context, SmsHeadlessTaskService.class);
        serviceIntent.putExtra("sender", sender);
        serviceIntent.putExtra("body", body);
        serviceIntent.putExtra("timestamp", System.currentTimeMillis());

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
        HeadlessJsTaskService.acquireWakeLockNow(context);
    }
}
