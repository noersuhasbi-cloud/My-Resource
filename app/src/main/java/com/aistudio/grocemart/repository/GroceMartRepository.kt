package com.aistudio.grocemart.repository

import com.aistudio.grocemart.data.MockData
import com.aistudio.grocemart.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class GroceMartRepository {

    private val _stores = MutableStateFlow(MockData.STORE_LOCATIONS)
    val stores: StateFlow<List<StoreLocation>> = _stores.asStateFlow()

    private val _selectedStore = MutableStateFlow(MockData.STORE_LOCATIONS[0])
    val selectedStore: StateFlow<StoreLocation> = _selectedStore.asStateFlow()

    private val _products = MutableStateFlow(MockData.PRODUCTS)
    val products: StateFlow<List<Product>> = _products.asStateFlow()

    private val _cartItems = MutableStateFlow(
        listOf(
            CartItem(MockData.PRODUCTS[0], 1), // Butterhead lettuce
            CartItem(MockData.PRODUCTS[3], 1)  // Sourdough boule
        )
    )
    val cartItems: StateFlow<List<CartItem>> = _cartItems.asStateFlow()

    private val _customerAccount = MutableStateFlow(MockData.INITIAL_DEMO_ACCOUNT)
    val customerAccount: StateFlow<CustomerAccount> = _customerAccount.asStateFlow()

    private val _orders = MutableStateFlow(MockData.INITIAL_ORDERS)
    val orders: StateFlow<List<Order>> = _orders.asStateFlow()

    private val _storeStatus = MutableStateFlow(StoreOperationalStatus())
    val storeStatus: StateFlow<StoreOperationalStatus> = _storeStatus.asStateFlow()

    private val _adminSession = MutableStateFlow<StaffShiftSession?>(null)
    val adminSession: StateFlow<StaffShiftSession?> = _adminSession.asStateFlow()

    private val _batches = MutableStateFlow(MockData.INITIAL_BATCHES)
    val batches: StateFlow<List<InventoryBatch>> = _batches.asStateFlow()

    private val _purchaseOrders = MutableStateFlow(MockData.INITIAL_PURCHASE_ORDERS)
    val purchaseOrders: StateFlow<List<PurchaseOrder>> = _purchaseOrders.asStateFlow()

    private val _wasteRecords = MutableStateFlow(MockData.INITIAL_WASTE_RECORDS)
    val wasteRecords: StateFlow<List<WasteRecord>> = _wasteRecords.asStateFlow()

    private val _pickerOrders = MutableStateFlow(MockData.INITIAL_PICKER_ORDERS)
    val pickerOrders: StateFlow<List<PickerOrder>> = _pickerOrders.asStateFlow()

    private val _ledgerEntries = MutableStateFlow(MockData.INITIAL_LEDGER)
    val ledgerEntries: StateFlow<List<GeneralLedgerEntry>> = _ledgerEntries.asStateFlow()

    private val _posCart = MutableStateFlow<List<POSCartItem>>(emptyList())
    val posCart: StateFlow<List<POSCartItem>> = _posCart.asStateFlow()

    fun selectStore(store: StoreLocation) {
        _selectedStore.value = store
    }

    fun addToCart(product: Product, quantity: Int = 1) {
        val current = _cartItems.value.toMutableList()
        val index = current.indexOfFirst { it.product.id == product.id }
        if (index != -1) {
            val existing = current[index]
            current[index] = existing.copy(quantity = existing.quantity + quantity)
        } else {
            current.add(CartItem(product = product, quantity = quantity))
        }
        _cartItems.value = current
    }

    fun updateQuantity(productId: String, quantity: Int) {
        if (quantity <= 0) {
            removeFromCart(productId)
            return
        }
        val current = _cartItems.value.toMutableList()
        val index = current.indexOfFirst { it.product.id == productId }
        if (index != -1) {
            current[index] = current[index].copy(quantity = quantity)
            _cartItems.value = current
        }
    }

    fun removeFromCart(productId: String) {
        _cartItems.value = _cartItems.value.filter { it.product.id != productId }
    }

    fun clearCart() {
        _cartItems.value = emptyList()
    }

    fun placeOrder(
        deliveryMethod: String,
        deliveryAddress: String,
        voucherCode: String?,
        discountAmount: Long,
        paymentMethod: String
    ): Order {
        val items = _cartItems.value
        val subtotal = items.sumOf { it.product.price * it.quantity }
        val deliveryFee = if (deliveryMethod == "pickup") 0L else 15000L
        val total = (subtotal + deliveryFee - discountAmount).coerceAtLeast(0L)

        val id = "ORD-2026-" + (1000..9999).random()
        val timeNow = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()) + " WIB"

        val newOrder = Order(
            id = id,
            createdAt = "Today, $timeNow",
            customerName = _customerAccount.value.name,
            customerEmail = _customerAccount.value.email,
            customerPhone = _customerAccount.value.phone,
            deliveryMethod = deliveryMethod,
            deliveryAddressLine = if (deliveryMethod == "pickup") null else deliveryAddress,
            pickupStoreName = if (deliveryMethod == "pickup") _selectedStore.value.name else null,
            items = items,
            subtotal = subtotal,
            deliveryFee = deliveryFee,
            discount = discountAmount,
            voucherApplied = voucherCode,
            total = total,
            paymentMethod = paymentMethod,
            paymentStatus = if (paymentMethod == "qris") "unpaid" else "paid",
            qrisRef = "QRIS-$id-PENDING",
            status = OrderStatus.PLACED,
            courierName = if (deliveryMethod != "pickup") "Budi Hartono" else null,
            courierPhone = if (deliveryMethod != "pickup") "+62 813 9021 8831" else null,
            vehiclePlate = if (deliveryMethod != "pickup") "B 4920 SKJ (Electric Scooter)" else null,
            estimatedArrival = if (deliveryMethod == "pickup") "Ready for pickup in 30 mins" else "Within 45 mins",
            timeline = listOf(
                OrderTimelineStep(OrderStatus.PLACED, "Order Received", "Order recorded in ${_selectedStore.value.name}", timeNow, true),
                OrderTimelineStep(OrderStatus.PAID, "Payment Confirmation", "Waiting for QRIS confirmation", "Pending", false),
                OrderTimelineStep(OrderStatus.PACKING, "Picker Packing", "Chilled cold chain packing", "Pending", false),
                OrderTimelineStep(OrderStatus.IN_TRANSIT, "Dispatched on Route", "Courier assignment", "Pending", false),
                OrderTimelineStep(OrderStatus.DELIVERED, "Delivered", "Final handoff", "Pending", false)
            )
        )

        _orders.value = listOf(newOrder) + _orders.value
        clearCart()
        return newOrder
    }

    fun simulateQrisPayment(orderId: String) {
        val currentOrders = _orders.value.toMutableList()
        val index = currentOrders.indexOfFirst { it.id == orderId }
        if (index != -1) {
            val order = currentOrders[index]
            val timeNow = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()) + " WIB"
            val updatedTimeline = order.timeline.map { step ->
                if (step.status == OrderStatus.PAID) {
                    step.copy(completed = true, timestamp = timeNow)
                } else step
            }
            currentOrders[index] = order.copy(
                paymentStatus = "paid",
                status = OrderStatus.PAID,
                qrisRef = "QRIS-$orderId-SETTLED",
                timeline = updatedTimeline
            )
            _orders.value = currentOrders
        }
    }

    fun advanceOrderStatus(orderId: String) {
        val currentOrders = _orders.value.toMutableList()
        val index = currentOrders.indexOfFirst { it.id == orderId }
        if (index != -1) {
            val order = currentOrders[index]
            val nextStatus = when (order.status) {
                OrderStatus.PLACED -> OrderStatus.PAID
                OrderStatus.PAID -> OrderStatus.PACKING
                OrderStatus.PACKING -> if (order.deliveryMethod == "pickup") OrderStatus.READY_FOR_PICKUP else OrderStatus.IN_TRANSIT
                OrderStatus.READY_FOR_PICKUP, OrderStatus.IN_TRANSIT -> OrderStatus.DELIVERED
                OrderStatus.DELIVERED -> OrderStatus.DELIVERED
            }
            val timeNow = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()) + " WIB"
            val updatedTimeline = order.timeline.map { step ->
                if (step.status == nextStatus) {
                    step.copy(completed = true, timestamp = timeNow)
                } else step
            }
            currentOrders[index] = order.copy(
                status = nextStatus,
                timeline = updatedTimeline
            )
            _orders.value = currentOrders
        }
    }

    fun loginAdmin(session: StaffShiftSession) {
        _adminSession.value = session
    }

    fun logoutAdmin() {
        _adminSession.value = null
    }

    fun updateStoreStatus(isOpen: Boolean, isHolidayMode: Boolean, notice: String) {
        _storeStatus.value = _storeStatus.value.copy(
            isOpen = isOpen,
            isHolidayMode = isHolidayMode,
            noticeBanner = notice
        )
    }

    fun addPosItem(item: POSProductItem) {
        val current = _posCart.value.toMutableList()
        val index = current.indexOfFirst { it.item.sku == item.sku }
        if (index != -1) {
            val existing = current[index]
            val newQty = existing.quantity + 1.0
            current[index] = existing.copy(
                quantity = newQty,
                lineTotal = (newQty * item.price).toLong()
            )
        } else {
            current.add(
                POSCartItem(
                    id = UUID.randomUUID().toString(),
                    item = item,
                    quantity = 1.0,
                    lineTotal = item.price
                )
            )
        }
        _posCart.value = current
    }

    fun removePosItem(id: String) {
        _posCart.value = _posCart.value.filter { it.id != id }
    }

    fun clearPosCart() {
        _posCart.value = emptyList()
    }

    fun completePosCheckout(paymentMethod: String, cashTendered: Long?): POSTransactionReceipt {
        val items = _posCart.value
        val subtotal = items.sumOf { it.lineTotal }
        val tax = (subtotal * 0.11).toLong() // 11% PPN
        val total = subtotal + tax
        val cashChange = if (cashTendered != null && cashTendered >= total) cashTendered - total else 0L

        val receipt = POSTransactionReceipt(
            receiptNumber = "RCP-2026-" + (1000..9999).random(),
            timestamp = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault()).format(Date()),
            storeName = _selectedStore.value.name,
            cashierName = _adminSession.value?.userName ?: "Head Cashier",
            items = items,
            subtotal = subtotal,
            discount = 0L,
            tax = tax,
            total = total,
            paymentMethod = paymentMethod,
            cashTendered = cashTendered,
            cashChange = cashChange
        )

        clearPosCart()
        return receipt
    }

    fun approvePurchaseOrder(poId: String) {
        _purchaseOrders.value = _purchaseOrders.value.map { po ->
            if (po.id == poId) po.copy(status = "Completed") else po
        }
    }

    fun recordWaste(productName: String, qty: Double, unit: String, cost: Long, reason: String, action: String) {
        val newRecord = WasteRecord(
            id = "WST-2026-" + (100..999).random(),
            productName = productName,
            storeName = _selectedStore.value.name,
            quantityScrapped = qty,
            unit = unit,
            totalLossCost = cost,
            reason = reason,
            actionTaken = action,
            reportedAt = SimpleDateFormat("dd MMM, HH:mm", Locale.getDefault()).format(Date()),
            reportedBy = _adminSession.value?.userName ?: "Staff"
        )
        _wasteRecords.value = listOf(newRecord) + _wasteRecords.value
    }
}
