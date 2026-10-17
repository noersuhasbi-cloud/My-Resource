package com.aistudio.grocemart.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aistudio.grocemart.data.MockData
import com.aistudio.grocemart.model.*
import com.aistudio.grocemart.ui.theme.*
import com.aistudio.grocemart.viewmodel.AdminErpTab
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

@Composable
fun AdminErpScreen(
    viewModel: GroceMartViewModel,
    modifier: Modifier = Modifier
) {
    val adminSession by viewModel.adminSession.collectAsState()
    val currentTab by viewModel.currentErpTab.collectAsState()

    if (adminSession == null) {
        // Staff Role Login Gate
        AdminLoginGate(
            onSelectSession = { viewModel.loginAdmin(it) },
            modifier = modifier
        )
    } else {
        // Full Operations ERP Portal
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(Stone50)
        ) {
            // Staff Session Top Bar
            Surface(
                color = EmeraldDark,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "GroceMart ERP · ${adminSession?.userName}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = PureWhite
                        )
                        Text(
                            text = "${adminSession?.userRole?.title} · ${adminSession?.storeName} (${adminSession?.shiftName})",
                            style = MaterialTheme.typography.labelSmall,
                            color = EmeraldContainer
                        )
                    }

                    TextButton(onClick = { viewModel.logoutAdmin() }) {
                        Text("Switch Profile", color = AmberContainer, fontSize = 12.sp)
                    }
                }
            }

            // Scrollable ERP Navigation Tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(PureWhite)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AdminErpTab.values().forEach { tab ->
                    val isSelected = tab == currentTab
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.setErpTab(tab) },
                        label = { Text(tab.title, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = EmeraldPrimary,
                            selectedLabelColor = PureWhite,
                            containerColor = Stone100,
                            labelColor = Stone800
                        ),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.testTag("erp_tab_${tab.name}")
                    )
                }
            }

            Divider(color = Stone300)

            // Content per selected tab
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
            ) {
                when (currentTab) {
                    AdminErpTab.EXECUTIVE_OVERVIEW -> ExecutiveOverviewTab(viewModel)
                    AdminErpTab.STORE_OPERATIONS -> StoreOperationsTab(viewModel)
                    AdminErpTab.FEFO_BATCHES -> FefoBatchesTab(viewModel)
                    AdminErpTab.PROCUREMENT -> ProcurementTab(viewModel)
                    AdminErpTab.WASTE_SHRINKAGE -> WasteShrinkageTab(viewModel)
                    AdminErpTab.PICKER_APP -> PickerAppTab(viewModel)
                    AdminErpTab.POS_CASHIER -> PosCashierTab(viewModel)
                    AdminErpTab.ACCOUNTING -> AccountingLedgerTab(viewModel)
                }
            }
        }
    }
}

@Composable
fun AdminLoginGate(
    onSelectSession: (StaffShiftSession) -> Unit,
    modifier: Modifier = Modifier
) {
    val profiles = MockData.AVAILABLE_STAFF_SESSIONS

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(Stone50)
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 24.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Column {
                Surface(color = EmeraldContainer, shape = RoundedCornerShape(8.dp)) {
                    Text(
                        text = "INTERNAL STAFF PORTAL",
                        color = OnEmeraldContainer,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Role-Based Shift Access",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Stone900
                )
                Text(
                    text = "Select a staff profile below to access in-store picking, cashier POS, FEFO batch inspection, or executive analytics.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Stone600
                )
            }
        }

        items(profiles) { profile ->
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth().testTag("profile_login_${profile.userId}")
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .background(EmeraldContainer, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        val icon = when (profile.userRole) {
                            UserRole.STORE_MANAGER -> Icons.Default.ManageAccounts
                            UserRole.CASHIER -> Icons.Default.PointOfSale
                            UserRole.WAREHOUSE_PICKER -> Icons.Default.Inventory
                            UserRole.EXECUTIVE -> Icons.Default.Assessment
                            UserRole.ADMIN -> Icons.Default.AdminPanelSettings
                        }
                        Icon(imageVector = icon, contentDescription = null, tint = EmeraldDark)
                    }

                    Spacer(modifier = Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = profile.userName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(text = profile.userRole.title, style = MaterialTheme.typography.labelSmall, color = AmberAccent, fontWeight = FontWeight.SemiBold)
                        Text(text = "${profile.storeName} · ${profile.shiftName}", style = MaterialTheme.typography.bodyMedium, color = Stone600)
                    }

                    Button(
                        onClick = { onSelectSession(profile) },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text("Log In")
                    }
                }
            }
        }
    }
}

@Composable
fun ExecutiveOverviewTab(viewModel: GroceMartViewModel) {
    LazyColumn(
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(text = "Consolidated Chain Performance", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ErpMetricCard("Rp 8.42 M", "Revenue MTD", "+14.2% DoD", EmeraldDark, Modifier.weight(1f))
                ErpMetricCard("34 Outlets", "Active Stores", "100% Operational", AmberAccent, Modifier.weight(1f))
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ErpMetricCard("98.4%", "QRIS Conversion", "Avg. 8.2s speed", EmeraldPrimary, Modifier.weight(1f))
                ErpMetricCard("1,420", "Orders Today", "42 mins avg ETA", StatusBlue, Modifier.weight(1f))
            }
        }

        item {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(text = "Top Contributing Store Hubs", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    StoreShareRow("Senopati Flagship (Jakarta)", "Rp 1.84 M", "21.8%")
                    StoreShareRow("PIK 2 The Avenue (Jakarta)", "Rp 1.42 M", "16.8%")
                    StoreShareRow("Dago Green Market (Bandung)", "Rp 1.15 M", "13.6%")
                    StoreShareRow("Dharmahusada (Surabaya)", "Rp 980 Jt", "11.6%")
                    StoreShareRow("Sanur Coastal (Bali)", "Rp 890 Jt", "10.5%")
                }
            }
        }
    }
}

@Composable
fun StoreShareRow(store: String, omzet: String, share: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = store, style = MaterialTheme.typography.bodyMedium, color = Stone800)
        Row {
            Text(text = omzet, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = EmeraldDark)
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = share, style = MaterialTheme.typography.bodyMedium, color = Stone600)
        }
    }
}

@Composable
fun ErpMetricCard(value: String, label: String, badge: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = PureWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = color)
            Text(text = label, style = MaterialTheme.typography.bodyMedium, color = Stone600)
            Spacer(modifier = Modifier.height(4.dp))
            Surface(color = Stone100, shape = RoundedCornerShape(6.dp)) {
                Text(text = badge, color = EmeraldPrimary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
            }
        }
    }
}

@Composable
fun StoreOperationsTab(viewModel: GroceMartViewModel) {
    val storeStatus by viewModel.storeStatus.collectAsState()
    val stores by viewModel.stores.collectAsState()
    var bannerInput by remember { mutableStateOf(storeStatus.noticeBanner) }

    LazyColumn(
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Operational Controls", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = "Emergency Closed Mode", fontWeight = FontWeight.Bold)
                            Text(text = "Temporarily pause dispatch if severe weather", style = MaterialTheme.typography.labelSmall, color = Stone600)
                        }
                        Switch(
                            checked = !storeStatus.isOpen,
                            onCheckedChange = { viewModel.updateStoreStatus(!it, storeStatus.isHolidayMode, storeStatus.noticeBanner) },
                            modifier = Modifier.testTag("emergency_closed_switch")
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = "Holiday Schedule Mode", fontWeight = FontWeight.Bold)
                            Text(text = "Activate holiday operational timings", style = MaterialTheme.typography.labelSmall, color = Stone600)
                        }
                        Switch(
                            checked = storeStatus.isHolidayMode,
                            onCheckedChange = { viewModel.updateStoreStatus(storeStatus.isOpen, it, storeStatus.noticeBanner) },
                            modifier = Modifier.testTag("holiday_mode_switch")
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(text = "Live Broadcast Notice Banner", fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = bannerInput,
                        onValueChange = { bannerInput = it },
                        modifier = Modifier.fillMaxWidth().testTag("notice_banner_input")
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = { viewModel.updateStoreStatus(storeStatus.isOpen, storeStatus.isHolidayMode, bannerInput) },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary)
                    ) {
                        Text("Broadcast Notice to Storefront")
                    }
                }
            }
        }

        item {
            Text(text = "All 34 Outlets Status", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }

        items(stores) { store ->
            Surface(
                color = PureWhite,
                shape = RoundedCornerShape(10.dp),
                shadowElevation = 1.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(text = store.name, fontWeight = FontWeight.Bold)
                        Text(text = "${store.city} · ${store.hours}", style = MaterialTheme.typography.bodyMedium, color = Stone600)
                    }
                    Surface(color = EmeraldContainer, shape = RoundedCornerShape(6.dp)) {
                        Text(text = "ACTIVE", color = OnEmeraldContainer, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun FefoBatchesTab(viewModel: GroceMartViewModel) {
    val batches by viewModel.batches.collectAsState()

    LazyColumn(
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Column {
                Text(text = "First Expired, First Out (FEFO) Batches", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(text = "Active inventory batches ranked by remaining shelf-life", style = MaterialTheme.typography.bodyMedium, color = Stone600)
            }
        }

        items(batches) { batch ->
            val statusColor = when (batch.status) {
                "fresh" -> EmeraldPrimary
                "near_expiry" -> StatusAmber
                else -> StatusRed
            }

            Card(
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = batch.productName, fontWeight = FontWeight.Bold)
                        Text(text = "Lot: ${batch.lotNumber} · Zone: ${batch.storageZone}", style = MaterialTheme.typography.labelSmall, color = Stone600)
                        Text(text = "Stock: ${batch.currentStock} units · Expiry: ${batch.expiryDate}", style = MaterialTheme.typography.bodyMedium, color = Stone800)
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Surface(
                            color = statusColor.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "${batch.daysUntilExpiry} days left",
                                color = statusColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProcurementTab(viewModel: GroceMartViewModel) {
    val purchaseOrders by viewModel.purchaseOrders.collectAsState()

    LazyColumn(
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(text = "Purchase Orders & Highland Sourcing", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }

        items(purchaseOrders) { po ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = po.id, fontWeight = FontWeight.Bold)
                        Surface(
                            color = if (po.status == "Completed") EmeraldContainer else AmberContainer,
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = po.status,
                                color = if (po.status == "Completed") OnEmeraldContainer else OnAmberContainer,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                    Text(text = "Supplier: ${po.supplierName}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    Text(text = "Items: ${po.itemsSummary}", style = MaterialTheme.typography.bodyMedium, color = Stone800)
                    Text(text = "Total Valuation: ${viewModel.formatIdr(po.totalCost)} · Delivery: ${po.expectedDeliveryDate}", style = MaterialTheme.typography.labelSmall, color = Stone600)

                    if (po.status != "Completed") {
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = { viewModel.approvePo(po.id) },
                            colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.testTag("approve_po_${po.id}")
                        ) {
                            Text("Verify Goods Receipt & Cold Chain")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WasteShrinkageTab(viewModel: GroceMartViewModel) {
    val wasteRecords by viewModel.wasteRecords.collectAsState()

    LazyColumn(
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Column {
                Text(text = "Shrinkage & Natural Evaporation Audit", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(text = "Daily produce loss logs and bio-composting compliance", style = MaterialTheme.typography.bodyMedium, color = Stone600)
            }
        }

        items(wasteRecords) { record ->
            Card(
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = record.productName, fontWeight = FontWeight.Bold)
                        Text(text = "-${viewModel.formatIdr(record.totalLossCost)}", color = StatusRed, fontWeight = FontWeight.Bold)
                    }
                    Text(text = "Loss: ${record.quantityScrapped} ${record.unit} · Reason: ${record.reason}", style = MaterialTheme.typography.bodyMedium, color = Stone800)
                    Text(text = "Action: ${record.actionTaken} · By: ${record.reportedBy} (${record.reportedAt})", style = MaterialTheme.typography.labelSmall, color = Stone600)
                }
            }
        }
    }
}

@Composable
fun PickerAppTab(viewModel: GroceMartViewModel) {
    val pickerOrders by viewModel.pickerOrders.collectAsState()

    LazyColumn(
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(text = "In-Store Picker Station", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }

        items(pickerOrders) { pOrder ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = pOrder.orderId, fontWeight = FontWeight.Bold)
                        Surface(
                            color = if (pOrder.pickerStatus == "Completed") EmeraldContainer else AmberContainer,
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = pOrder.pickerStatus,
                                color = if (pOrder.pickerStatus == "Completed") OnEmeraldContainer else OnAmberContainer,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(text = "Customer: ${pOrder.customerName} · Priority: ${pOrder.priority}", style = MaterialTheme.typography.bodyMedium)
                    Text(text = "Progress: ${pOrder.pickedItems} of ${pOrder.totalItems} items picked", style = MaterialTheme.typography.labelSmall, color = Stone600)

                    if (pOrder.hasCatchWeight) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Surface(color = Stone100, shape = RoundedCornerShape(6.dp)) {
                            Text(text = "Scale Catch-Weight Required", color = AmberAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PosCashierTab(viewModel: GroceMartViewModel) {
    PosCashierScreen(viewModel = viewModel)
}

@Composable
fun AccountingLedgerTab(viewModel: GroceMartViewModel) {
    val ledgerEntries by viewModel.ledgerEntries.collectAsState()

    LazyColumn(
        contentPadding = PaddingValues(top = 16.dp, bottom = 90.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Column {
                Text(text = "General Ledger & Double-Entry Accounting", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(text = "Real-time automated transaction posting", style = MaterialTheme.typography.bodyMedium, color = Stone600)
            }
        }

        items(ledgerEntries) { entry ->
            Card(
                shape = RoundedCornerShape(10.dp),
                colors = CardDefaults.cardColors(containerColor = PureWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "${entry.accountCode} - ${entry.accountName}", fontWeight = FontWeight.Bold)
                        Text(
                            text = if (entry.debit > 0) "Dr ${viewModel.formatIdr(entry.debit)}" else "Cr ${viewModel.formatIdr(entry.credit)}",
                            fontWeight = FontWeight.ExtraBold,
                            color = if (entry.debit > 0) EmeraldDark else AmberAccent
                        )
                    }
                    Text(text = entry.description, style = MaterialTheme.typography.bodyMedium, color = Stone800)
                    Text(text = "Ref: ${entry.referenceType} · ${entry.timestamp} (${entry.storeName})", style = MaterialTheme.typography.labelSmall, color = Stone600)
                }
            }
        }
    }
}
