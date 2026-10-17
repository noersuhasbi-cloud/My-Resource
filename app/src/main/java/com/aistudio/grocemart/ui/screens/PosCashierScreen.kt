package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.aistudio.grocemart.data.MockData
import com.aistudio.grocemart.model.POSCartItem
import com.aistudio.grocemart.model.POSTransactionReceipt
import com.aistudio.grocemart.ui.theme.*
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

@Composable
fun PosCashierScreen(
    viewModel: GroceMartViewModel,
    modifier: Modifier = Modifier
) {
    val posCart by viewModel.posCart.collectAsState()
    val receipt by viewModel.latestPosReceipt.collectAsState()
    val posItems = MockData.INITIAL_POS_PRODUCTS

    var paymentMethod by remember { mutableStateOf("cash") }
    var cashTenderedText by remember { mutableStateOf("100000") }

    val subtotal = posCart.sumOf { it.lineTotal }
    val tax = (subtotal * 0.11).toLong()
    val total = subtotal + tax
    val cashTendered = cashTenderedText.toLongOrNull() ?: 0L
    val change = (cashTendered - total).coerceAtLeast(0L)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(top = 10.dp, bottom = 90.dp)
    ) {
        Text(
            text = "In-Store Cashier POS Register",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Scan or tap items to ring up customer counter sale",
            style = MaterialTheme.typography.bodyMedium,
            color = Stone600
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Quick Products Grid (top half)
        Text(text = "Quick Barcode Items", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(6.dp))

        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(170.dp)
        ) {
            items(posItems) { item ->
                OutlinedButton(
                    onClick = { viewModel.addPosItem(item) },
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(6.dp),
                    modifier = Modifier.testTag("pos_add_${item.sku}")
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = item.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            maxLines = 1
                        )
                        Text(
                            text = viewModel.formatIdr(item.price),
                            fontSize = 10.sp,
                            color = EmeraldDark
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // POS Cart & Register Details
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = PureWhite),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Current Register Bill (${posCart.size} lines)", fontWeight = FontWeight.Bold)
                    if (posCart.isNotEmpty()) {
                        TextButton(onClick = { viewModel.clearPosCart() }) {
                            Text("Void All", color = StatusRed, fontSize = 11.sp)
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(posCart) { line ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Stone100, RoundedCornerShape(6.dp))
                                .padding(8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(text = line.item.name, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                                Text(
                                    text = "${line.quantity} ${line.item.unit} @ ${viewModel.formatIdr(line.item.price)}",
                                    fontSize = 11.sp,
                                    color = Stone600
                                )
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(text = viewModel.formatIdr(line.lineTotal), fontWeight = FontWeight.Bold, color = EmeraldDark)
                                IconButton(onClick = { viewModel.removePosItem(line.id) }, modifier = Modifier.size(24.dp)) {
                                    Icon(imageVector = Icons.Default.Close, contentDescription = "Remove", tint = StatusRed, modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                }

                Divider(modifier = Modifier.padding(vertical = 8.dp), color = Stone300)

                // Totals
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Subtotal: ${viewModel.formatIdr(subtotal)}", fontSize = 12.sp)
                    Text(text = "Tax (11% PPN): ${viewModel.formatIdr(tax)}", fontSize = 12.sp)
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = "Total Payable:", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(text = viewModel.formatIdr(total), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = EmeraldDark)
                }

                // Tender & Checkout
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = cashTenderedText,
                        onValueChange = { cashTenderedText = it },
                        label = { Text("Cash Tendered (IDR)", fontSize = 10.sp) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f).height(50.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = "Change: ${viewModel.formatIdr(change)}", fontWeight = FontWeight.Bold, color = StatusBlue, fontSize = 12.sp)
                }

                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = {
                        if (posCart.isNotEmpty()) {
                            viewModel.checkoutPos(paymentMethod, cashTendered)
                        }
                    },
                    enabled = posCart.isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth().height(46.dp).testTag("pos_checkout_button")
                ) {
                    Icon(imageVector = Icons.Default.ReceiptLong, contentDescription = null)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Complete Sale & Print Receipt")
                }
            }
        }
    }

    // Receipt Dialog
    if (receipt != null) {
        PosReceiptDialog(
            receipt = receipt!!,
            onDismiss = { viewModel.clearPosReceipt() },
            formatPrice = { viewModel.formatIdr(it) }
        )
    }
}

@Composable
fun PosReceiptDialog(
    receipt: POSTransactionReceipt,
    onDismiss: () -> Unit,
    formatPrice: (Long) -> String
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = PureWhite,
            modifier = Modifier.fillMaxWidth(0.9f).padding(16.dp).testTag("pos_receipt_dialog")
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = EmeraldPrimary, modifier = Modifier.size(48.dp))
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "GROCEMART INDONESIA", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                Text(text = receipt.storeName, style = MaterialTheme.typography.bodyMedium, color = Stone600)
                Text(text = "Receipt: ${receipt.receiptNumber}", style = MaterialTheme.typography.labelSmall)
                Text(text = receipt.timestamp, style = MaterialTheme.typography.labelSmall, color = Stone600)

                Divider(modifier = Modifier.padding(vertical = 10.dp))

                receipt.items.forEach { item ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "${item.item.name} x${item.quantity.toInt()}", fontSize = 12.sp)
                        Text(text = formatPrice(item.lineTotal), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Divider(modifier = Modifier.padding(vertical = 8.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Subtotal:", fontSize = 12.sp)
                    Text(text = formatPrice(receipt.subtotal), fontSize = 12.sp)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "Tax (PPN 11%):", fontSize = 12.sp)
                    Text(text = formatPrice(receipt.tax), fontSize = 12.sp)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(text = "TOTAL PAID:", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(text = formatPrice(receipt.total), fontWeight = FontWeight.Bold, fontSize = 14.sp, color = EmeraldDark)
                }

                if (receipt.cashChange != null && receipt.cashChange > 0) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Change Returned:", fontSize = 12.sp)
                        Text(text = formatPrice(receipt.cashChange), fontSize = 12.sp, color = StatusBlue)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Close Receipt")
                }
            }
        }
    }
}
