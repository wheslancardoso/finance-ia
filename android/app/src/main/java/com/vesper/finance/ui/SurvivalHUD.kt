package com.vesper.finance.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SurvivalHUD(
    healthScore: Int,
    currentSurplus: Long,
    projectedSurplus: Long
) {
    val healthColor = when {
        healthScore >= 80 -> Color(0xFF10B981)
        healthScore >= 50 -> Color(0xFFF59E0B)
        else -> Color(0xFFEF4444)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0x1AFFFFFF), Color(0x05FFFFFF))
                ),
                shape = RoundedCornerShape(32.dp)
            )
            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(32.dp))
            .padding(24.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "SURVIVAL HUD",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0x66FFFFFF),
                fontWeight = FontWeight.Black,
                letterSpacing = 2.sp
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Health Circle (Simplified)
            Box(contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    progress = healthScore / 100f,
                    modifier = Modifier.size(120.dp),
                    color = healthColor,
                    strokeWidth = 8.dp,
                    trackColor = Color(0x1AFFFFFF)
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$healthScore",
                        style = MaterialTheme.typography.displayMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "SCORE",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0x33FFFFFF),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "SOBRA ATUAL",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0x33FFFFFF),
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "R$ ${currentSurplus / 100},${(currentSurplus % 100).toString().padStart(2, '0')}",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Black
                    )
                }
                
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "PROJEÇÃO",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0x33FFFFFF),
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "R$ ${projectedSurplus / 100},${(projectedSurplus % 100).toString().padStart(2, '0')}",
                        style = MaterialTheme.typography.titleLarge,
                        color = healthColor,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        }
    }
}
