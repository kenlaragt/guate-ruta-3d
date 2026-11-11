package com.guaterutas3d.app;

import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import java.io.InputStream;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final String ONLINE_URL = "https://ais-pre-2ll7lii4dwwvirhke3mxoh-894683888544.us-east1.run.app/";
    private static final String LOCAL_ASSET_URL = "file:///android_asset/index.html";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge fullscreen immersive gaming mode
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemUI();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Hardware accelerated canvas & WebGL
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // JavaScript Interface for Android interop (matching win.cambiarPantalla)
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void cambiarPantalla(String pantalla) {
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Pantalla: " + pantalla, Toast.LENGTH_SHORT).show();
                });
            }

            @JavascriptInterface
            public String getAppVersion() {
                return "1.0.0-gt3";
            }
        }, "AndroidNativeBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Grant microphone permission if user records in Values Studio
                runOnUiThread(() -> {
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                            request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                            return;
                        }
                    }
                    request.deny();
                });
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://ais-") || url.startsWith("file:///android_asset/")) {
                    return false; // Load inside WebView
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // If offline and trying to load online URL, fallback to local bundled assets!
                if (failingUrl != null && failingUrl.startsWith("http")) {
                    view.loadUrl(LOCAL_ASSET_URL);
                }
            }
        });

        // Determine whether to load offline bundled assets or online URL
        boolean hasLocalAsset = false;
        try {
            InputStream is = getAssets().open("index.html");
            is.close();
            hasLocalAsset = true;
        } catch (Exception ignored) {
        }

        if (hasLocalAsset) {
            webView.loadUrl(LOCAL_ASSET_URL);
        } else {
            webView.loadUrl(ONLINE_URL);
        }

        // Handle Back button nicely inside game
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    private void hideSystemUI() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
