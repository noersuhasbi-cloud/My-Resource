package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.grocemart.model.Product
import com.aistudio.grocemart.ui.components.CategorySelectorRow
import com.aistudio.grocemart.ui.components.NoticeBannerView
import com.aistudio.grocemart.ui.theme.*
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

@Composable
fun StorefrontScreen(
    viewModel: GroceMartViewModel,
    modifier: Modifier = Modifier
) {
    val storeStatus by viewModel.storeStatus.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val products by viewModel.filteredProducts.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val selectedStore by viewModel.selectedStore.collectAsState()

    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        contentPadding = PaddingValues(bottom = 90.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = modifier
            .fillMaxSize()
            .background(Stone50)
            .padding(horizontal = 16.dp)
            .testTag("storefront_product_grid")
    ) {
        // 1. Notice Banner
        item(span = { GridItemSpan(2) }) {
            NoticeBannerView(bannerText = storeStatus.noticeBanner)
        }

        // 2. Hero Section
        item(span = { GridItemSpan(2) }) {
            HeroHeaderCard(selectedStoreName = selectedStore.name)
        }

        // 3. Search Bar
        item(span = { GridItemSpan(2) }) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.updateSearchQuery(it) },
                placeholder = { Text("Search fresh organic produce, sourdough, meat...", color = Stone600) },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = EmeraldPrimary
                    )
                },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                            Icon(imageVector = Icons.Default.Close, contentDescription = "Clear search")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = EmeraldPrimary,
                    unfocusedBorderColor = Stone300,
                    focusedContainerColor = PureWhite,
                    unfocusedContainerColor = PureWhite
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("search_input_field")
            )
        }

        // 4. Category Filter Tabs
        item(span = { GridItemSpan(2) }) {
            CategorySelectorRow(
                selectedCategory = selectedCategory,
                onCategorySelected = { viewModel.selectCategory(it) }
            )
        }

        // 5. Products Header Count
        item(span = { GridItemSpan(2) }) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${selectedCategory.label} (${products.size})",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Stone900
                )
                Text(
                    text = "Farm Direct Guaranteed",
                    style = MaterialTheme.typography.labelSmall,
                    color = EmeraldPrimary,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // 6. Product Cards
        items(products, key = { it.id }) { product ->
            val cartItem = cartItems.find { it.product.id == product.id }
            val quantityInCart = cartItem?.quantity ?: 0

            ProductCardItem(
                product = product,
                quantityInCart = quantityInCart,
                onCardClick = { viewModel.openProductDetail(product) },
                onAddClick = { viewModel.addToCart(product, 1) },
                onIncrement = { viewModel.updateQuantity(product.id, quantityInCart + 1) },
                onDecrement = { viewModel.updateQuantity(product.id, quantityInCart - 1) },
                formatPrice = { viewModel.formatIdr(it) }
            )
        }
    }
}

@Composable
fun HeroHeaderCard(selectedStoreName: String, modifier: Modifier = Modifier) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = EmeraldDark),
        modifier = modifier.fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(EmeraldDark, Color(0xFF0F3D20))
                    )
                )
                .padding(18.dp)
        ) {
            Column {
                Surface(
                    color = AmberAccent,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "EST. 1998 · PASAR BARU BANDUNG",
                        color = PureWhite,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Pioneering Cold-Chain Farm Freshness",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = PureWhite
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "From Lembang, Bedugul & Salatiga highlands straight to $selectedStoreName within 12 hours. Guaranteed 4°C chilled route.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = EmeraldContainer,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    HeroStatPill(icon = Icons.Default.ElectricMoped, label = "Instant 1-Hr Delivery")
                    HeroStatPill(icon = Icons.Default.QrCode2, label = "Instant QRIS")
                    HeroStatPill(icon = Icons.Default.Verified, label = "100% Traceable")
                }
            }
        }
    }
}

@Composable
fun HeroStatPill(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String) {
    Surface(
        color = Color(0x33FFFFFF),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = PureWhite, modifier = Modifier.size(12.dp))
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = label, color = PureWhite, fontSize = 10.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun ProductCardItem(
    product: Product,
    quantityInCart: Int,
    onCardClick: () -> Unit,
    onAddClick: () -> Unit,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    formatPrice: (Long) -> String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val drawableId = context.resources.getIdentifier(product.imageDrawableRes, "drawable", context.packageName)

    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = PureWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier
            .fillMaxWidth()
            .clickable { onCardClick() }
            .testTag("product_card_${product.id}")
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            // Image / Thumbnail
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(115.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Stone100),
                contentAlignment = Alignment.Center
            ) {
                if (drawableId != 0) {
                    Image(
                        painter = painterResource(id = drawableId),
                        contentDescription = product.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.ShoppingBag,
                        contentDescription = product.name,
                        tint = EmeraldPrimary,
                        modifier = Modifier.size(36.dp)
                    )
                }

                // Organic Badge
                if (product.isOrganic) {
                    Surface(
                        color = EmeraldPrimary,
                        shape = RoundedCornerShape(bottomEnd = 8.dp),
                        modifier = Modifier.align(Alignment.TopStart)
                    ) {
                        Text(
                            text = "ORGANIC",
                            color = PureWhite,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Rating & Origin
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = "Rating",
                    tint = AmberAccent,
                    modifier = Modifier.size(13.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = "${product.rating} (${product.reviewCount})",
                    style = MaterialTheme.typography.labelSmall,
                    color = Stone600
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Name
            Text(
                text = product.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Stone900,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.height(40.dp)
            )

            // Unit & Farm Origin
            Text(
                text = "${product.unit} · ${product.origin}",
                style = MaterialTheme.typography.labelSmall,
                color = Stone600,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Price & Add to Cart Stepper
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = formatPrice(product.price),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = EmeraldDark
                    )
                }

                if (quantityInCart == 0) {
                    FilledTonalButton(
                        onClick = onAddClick,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = EmeraldContainer,
                            contentColor = OnEmeraldContainer
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .height(34.dp)
                            .testTag("add_button_${product.id}")
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "Add", modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(text = "Add", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                } else {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .background(EmeraldContainer, RoundedCornerShape(8.dp))
                            .padding(2.dp)
                    ) {
                        IconButton(
                            onClick = onDecrement,
                            modifier = Modifier.size(28.dp).testTag("decrement_${product.id}")
                        ) {
                            Icon(imageVector = Icons.Default.Remove, contentDescription = "Remove", tint = OnEmeraldContainer, modifier = Modifier.size(14.dp))
                        }
                        Text(
                            text = "$quantityInCart",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = OnEmeraldContainer,
                            modifier = Modifier.padding(horizontal = 6.dp)
                        )
                        IconButton(
                            onClick = onIncrement,
                            modifier = Modifier.size(28.dp).testTag("increment_${product.id}")
                        ) {
                            Icon(imageVector = Icons.Default.Add, contentDescription = "Add", tint = OnEmeraldContainer, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }
        }
    }
}
