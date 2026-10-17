package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.grocemart.model.Order
import com.aistudio.grocemart.model.OrderStatus
import com.aistudio.grocemart.ui.components.StatusBadge
import com.aistudio.grocemart.ui.theme.*
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

@Composable
fun OrderTrackingScreen(
    viewModel: GroceMartViewModel,
    modifier: Modifier = Modifier
) {
    val orders by viewModel.orders.collectAsState()
    val activeTrackingOrder by viewModel.activeTrackingOrder.collectAsState()
    val account by viewModel.customerAccount.collectAsState()

    val currentOrder = activeTrackingOrder ?: orders.firstOrNull()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Stone50)
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Customer Profile Card
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth().testTag("customer_profile_card")
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .clip(CircleShape)
                            .background(EmeraldContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = Icons.Default.Person, contentDescription = null, tint = EmeraldDark, modifier = Modifier.size(28.dp))
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = account.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(text = "${account.email} · ${account.phone}", style = MaterialTheme.typography.bodyMedium, color = Stone600)
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(color = AmberContainer, shape = RoundedCornerShape(8.dp)) {
                                Text(
                                    text = account.memberTier,
                                    color = OnAmberContainer,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = "${account.grocePoints} GrocePoints", style = MaterialTheme.typography.labelSmall, color = EmeraldDark, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Active Order Live Tracking Section
        if (currentOrder != null) {
            item {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = PureWhite),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    modifier = Modifier.fillMaxWidth().testTag("active_order_tracking_card")
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Title & Status
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = currentOrder.id,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Stone900
                                )
                                Text(
                                    text = currentOrder.createdAt,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Stone600
                                )
                            }
                            StatusBadge(status = currentOrder.status)
                        }

                        // QRIS Simulation Action if unpaid
                        if (currentOrder.paymentStatus == "unpaid") {
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                color = AmberContainer,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(text = "Awaiting QRIS Payment", fontWeight = FontWeight.Bold, color = OnAmberContainer, fontSize = 12.sp)
                                        Text(text = "Scan with BCA, GoPay, OVO, ShopeePay", color = OnAmberContainer, fontSize = 10.sp)
                                    }
                                    Button(
                                        onClick = { viewModel.simulateQrisScanAndPay(currentOrder.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                                        modifier = Modifier.testTag("simulate_qris_pay_button")
                                    ) {
                                        Text("Simulate Scan & Pay", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Courier & Delivery Info
                        if (currentOrder.courierName != null && currentOrder.status != OrderStatus.DELIVERED) {
                            Surface(
                                color = Stone100,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(42.dp)
                                            .clip(CircleShape)
                                            .background(EmeraldPrimary),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(imageVector = Icons.Default.ElectricMoped, contentDescription = null, tint = PureWhite)
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "Courier: ${currentOrder.courierName}",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "${currentOrder.vehiclePlate} · ${currentOrder.courierPhone}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = Stone600
                                        )
                                        Text(
                                            text = "ETA: ${currentOrder.estimatedArrival}",
                                            style = MaterialTheme.typography.labelSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = EmeraldDark
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(14.dp))
                        }

                        // Timeline Steps
                        Text(
                            text = "Fulfillment Timeline",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))

                        currentOrder.timeline.forEachIndexed { index, step ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(if (step.completed) EmeraldPrimary else Stone300),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (step.completed) {
                                        Icon(imageVector = Icons.Default.Check, contentDescription = null, tint = PureWhite, modifier = Modifier.size(12.dp))
                                    }
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = step.label,
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = if (step.completed) FontWeight.Bold else FontWeight.Normal,
                                        color = if (step.completed) Stone900 else Stone600
                                    )
                                    Text(
                                        text = "${step.description} (${step.timestamp})",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = Stone600
                                    )
                                }
                            }
                        }

                        // Advance Status (for demo/simulation testing)
                        if (currentOrder.status != OrderStatus.DELIVERED) {
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedButton(
                                onClick = { viewModel.advanceOrderStatus(currentOrder.id) },
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth().testTag("advance_order_status_button")
                            ) {
                                Icon(imageVector = Icons.Default.FastForward, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Advance Fulfillment Step")
                            }
                        }
                    }
                }
            }
        }

        // All Orders List Header
        item {
            Text(
                text = "Order History (${orders.size})",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = Stone900
            )
        }

        items(orders) { order ->
            OrderHistoryCard(
                order = order,
                isSelected = order.id == currentOrder?.id,
                onClick = { viewModel.selectOrderForTracking(order) },
                formatPrice = { viewModel.formatIdr(it) }
            )
        }
    }
}

@Composable
fun OrderHistoryCard(
    order: Order,
    isSelected: Boolean,
    onClick: () -> Unit,
    formatPrice: (Long) -> String,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (isSelected) Color(0xFFF0FDF4) else PureWhite,
        shape = RoundedCornerShape(12.dp),
        shadowElevation = 1.dp,
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("order_history_card_${order.id}")
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = order.id,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Stone900
                )
                StatusBadge(status = order.status)
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${order.createdAt} · ${order.items.size} item(s)",
                style = MaterialTheme.typography.bodyMedium,
                color = Stone600
            )

            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Total Paid: ${formatPrice(order.total)}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                    color = EmeraldDark
                )
                Text(
                    text = "Track Details →",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = EmeraldPrimary
                )
            }
        }
    }
}
