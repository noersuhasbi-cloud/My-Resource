package com.aistudio.grocemart.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aistudio.grocemart.model.*
import com.aistudio.grocemart.repository.GroceMartRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

enum class AppNavDestination {
    STOREFRONT,
    STORE_LOCATIONS,
    HERITAGE,
    CUSTOMER_PORTAL,
    ADMIN_ERP
}

enum class AdminErpTab(val title: String) {
    EXECUTIVE_OVERVIEW("Overview"),
    STORE_OPERATIONS("Store Ops"),
    FEFO_BATCHES("FEFO Batches"),
    PROCUREMENT("Procurement"),
    WASTE_SHRINKAGE("Waste & Shrinkage"),
    PICKER_APP("Picker Station"),
    POS_CASHIER("POS Cashier"),
    ACCOUNTING("Ledger & COA")
}

class GroceMartViewModel(
    val repository: GroceMartRepository = GroceMartRepository()
) : ViewModel() {

    val stores = repository.stores
    val selectedStore = repository.selectedStore
    val products = repository.products
    val cartItems = repository.cartItems
    val customerAccount = repository.customerAccount
    val orders = repository.orders
    val storeStatus = repository.storeStatus
    val adminSession = repository.adminSession
    val batches = repository.batches
    val purchaseOrders = repository.purchaseOrders
    val wasteRecords = repository.wasteRecords
    val pickerOrders = repository.pickerOrders
    val ledgerEntries = repository.ledgerEntries
    val posCart = repository.posCart

    private val _currentDestination = MutableStateFlow(AppNavDestination.STOREFRONT)
    val currentDestination: StateFlow<AppNavDestination> = _currentDestination.asStateFlow()

    private val _selectedCategory = MutableStateFlow(ProductCategory.ALL)
    val selectedCategory: StateFlow<ProductCategory> = _selectedCategory.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedProductDetail = MutableStateFlow<Product?>(null)
    val selectedProductDetail: StateFlow<Product?> = _selectedProductDetail.asStateFlow()

    private val _isCartOpen = MutableStateFlow(false)
    val isCartOpen: StateFlow<Boolean> = _isCartOpen.asStateFlow()

    private val _isCheckoutOpen = MutableStateFlow(false)
    val isCheckoutOpen: StateFlow<Boolean> = _isCheckoutOpen.asStateFlow()

    private val _currentErpTab = MutableStateFlow(AdminErpTab.EXECUTIVE_OVERVIEW)
    val currentErpTab: StateFlow<AdminErpTab> = _currentErpTab.asStateFlow()

    private val _voucherCode = MutableStateFlow("")
    val voucherCode: StateFlow<String> = _voucherCode.asStateFlow()

    private val _appliedDiscount = MutableStateFlow(0L)
    val appliedDiscount: StateFlow<Long> = _appliedDiscount.asStateFlow()

    private val _selectedDeliveryMethod = MutableStateFlow("instant")
    val selectedDeliveryMethod: StateFlow<String> = _selectedDeliveryMethod.asStateFlow()

    private val _activeTrackingOrder = MutableStateFlow<Order?>(null)
    val activeTrackingOrder: StateFlow<Order?> = _activeTrackingOrder.asStateFlow()

    private val _latestPosReceipt = MutableStateFlow<POSTransactionReceipt?>(null)
    val latestPosReceipt: StateFlow<POSTransactionReceipt?> = _latestPosReceipt.asStateFlow()

    val filteredProducts = combine(products, selectedCategory, searchQuery) { list, category, query ->
        list.filter { product ->
            val matchesCategory = (category == ProductCategory.ALL) || (product.category == category)
            val matchesQuery = query.isBlank() || product.name.contains(query, ignoreCase = true) || product.origin.contains(query, ignoreCase = true)
            matchesCategory && matchesQuery
        }
    }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    val cartCount = cartItems.map { it.sumOf { item -> item.quantity } }
        .stateIn(viewModelScope, SharingStarted.Lazily, 0)

    val cartSubtotal = cartItems.map { it.sumOf { item -> item.product.price * item.quantity } }
        .stateIn(viewModelScope, SharingStarted.Lazily, 0L)

    fun navigateTo(dest: AppNavDestination) {
        _currentDestination.value = dest
    }

    fun selectCategory(category: ProductCategory) {
        _selectedCategory.value = category
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun openProductDetail(product: Product) {
        _selectedProductDetail.value = product
    }

    fun closeProductDetail() {
        _selectedProductDetail.value = null
    }

    fun openCart() {
        _isCartOpen.value = true
    }

    fun closeCart() {
        _isCartOpen.value = false
    }

    fun openCheckout() {
        _isCartOpen.value = false
        _isCheckoutOpen.value = true
    }

    fun closeCheckout() {
        _isCheckoutOpen.value = false
    }

    fun setDeliveryMethod(method: String) {
        _selectedDeliveryMethod.value = method
    }

    fun selectStore(store: StoreLocation) {
        repository.selectStore(store)
    }

    fun addToCart(product: Product, quantity: Int = 1) {
        repository.addToCart(product, quantity)
    }

    fun updateQuantity(productId: String, quantity: Int) {
        repository.updateQuantity(productId, quantity)
    }

    fun removeFromCart(productId: String) {
        repository.removeFromCart(productId)
    }

    fun applyVoucher(code: String) {
        _voucherCode.value = code.trim().uppercase()
        if (_voucherCode.value == "GROCEHERITAGE") {
            val subtotal = cartSubtotal.value
            _appliedDiscount.value = (subtotal * 0.15).toLong() // 15% discount
        } else {
            _appliedDiscount.value = 0L
        }
    }

    fun confirmCheckout(paymentMethod: String): Order {
        val address = customerAccount.value.defaultAddress
        val order = repository.placeOrder(
            deliveryMethod = _selectedDeliveryMethod.value,
            deliveryAddress = address,
            voucherCode = if (_appliedDiscount.value > 0) _voucherCode.value else null,
            discountAmount = _appliedDiscount.value,
            paymentMethod = paymentMethod
        )
        _activeTrackingOrder.value = order
        closeCheckout()
        _voucherCode.value = ""
        _appliedDiscount.value = 0L
        _currentDestination.value = AppNavDestination.CUSTOMER_PORTAL
        return order
    }

    fun simulateQrisScanAndPay(orderId: String) {
        repository.simulateQrisPayment(orderId)
        val updated = orders.value.firstOrNull { it.id == orderId }
        if (updated != null) {
            _activeTrackingOrder.value = updated
        }
    }

    fun advanceOrderStatus(orderId: String) {
        repository.advanceOrderStatus(orderId)
        val updated = orders.value.firstOrNull { it.id == orderId }
        if (updated != null) {
            _activeTrackingOrder.value = updated
        }
    }

    fun selectOrderForTracking(order: Order) {
        _activeTrackingOrder.value = order
        _currentDestination.value = AppNavDestination.CUSTOMER_PORTAL
    }

    fun setErpTab(tab: AdminErpTab) {
        _currentErpTab.value = tab
    }

    fun loginAdmin(session: StaffShiftSession) {
        repository.loginAdmin(session)
    }

    fun logoutAdmin() {
        repository.logoutAdmin()
    }

    fun updateStoreStatus(isOpen: Boolean, isHolidayMode: Boolean, notice: String) {
        repository.updateStoreStatus(isOpen, isHolidayMode, notice)
    }

    fun addPosItem(item: POSProductItem) {
        repository.addPosItem(item)
    }

    fun removePosItem(id: String) {
        repository.removePosItem(id)
    }

    fun clearPosCart() {
        repository.clearPosCart()
    }

    fun checkoutPos(method: String, cashTendered: Long?) {
        val receipt = repository.completePosCheckout(method, cashTendered)
        _latestPosReceipt.value = receipt
    }

    fun clearPosReceipt() {
        _latestPosReceipt.value = null
    }

    fun approvePo(poId: String) {
        repository.approvePurchaseOrder(poId)
    }

    fun recordWaste(productName: String, qty: Double, unit: String, cost: Long, reason: String, action: String) {
        repository.recordWaste(productName, qty, unit, cost, reason, action)
    }

    fun formatIdr(amount: Long): String {
        val formatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))
        formatter.maximumFractionDigits = 0
        return formatter.format(amount).replace("Rp", "Rp ")
    }
}
