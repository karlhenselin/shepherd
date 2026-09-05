package com.karlhenselin.shepherd;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        hideSystemBars();
        lockWebViewScroll();
    }

    /**
     * Tablets on API 36+ may ignore landscape locks. Handle size/orientation
     * ourselves so the WebView fills the window instead of letterboxing.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        hideSystemBars();
        refreshWebView();
    }

    private void refreshWebView() {
        if (this.bridge == null) {
            return;
        }

        WebView webView = this.bridge.getWebView();

        if (webView == null) {
            return;
        }

        webView.post(() -> {
            webView.requestLayout();
            webView.evaluateJavascript(
                "window.dispatchEvent(new Event('shepherd-viewport'));",
                null
            );
        });
    }

    /** Stop Android WebView rubber-banding from stealing list drags. */
    private void lockWebViewScroll() {
        WebView webView = this.bridge.getWebView();

        if (webView == null) {
            return;
        }

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {
            hideSystemBars();
        }
    }

    /** Immersive sticky: clock bar and nav/back strip stay hidden; a swipe shows them briefly. */
    private void hideSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());

        if (controller == null) {
            return;
        }

        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
    }
}
