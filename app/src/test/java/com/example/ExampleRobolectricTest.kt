package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ExampleRobolectricTest {

  @Test
  fun `read string from context`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val appName = context.getString(R.string.app_name)
    assertEquals("Neon Arena", appName)
  }

  @Test
  fun `verify index html exists in assets`() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val html = context.assets.open("index.html").bufferedReader().use { it.readText() }
    assert(html.contains("Neon Auto Arena"))
  }
}
