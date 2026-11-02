package com.tendays.lightlog

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

/** Light and dark are data here, so they keep fixed colours whatever the wallpaper does to the chrome. */
object Supply {
    val light = Color(0xFFF2A51A)
    val off = Color(0xFF3B3A36)
    val offDark = Color(0xFF8E8A80)
}

private val Light = lightColorScheme(
    primary = Color(0xFF7A4F00),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDDB0),
    onPrimaryContainer = Color(0xFF281800),
    surface = Color(0xFFFFFBF7),
    surfaceVariant = Color(0xFFF1E6D9),
    onSurfaceVariant = Color(0xFF50463A),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFFFB950),
    onPrimary = Color(0xFF412C00),
    primaryContainer = Color(0xFF5D4100),
    onPrimaryContainer = Color(0xFFFFDDB0),
)

@Composable
fun LightLogTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= 31 -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> Dark
        else -> Light
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
