package com.example

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Keep screen turned on 24/7 for continuous autonomous live-stream execution
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    enableEdgeToEdge()

    setContent {
      MyApplicationTheme {
        Scaffold(
          modifier = Modifier
            .fillMaxSize()
            .testTag("neon_arcade_main_screen"),
          containerColor = Color(0xFF030508),
          contentWindowInsets = WindowInsets.safeDrawing
        ) { innerPadding ->
          NeonArcadeScreen(
            modifier = Modifier
              .fillMaxSize()
              .padding(innerPadding)
              .background(Color(0xFF030508))
          )
        }
      }
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun NeonArcadeScreen(modifier: Modifier = Modifier) {
  val context = LocalContext.current
  var webViewInstance: WebView? = remember { null }

  BackHandler {
    webViewInstance?.evaluateJavascript(
      """
      (function() {
        var modal = document.getElementById('games-modal');
        var drawer = document.getElementById('control-drawer');
        if (modal && modal.classList.contains('open')) {
          modal.classList.remove('open');
          return;
        }
        if (drawer && drawer.classList.contains('open')) {
          drawer.classList.remove('open');
          return;
        }
      })();
      """.trimIndent(),
      null
    )
  }

  Box(
    modifier = modifier,
    contentAlignment = Alignment.Center
  ) {
    AndroidView(
      modifier = Modifier
        .fillMaxSize()
        .testTag("neon_arcade_webview"),
      factory = { ctx ->
        WebView(ctx).apply {
          layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
          )
          webViewInstance = this
          setBackgroundColor(AndroidColor.parseColor("#07090F"))
          setLayerType(View.LAYER_TYPE_HARDWARE, null)

          settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mediaPlaybackRequiresUserGesture = false
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
          }

          webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
              Log.d("NeonArcadeJS", "${consoleMessage?.message()} (line ${consoleMessage?.lineNumber()})")
              return true
            }
          }

          webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
              super.onReceivedError(view, request, error)
              Log.e("NeonArcade", "WebView error: ${error?.description} on ${request?.url}")
            }
          }

          // Direct load from APK assets to ensure instant reliable rendering
          try {
            val htmlContent = ctx.assets.open("index.html").bufferedReader().use { it.readText() }
            loadDataWithBaseURL("file:///android_asset/", htmlContent, "text/html", "UTF-8", null)
          } catch (e: Exception) {
            Log.e("NeonArcade", "Failed to load index.html from assets", e)
            loadUrl("file:///android_asset/index.html")
          }
        }
      },
      update = { view ->
        webViewInstance = view
      }
    )
  }

  DisposableEffect(Unit) {
    onDispose {
      webViewInstance?.destroy()
    }
  }
}
