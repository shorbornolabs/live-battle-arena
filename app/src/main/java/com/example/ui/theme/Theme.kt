package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val CyberColorScheme = darkColorScheme(
  primary = NeonCyan,
  onPrimary = Color.Black,
  secondary = NeonPink,
  onSecondary = Color.White,
  tertiary = NeonGold,
  background = CyberDarkBg,
  onBackground = Color.White,
  surface = CyberCardSurface,
  onSurface = Color.White,
)

@Composable
fun MyApplicationTheme(
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = CyberColorScheme,
    typography = Typography,
    content = content
  )
}
