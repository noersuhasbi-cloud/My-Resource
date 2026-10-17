package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.aistudio.grocemart.ui.theme.*
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

@Composable
fun CheckoutDialog(
    viewModel: GroceMartViewModel,
    modifier: Modifier = Modifier
) {
    var paymentMethod by remember { mutableStateOf("qris") }
    val cartItems by viewModel.cartItems.collectAsState()
    val deliveryMethod by viewModel.selectedDeliveryMethod.collectAsState()
    val account by viewModel.customerAccount.collectAsState()
    val selectedStore by viewModel.selectedStore.collectAsState()
    val cartSubtotal by viewModel.cartSubtotal.collectAsState()
    val appliedDiscount by viewModel.appliedDiscount.collectAsState()

    val deliveryFee = if (deliveryMethod == "pickup") 0L else 15000L
    val total = (cartSubtotal + deliveryFee - appliedDiscount).coerceAtLeast(0L)

    Dialog(
        onDismissRequest = { viewModel.closeCheckout() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = PureWhite,
            modifier = modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.90f)
                .testTag("checkout_dialog")
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Complete Your Order",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Stone900
                    )
                    IconButton(onClick = { viewModel.closeCheckout() }) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Delivery Destination
                Surface(
                    color = Stone100,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = if (deliveryMethod == "pickup") Icons.Default.Storefront else Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = EmeraldPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (deliveryMethod == "pickup") "Store Pickup Location" else "Delivery Address",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (deliveryMethod == "pickup") {
                                "${selectedStore.name}\n${selectedStore.address}\nHours: ${selectedStore.hours}"
                            } else {
                                "${account.name} (${account.phone})\n${account.defaultAddress}"
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = Stone800,
                            lineHeight = 18.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Payment Method Selector
                Text(
                    text = "Payment Method",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PaymentSelectionPill(
                        label = "Instant QRIS",
                        icon = Icons.Default.QrCodeScanner,
                        isSelected = paymentMethod == "qris",
                        onClick = { paymentMethod = "qris" },
                        modifier = Modifier.weight(1f)
                    )
                    PaymentSelectionPill(
                        label = "Virtual Account",
                        icon = Icons.Default.AccountBalance,
                        isSelected = paymentMethod == "bank_transfer",
                        onClick = { paymentMethod = "bank_transfer" },
                        modifier = Modifier.weight(1f)
                    )
                    PaymentSelectionPill(
                        label = "Credit Card",
                        icon = Icons.Default.CreditCard,
                        isSelected = paymentMethod == "card",
                        onClick = { paymentMethod = "card" },
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // QRIS Interactive Preview Box
                if (paymentMethod == "qris") {
                    Surface(
                        color = Color(0xFFF0FDF4),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "QRIS Quick Response Code",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = EmeraldDark
                            )
                            Text(
                                text = "Supported: BCA, GoPay, OVO, ShopeePay, Dana, LinkAja",
                                style = MaterialTheme.typography.labelSmall,
                                color = Stone600
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            // Stylized QR pattern canvas
                            Box(
                                modifier = Modifier
                                    .size(160.dp)
                                    .background(PureWhite, RoundedCornerShape(12.dp))
                                    .padding(12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Canvas(modifier = Modifier.fillMaxSize()) {
                                    val cellSize = size.width / 15f
                                    for (i in 0 until 15) {
                                        for (j in 0 until 15) {
                                            val isCorner = (i < 4 && j < 4) || (i > 10 && j < 4) || (i < 4 && j > 10)
                                            val isPattern = (i * j + i + j) % 3 == 0
                                            if (isCorner || isPattern) {
                                                drawRect(
                                                    color = Color(0xFF1E293B),
                                                    topLeft = Offset(i * cellSize, j * cellSize),
                                                    size = Size(cellSize * 0.9f, cellSize * 0.9f)
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "NMID: ID1020088921882 · GroceMart Indonesia",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = Stone800
                            )
                            Text(
                                text = "Total Bill: ${viewModel.formatIdr(total)}",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.ExtraBold,
                                color = EmeraldDark
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Price Summary
                Surface(
                    color = Stone100,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        SummaryRow(label = "Items (${cartItems.sumOf { it.quantity }})", value = viewModel.formatIdr(cartSubtotal))
                        SummaryRow(label = "Delivery Fee", value = if (deliveryFee == 0L) "FREE" else viewModel.formatIdr(deliveryFee))
                        if (appliedDiscount > 0) {
                            SummaryRow(label = "Discount", value = "-${viewModel.formatIdr(appliedDiscount)}", valueColor = EmeraldPrimary)
                        }
                        Divider(modifier = Modifier.padding(vertical = 8.dp), color = Stone300)
                        SummaryRow(label = "Payable Total", value = viewModel.formatIdr(total), isTotal = true)
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Confirm Button
                Button(
                    onClick = {
                        val placed = viewModel.confirmCheckout(paymentMethod)
                        // If QRIS was chosen, immediately prompt to track
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("confirm_order_button")
                ) {
                    Icon(imageVector = Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Confirm & Place Order · ${viewModel.formatIdr(total)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }
        }
    }
}

@Composable
fun PaymentSelectionPill(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
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
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (isSelected) PureWhite else Stone800,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = label,
                color = if (isSelected) PureWhite else Stone800,
                fontSize = 10.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
            )
        }
    }
}
