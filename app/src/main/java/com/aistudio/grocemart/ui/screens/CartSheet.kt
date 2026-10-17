package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.grocemart.model.CartItem
import com.aistudio.grocemart.ui.theme.*
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartSheet(
    viewModel: GroceMartViewModel,
    modifier: Modifier = Modifier
) {
    val cartItems by viewModel.cartItems.collectAsState()
    val selectedDeliveryMethod by viewModel.selectedDeliveryMethod.collectAsState()
    val voucherCode by viewModel.voucherCode.collectAsState()
    val appliedDiscount by viewModel.appliedDiscount.collectAsState()
    val selectedStore by viewModel.selectedStore.collectAsState()
    val cartSubtotal by viewModel.cartSubtotal.collectAsState()

    var inputCode by remember { mutableStateOf("") }
    val deliveryFee = if (selectedDeliveryMethod == "pickup") 0L else 15000L
    val total = (cartSubtotal + deliveryFee - appliedDiscount).coerceAtLeast(0L)

    ModalBottomSheet(
        onDismissRequest = { viewModel.closeCart() },
        containerColor = PureWhite,
        modifier = modifier.testTag("cart_drawer_sheet")
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 24.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = Icons.Default.ShoppingBasket, contentDescription = null, tint = EmeraldPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Your Grocery Basket (${cartItems.sumOf { it.quantity }})",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (cartItems.isNotEmpty()) {
                    TextButton(onClick = { viewModel.repository.clearCart() }) {
                        Text("Clear All", color = StatusRed, fontSize = 12.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            if (cartItems.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.RemoveShoppingCart,
                            contentDescription = "Empty",
                            tint = Stone300,
                            modifier = Modifier.size(54.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Your basket is empty", color = Stone600, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { viewModel.closeCart() },
                            colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
                        ) {
                            Text("Browse Fresh Groceries")
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(cartItems, key = { it.product.id }) { item ->
                        CartItemRow(
                            item = item,
                            onIncrement = { viewModel.updateQuantity(item.product.id, item.quantity + 1) },
                            onDecrement = { viewModel.updateQuantity(item.product.id, item.quantity - 1) },
                            onRemove = { viewModel.removeFromCart(item.product.id) },
                            formatPrice = { viewModel.formatIdr(it) }
                        )
                    }

                    // Delivery Method Selection
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Fulfillment Method",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            DeliveryOptionPill(
                                label = "Instant 1-Hr",
                                sublabel = "Rp 15.000",
                                isSelected = selectedDeliveryMethod == "instant",
                                onClick = { viewModel.setDeliveryMethod("instant") },
                                modifier = Modifier.weight(1f)
                            )
                            DeliveryOptionPill(
                                label = "Scheduled",
                                sublabel = "Rp 15.000",
                                isSelected = selectedDeliveryMethod == "scheduled",
                                onClick = { viewModel.setDeliveryMethod("scheduled") },
                                modifier = Modifier.weight(1f)
                            )
                            DeliveryOptionPill(
                                label = "Store Pickup",
                                sublabel = "FREE",
                                isSelected = selectedDeliveryMethod == "pickup",
                                onClick = { viewModel.setDeliveryMethod("pickup") },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        if (selectedDeliveryMethod == "pickup") {
                            Surface(
                                color = EmeraldContainer,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                            ) {
                                Text(
                                    text = "Ready in 30 mins at ${selectedStore.name}",
                                    color = OnEmeraldContainer,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }

                    // Voucher Promo Code
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedTextField(
                                value = inputCode,
                                onValueChange = { inputCode = it },
                                placeholder = { Text("Code: GROCEHERITAGE", fontSize = 12.sp) },
                                singleLine = true,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(50.dp)
                                    .testTag("voucher_input")
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    viewModel.applyVoucher(if (inputCode.isBlank()) "GROCEHERITAGE" else inputCode)
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = AmberAccent),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.height(50.dp)
                            ) {
                                Text("Apply", fontWeight = FontWeight.Bold)
                            }
                        }

                        if (appliedDiscount > 0) {
                            Text(
                                text = "Promo code $voucherCode applied! Saved ${viewModel.formatIdr(appliedDiscount)} (15% off)",
                                color = EmeraldPrimary,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }

                    // Summary Breakdown
                    item {
                        Spacer(modifier = Modifier.height(14.dp))
                        Surface(
                            color = Stone100,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                SummaryRow(label = "Subtotal", value = viewModel.formatIdr(cartSubtotal))
                                SummaryRow(label = "Delivery Fee", value = if (deliveryFee == 0L) "FREE" else viewModel.formatIdr(deliveryFee))
                                if (appliedDiscount > 0) {
                                    SummaryRow(label = "Heritage Discount", value = "-${viewModel.formatIdr(appliedDiscount)}", valueColor = EmeraldPrimary)
                                }
                                Divider(modifier = Modifier.padding(vertical = 8.dp), color = Stone300)
                                SummaryRow(label = "Total Amount", value = viewModel.formatIdr(total), isTotal = true)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Checkout Button
                Button(
                    onClick = { viewModel.openCheckout() },
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("proceed_to_checkout_button")
                ) {
                    Text(
                        text = "Proceed to Checkout · ${viewModel.formatIdr(total)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }
        }
    }
}

@Composable
fun CartItemRow(
    item: CartItem,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onRemove: () -> Unit,
    formatPrice: (Long) -> String,
    modifier: Modifier = Modifier
) {
    Surface(
        color = PureWhite,
        shape = RoundedCornerShape(10.dp),
        shadowElevation = 1.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.product.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${formatPrice(item.product.price)} / ${item.product.unit}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Stone600
                )
                Text(
                    text = "Subtotal: ${formatPrice(item.product.price * item.quantity)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = EmeraldDark,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .background(Stone100, RoundedCornerShape(8.dp))
                    .padding(2.dp)
            ) {
                IconButton(onClick = onDecrement, modifier = Modifier.size(28.dp)) {
                    Icon(imageVector = Icons.Default.Remove, contentDescription = "Decrease", modifier = Modifier.size(14.dp))
                }
                Text(
                    text = "${item.quantity}",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 6.dp)
                )
                IconButton(onClick = onIncrement, modifier = Modifier.size(28.dp)) {
                    Icon(imageVector = Icons.Default.Add, contentDescription = "Increase", modifier = Modifier.size(14.dp))
                }
            }

            IconButton(onClick = onRemove, modifier = Modifier.size(32.dp)) {
                Icon(imageVector = Icons.Default.DeleteOutline, contentDescription = "Delete", tint = StatusRed)
            }
        }
    }
}

@Composable
fun DeliveryOptionPill(
    label: String,
    sublabel: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (isSelected) EmeraldPrimary else Stone100,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier.clickable { onClick() }
    ) {
        Column(
            modifier = Modifier.padding(vertical = 8.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = label,
                color = if (isSelected) PureWhite else Stone800,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
            )
            Text(
                text = sublabel,
                color = if (isSelected) EmeraldContainer else Stone600,
                fontSize = 10.sp
            )
        }
    }
}

@Composable
fun SummaryRow(
    label: String,
    value: String,
    valueColor: androidx.compose.ui.graphics.Color = Stone900,
    isTotal: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = if (isTotal) MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyMedium,
            fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal,
            color = if (isTotal) Stone900 else Stone600
        )
        Text(
            text = value,
            style = if (isTotal) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
            fontWeight = if (isTotal) FontWeight.ExtraBold else FontWeight.Bold,
            color = valueColor
        )
    }
}
