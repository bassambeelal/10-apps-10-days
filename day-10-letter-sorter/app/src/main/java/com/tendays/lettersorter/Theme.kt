package com.tendays.lettersorter

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp

private val Light = lightColorScheme(
    primary = Color(0xFF3D5A40),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD9E8D5),
    onPrimaryContainer = Color(0xFF0E1F10),
    surface = Color(0xFFFAFAF7),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFB5D3AE),
    onPrimary = Color(0xFF0E1F10),
    primaryContainer = Color(0xFF2C4430),
    onPrimaryContainer = Color(0xFFD9E8D5),
)

/** Letters are stressful to read, so the answer is set large and calm. */
private val Larger = Typography().let { t ->
    t.copy(bodyLarge = t.bodyLarge.merge(TextStyle(fontSize = 18.sp, lineHeight = 28.sp)))
}

@Composable
fun SorterTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= 31 -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> Dark
        else -> Light
    }
    MaterialTheme(colorScheme = scheme, typography = Larger, content = content)
}
