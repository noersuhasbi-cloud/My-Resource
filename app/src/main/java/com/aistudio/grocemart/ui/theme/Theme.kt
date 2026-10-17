package com.aistudio.grocemart.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = EmeraldPrimary,
    onPrimary = PureWhite,
    primaryContainer = EmeraldContainer,
    onPrimaryContainer = OnEmeraldContainer,
    secondary = AmberAccent,
    onSecondary = PureWhite,
    secondaryContainer = AmberContainer,
    onSecondaryContainer = OnAmberContainer,
    background = Stone50,
    onBackground = Stone900,
    surface = PureWhite,
    onSurface = Stone900,
    surfaceVariant = Stone100,
    onSurfaceVariant = Stone600,
    outline = Stone300
)

@Composable
fun GroceMartTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography,
        content = content
    )
}
