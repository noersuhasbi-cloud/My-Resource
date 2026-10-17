package com.aistudio.grocemart.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.grocemart.model.OrderStatus
import com.aistudio.grocemart.model.ProductCategory
import com.aistudio.grocemart.model.StoreLocation
import com.aistudio.grocemart.ui.theme.*

@Composable
fun GroceTopBar(
    selectedStore: StoreLocation,
    stores: List<StoreLocation>,
    onSelectStore: (StoreLocation) -> Unit,
    grocePoints: Int,
    cartCount: Int,
    onCartClick: () -> Unit,
    onAccountClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showStoreMenu by remember { mutableStateOf(false) }

    Surface(
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 2.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Logo & Name
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.testTag("brand_header")
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(EmeraldPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.ShoppingBasket,
                            contentDescription = "GroceMart Logo",
                            tint = PureWhite,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Groce",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.ExtraBold,
                                color = EmeraldDark
                            )
                            Text(
                                text = "Mart",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.ExtraBold,
                                color = AmberAccent
                            )
                        }
                        Text(
                            text = "Heritage Chain · 34 Stores",
                            style = MaterialTheme.typography.labelSmall,
                            color = Stone600
                        )
                    }
                }

                // Points & Cart Action Buttons
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Points Badge
                    Surface(
                        color = AmberContainer,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.clickable { onAccountClick() }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "Points",
                                tint = AmberAccent,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "$grocePoints pts",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = OnAmberContainer
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // Cart Icon with Badge
                    IconButton(
                        onClick = onCartClick,
                        modifier = Modifier.testTag("cart_button")
                    ) {
                        BadgedBox(
                            badge = {
                                if (cartCount > 0) {
                                    Badge(
                                        containerColor = EmeraldPrimary,
                                        contentColor = PureWhite
                                    ) {
                                        Text("$cartCount")
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.ShoppingCart,
                                contentDescription = "Shopping Cart",
                                tint = Stone900
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Store Selector Pill
            Box {
                Surface(
                    color = Stone100,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showStoreMenu = true }
                        .testTag("store_selector_pill")
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = "Selected Store",
                            tint = EmeraldPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Outlet: ${selectedStore.name} (${selectedStore.city})",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            color = Stone800,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Icon(
                            imageVector = Icons.Default.ArrowDropDown,
                            contentDescription = "Expand Stores",
                            tint = Stone600,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                DropdownMenu(
                    expanded = showStoreMenu,
                    onDismissRequest = { showStoreMenu = false }
                ) {
                    stores.forEach { store ->
                        DropdownMenuItem(
                            text = {
                                Column {
                                    Text(
                                        text = store.name,
                                        fontWeight = if (store.id == selectedStore.id) FontWeight.Bold else FontWeight.Normal
                                    )
                                    Text(
                                        text = "${store.city} · ${store.hours}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Stone600
                                    )
                                }
                            },
                            onClick = {
                                onSelectStore(store)
                                showStoreMenu = false
                            },
                            leadingIcon = {
                                Icon(
                                    imageVector = if (store.isFlagship) Icons.Default.Verified else Icons.Default.Storefront,
                                    contentDescription = null,
                                    tint = if (store.isFlagship) EmeraldPrimary else Stone600
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: OrderStatus, modifier: Modifier = Modifier) {
    val (bg, textCol, label) = when (status) {
        OrderStatus.PLACED -> Triple(Color(0xFFFEF3C7), Color(0xFF92400E), "Order Placed")
        OrderStatus.PAID -> Triple(Color(0xFFDCFCE7), Color(0xFF166534), "Paid via QRIS")
        OrderStatus.PACKING -> Triple(Color(0xFFE0E7FF), Color(0xFF3730A3), "Cold Packing")
        OrderStatus.IN_TRANSIT -> Triple(Color(0xFFDBEAFE), Color(0xFF1E40AF), "In Transit (Express)")
        OrderStatus.READY_FOR_PICKUP -> Triple(Color(0xFFF3E8FF), Color(0xFF6B21A8), "Ready at Counter")
        OrderStatus.DELIVERED -> Triple(Color(0xFFF0FDF4), Color(0xFF15803D), "Delivered")
    }

    Surface(
        color = bg,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
    ) {
        Text(
            text = label,
            color = textCol,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun NoticeBannerView(
    bannerText: String,
    modifier: Modifier = Modifier
) {
    Surface(
        color = EmeraldContainer,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Eco,
                contentDescription = "Farm Guarantee",
                tint = EmeraldDark,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = bannerText,
                style = MaterialTheme.typography.bodyMedium,
                color = OnEmeraldContainer,
                fontSize = 12.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun CategorySelectorRow(
    selectedCategory: ProductCategory,
    onCategorySelected: (ProductCategory) -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ProductCategory.values().forEach { category ->
            val isSelected = category == selectedCategory
            FilterChip(
                selected = isSelected,
                onClick = { onCategorySelected(category) },
                label = {
                    Text(
                        text = category.label,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                leadingIcon = {
                    val icon = when (category) {
                        ProductCategory.ALL -> Icons.Default.AllInclusive
                        ProductCategory.PRODUCE -> Icons.Default.Spa
                        ProductCategory.BAKERY -> Icons.Default.BakeryDining
                        ProductCategory.DAIRY_EGGS -> Icons.Default.Egg
                        ProductCategory.MEAT_SEAFOOD -> Icons.Default.SetMeal
                        ProductCategory.PANTRY_COFFEE -> Icons.Default.LocalCafe
                    }
                    Icon(
                        imageVector = icon,
                        contentDescription = category.label,
                        modifier = Modifier.size(16.dp)
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = EmeraldPrimary,
                    selectedLabelColor = PureWhite,
                    selectedLeadingIconColor = PureWhite,
                    containerColor = Stone100,
                    labelColor = Stone800
                ),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.testTag("category_chip_${category.name}")
            )
        }
    }
}
