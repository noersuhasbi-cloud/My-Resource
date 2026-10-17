package com.aistudio.grocemart

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aistudio.grocemart.ui.components.GroceTopBar
import com.aistudio.grocemart.ui.screens.*
import com.aistudio.grocemart.ui.theme.EmeraldPrimary
import com.aistudio.grocemart.ui.theme.GroceMartTheme
import com.aistudio.grocemart.ui.theme.PureWhite
import com.aistudio.grocemart.ui.theme.Stone100
import com.aistudio.grocemart.viewmodel.AppNavDestination
import com.aistudio.grocemart.viewmodel.GroceMartViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: GroceMartViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            GroceMartTheme {
                MainAppScaffold(viewModel = viewModel)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScaffold(viewModel: GroceMartViewModel) {
    val currentDestination by viewModel.currentDestination.collectAsState()
    val selectedStore by viewModel.selectedStore.collectAsState()
    val stores by viewModel.stores.collectAsState()
    val customerAccount by viewModel.customerAccount.collectAsState()
    val cartCount by viewModel.cartCount.collectAsState()
    val cartSubtotal by viewModel.cartSubtotal.collectAsState()
    val isCartOpen by viewModel.isCartOpen.collectAsState()
    val isCheckoutOpen by viewModel.isCheckoutOpen.collectAsState()
    val selectedProductDetail by viewModel.selectedProductDetail.collectAsState()

    // Handle back button to return to Storefront
    BackHandler(enabled = currentDestination != AppNavDestination.STOREFRONT) {
        viewModel.navigateTo(AppNavDestination.STOREFRONT)
    }

    Scaffold(
        topBar = {
            GroceTopBar(
                selectedStore = selectedStore,
                stores = stores,
                onSelectStore = { viewModel.selectStore(it) },
                grocePoints = customerAccount.grocePoints,
                cartCount = cartCount,
                onCartClick = { viewModel.openCart() },
                onAccountClick = { viewModel.navigateTo(AppNavDestination.CUSTOMER_PORTAL) }
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = PureWhite,
                tonalElevation = 8.dp,
                modifier = Modifier.testTag("main_bottom_nav")
            ) {
                NavigationBarItem(
                    selected = currentDestination == AppNavDestination.STOREFRONT,
                    onClick = { viewModel.navigateTo(AppNavDestination.STOREFRONT) },
                    icon = {
                        Icon(
                            imageVector = if (currentDestination == AppNavDestination.STOREFRONT) Icons.Default.Storefront else Icons.Outlined.Storefront,
                            contentDescription = "Shop"
                        )
                    },
                    label = { Text("Shop", fontWeight = if (currentDestination == AppNavDestination.STOREFRONT) FontWeight.Bold else FontWeight.Normal) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = EmeraldPrimary,
                        selectedTextColor = EmeraldPrimary,
                        indicatorColor = Stone100
                    ),
                    modifier = Modifier.testTag("nav_item_shop")
                )
                NavigationBarItem(
                    selected = currentDestination == AppNavDestination.STORE_LOCATIONS,
                    onClick = { viewModel.navigateTo(AppNavDestination.STORE_LOCATIONS) },
                    icon = {
                        Icon(
                            imageVector = if (currentDestination == AppNavDestination.STORE_LOCATIONS) Icons.Default.LocationOn else Icons.Outlined.LocationOn,
                            contentDescription = "Outlets"
                        )
                    },
                    label = { Text("34 Outlets", fontWeight = if (currentDestination == AppNavDestination.STORE_LOCATIONS) FontWeight.Bold else FontWeight.Normal) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = EmeraldPrimary,
                        selectedTextColor = EmeraldPrimary,
                        indicatorColor = Stone100
                    ),
                    modifier = Modifier.testTag("nav_item_outlets")
                )
                NavigationBarItem(
                    selected = currentDestination == AppNavDestination.HERITAGE,
                    onClick = { viewModel.navigateTo(AppNavDestination.HERITAGE) },
                    icon = {
                        Icon(
                            imageVector = if (currentDestination == AppNavDestination.HERITAGE) Icons.Default.HistoryEdu else Icons.Outlined.HistoryEdu,
                            contentDescription = "Heritage"
                        )
                    },
                    label = { Text("Our Story", fontWeight = if (currentDestination == AppNavDestination.HERITAGE) FontWeight.Bold else FontWeight.Normal) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = EmeraldPrimary,
                        selectedTextColor = EmeraldPrimary,
                        indicatorColor = Stone100
                    ),
                    modifier = Modifier.testTag("nav_item_heritage")
                )
                NavigationBarItem(
                    selected = currentDestination == AppNavDestination.CUSTOMER_PORTAL,
                    onClick = { viewModel.navigateTo(AppNavDestination.CUSTOMER_PORTAL) },
                    icon = {
                        Icon(
                            imageVector = if (currentDestination == AppNavDestination.CUSTOMER_PORTAL) Icons.Default.LocalShipping else Icons.Outlined.LocalShipping,
                            contentDescription = "Track"
                        )
                    },
                    label = { Text("Orders", fontWeight = if (currentDestination == AppNavDestination.CUSTOMER_PORTAL) FontWeight.Bold else FontWeight.Normal) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = EmeraldPrimary,
                        selectedTextColor = EmeraldPrimary,
                        indicatorColor = Stone100
                    ),
                    modifier = Modifier.testTag("nav_item_orders")
                )
                NavigationBarItem(
                    selected = currentDestination == AppNavDestination.ADMIN_ERP,
                    onClick = { viewModel.navigateTo(AppNavDestination.ADMIN_ERP) },
                    icon = {
                        Icon(
                            imageVector = if (currentDestination == AppNavDestination.ADMIN_ERP) Icons.Default.Engineering else Icons.Outlined.Engineering,
                            contentDescription = "Staff ERP"
                        )
                    },
                    label = { Text("Staff ERP", fontWeight = if (currentDestination == AppNavDestination.ADMIN_ERP) FontWeight.Bold else FontWeight.Normal) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = EmeraldPrimary,
                        selectedTextColor = EmeraldPrimary,
                        indicatorColor = Stone100
                    ),
                    modifier = Modifier.testTag("nav_item_admin_erp")
                )
            }
        },
        floatingActionButton = {
            if (cartCount > 0 && currentDestination == AppNavDestination.STOREFRONT) {
                ExtendedFloatingActionButton(
                    onClick = { viewModel.openCart() },
                    containerColor = EmeraldPrimary,
                    contentColor = PureWhite,
                    icon = { Icon(Icons.Default.ShoppingCart, contentDescription = "View Basket") },
                    text = { Text("$cartCount items · ${viewModel.formatIdr(cartSubtotal)}", fontWeight = FontWeight.Bold) },
                    modifier = Modifier.testTag("floating_cart_fab")
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentDestination) {
                AppNavDestination.STOREFRONT -> StorefrontScreen(viewModel = viewModel)
                AppNavDestination.STORE_LOCATIONS -> StoreLocationsScreen(viewModel = viewModel)
                AppNavDestination.HERITAGE -> HeritageScreen()
                AppNavDestination.CUSTOMER_PORTAL -> OrderTrackingScreen(viewModel = viewModel)
                AppNavDestination.ADMIN_ERP -> AdminErpScreen(viewModel = viewModel)
            }
        }
    }

    // Product Detail Bottom Sheet
    if (selectedProductDetail != null) {
        ProductDetailSheet(
            product = selectedProductDetail!!,
            onDismiss = { viewModel.closeProductDetail() },
            onAddToCart = { qty -> viewModel.addToCart(selectedProductDetail!!, qty) },
            formatPrice = { viewModel.formatIdr(it) }
        )
    }

    // Cart Bottom Sheet
    if (isCartOpen) {
        CartSheet(viewModel = viewModel)
    }

    // Checkout Dialog
    if (isCheckoutOpen) {
        CheckoutDialog(viewModel = viewModel)
    }
}
