package com.expensetracker.pdf

import android.content.Context
import android.os.Environment
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.*
import com.facebook.react.bridge.UiThreadUtil
import java.io.File

class PdfModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PdfGenerator"
    }

    @ReactMethod
    fun convert(html: String, fileName: String, promise: Promise) {
        val context = reactApplicationContext

        UiThreadUtil.runOnUiThread {
            val webView = WebView(context)
            webView.webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    createPdf(view, fileName, promise)
                }
            }
            webView.loadDataWithBaseURL(null, html, "text/HTML", "UTF-8", null)
        }
    }

    private fun createPdf(webView: WebView, fileName: String, promise: Promise) {
        try {
            val path = File(reactApplicationContext.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), "$fileName.pdf")
            if (path.exists()) {
                path.delete()
            }
            path.parentFile?.mkdirs()
            path.createNewFile()
            
            val printAttributes = android.print.PrintAttributes.Builder()
                .setMediaSize(android.print.PrintAttributes.MediaSize.ISO_A4)
                .setResolution(android.print.PrintAttributes.Resolution("pdf", "pdf", 600, 600))
                .setMinMargins(android.print.PrintAttributes.Margins.NO_MARGINS)
                .build()

            val adapter = webView.createPrintDocumentAdapter("ExpenseReport")

            android.print.PdfPrintHelper.print(adapter, printAttributes, path, object : android.print.PdfPrintHelper.PdfCallback {
                override fun onSuccess(pathName: String) {
                    promise.resolve(pathName)
                }

                override fun onFailure(error: String) {
                    promise.reject("PDF_GEN_FAILED", error)
                }
            })
            
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
