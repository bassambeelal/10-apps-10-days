package com.tendays.proofpack

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
    primary = Color(0xFF1F3A5F),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD6E3F5),
    onPrimaryContainer = Color(0xFF0A1A2E),
    surface = Color(0xFFFAFAF7),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFA9C7EE),
    onPrimary = Color(0xFF0A1A2E),
    primaryContainer = Color(0xFF23415F),
    onPrimaryContainer = Color(0xFFD6E3F5),
)

/** Labels on a checklist are read at arm's length in a car park, so body text is set a step larger. */
private val Reading = Typography().let { t ->
    t.copy(bodyLarge = t.bodyLarge.merge(TextStyle(fontSize = 18.sp, lineHeight = 28.sp)))
}

@Composable
fun ProofPackTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= 31 -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> Dark
        else -> Light
    }
    MaterialTheme(colorScheme = scheme, typography = Reading, content = content)
}
