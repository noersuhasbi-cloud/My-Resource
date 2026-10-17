package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.grocemart.data.MockData
import com.aistudio.grocemart.model.Milestone
import com.aistudio.grocemart.ui.theme.*

@Composable
fun HeritageScreen(modifier: Modifier = Modifier) {
    val milestones = MockData.COMPANY_MILESTONES
    val context = LocalContext.current
    val farmDrawableId = context.resources.getIdentifier("about_heritage_farm", "drawable", context.packageName)

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Stone50)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Hero Story Card
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth().testTag("heritage_story_card")
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    if (farmDrawableId != 0) {
                        Image(
                            painter = painterResource(id = farmDrawableId),
                            contentDescription = "Heritage Farm",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp)
                                .clip(RoundedCornerShape(12.dp))
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                    }

                    Surface(color = AmberContainer, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            text = "OUR HERITAGE STORY · 1998 TO 2026",
                            color = OnAmberContainer,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "From a 30 sqm Bandung Stall to 34 Supermarkets Nationwide",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Stone900
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Founded in 1998 by the Santoso family in Pasar Baru Bandung, GroceMart was built on a simple promise: respecting Indonesian smallholder farmers and providing urban households with produce harvested that very morning.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = Stone800,
                        lineHeight = 22.sp
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        HeritageKeyStat(number = "28 Yrs", label = "Heritage", modifier = Modifier.weight(1f))
                        HeritageKeyStat(number = "450+", label = "Local Farms", modifier = Modifier.weight(1f))
                        HeritageKeyStat(number = "4°C", label = "Cold Chain", modifier = Modifier.weight(1f))
                        HeritageKeyStat(number = "34", label = "Outlets", modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        // Cold Chain Promise Section
        item {
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = EmeraldDark),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(imageVector = Icons.Default.AcUnit, contentDescription = null, tint = PureWhite)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Proprietary 4°C Highland Cold Chain",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = PureWhite
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Most grocery chains suffer 40% post-harvest loss due to broken cold chains. GroceMart's dedicated refrigerated transport departs Lembang, Ciwidey, Bedugul and Salatiga every midnight, arriving in stores before dawn.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = EmeraldContainer,
                        lineHeight = 18.sp
                    )
                }
            }
        }

        // Milestones List
        item {
            Text(
                text = "Key Milestones",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = Stone900
            )
        }

        items(milestones) { milestone ->
            MilestoneItemCard(milestone = milestone)
        }
    }
}

@Composable
fun HeritageKeyStat(number: String, label: String, modifier: Modifier = Modifier) {
    Surface(
        color = Stone100,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = number, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = EmeraldDark)
            Text(text = label, style = MaterialTheme.typography.labelSmall, color = Stone600)
        }
    }
}

@Composable
fun MilestoneItemCard(milestone: Milestone, modifier: Modifier = Modifier) {
    Surface(
        color = PureWhite,
        shape = RoundedCornerShape(12.dp),
        shadowElevation = 1.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            Surface(
                color = EmeraldContainer,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = "${milestone.year}",
                    color = OnEmeraldContainer,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(text = milestone.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(text = milestone.subtitle, style = MaterialTheme.typography.labelSmall, color = AmberAccent, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = milestone.description, style = MaterialTheme.typography.bodyMedium, color = Stone800, lineHeight = 18.sp)
                Spacer(modifier = Modifier.height(6.dp))
                Text(text = "Impact: ${milestone.metric}", style = MaterialTheme.typography.labelSmall, color = EmeraldDark, fontWeight = FontWeight.Bold)
            }
        }
    }
}
