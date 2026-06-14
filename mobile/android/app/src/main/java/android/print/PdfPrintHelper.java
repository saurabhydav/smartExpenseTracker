package android.print;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PrintDocumentAdapter;
import android.print.PrintAttributes;
import android.print.PrintDocumentInfo;
import android.print.PageRange;
import java.io.File;

public class PdfPrintHelper {
    public interface PdfCallback {
        void onSuccess(String path);
        void onFailure(String error);
    }

    public static void print(final PrintDocumentAdapter adapter, final PrintAttributes attributes, final File file, final PdfCallback callback) {
        adapter.onLayout(null, attributes, null, new PrintDocumentAdapter.LayoutResultCallback() {
            @Override
            public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                try {
                    ParcelFileDescriptor pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_WRITE);
                    adapter.onWrite(new PageRange[]{PageRange.ALL_PAGES}, pfd, new CancellationSignal(), new PrintDocumentAdapter.WriteResultCallback() {
                        @Override
                        public void onWriteFinished(PageRange[] pages) {
                            try {
                                pfd.close();
                                callback.onSuccess(file.getAbsolutePath());
                            } catch (Exception e) {
                                callback.onFailure("Failed to close descriptor: " + e.getMessage());
                            }
                        }

                        @Override
                        public void onWriteFailed(CharSequence error) {
                            try {
                                pfd.close();
                            } catch (Exception e) {}
                            callback.onFailure(error != null ? error.toString() : "Failed to write PDF");
                        }

                        @Override
                        public void onWriteCancelled() {
                            try {
                                pfd.close();
                            } catch (Exception e) {}
                            callback.onFailure("PDF write cancelled");
                        }
                    });
                } catch (Exception e) {
                    callback.onFailure("Failed to open file descriptor: " + e.getMessage());
                }
            }

            @Override
            public void onLayoutFailed(CharSequence error) {
                callback.onFailure(error != null ? error.toString() : "Failed to layout PDF");
            }
        }, null);
    }
}
