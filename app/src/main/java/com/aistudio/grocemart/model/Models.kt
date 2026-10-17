package com.aistudio.grocemart.model

enum class ProductCategory(val label: String) {
    ALL("All Categories"),
    PRODUCE("Fresh Produce"),
    BAKERY("Artisan Bakery"),
    DAIRY_EGGS("Dairy & Farm Eggs"),
    MEAT_SEAFOOD("Butchery & Seafood"),
    PANTRY_COFFEE("Pantry & Coffee")
}

data class StoreLocation(
    val id: String,
    val name: String,
    val city: String,
    val district: String,
    val address: String,
    val postalCode: String,
    val phone: String,
    val hours: String,
    val isFlagship: Boolean = false,
    val manager: String,
    val establishedYear: Int,
    val amenities: List<String>,
    val pickupAvailable: Boolean = true
)

data class Product(
    val id: String,
    val name: String,
    val category: ProductCategory,
    val categoryLabel: String,
    val price: Long, // in IDR
    val unit: String,
    val origin: String,
    val farmPartner: String? = null,
    val isOrganic: Boolean = false,
    val isFarmDirect: Boolean = false,
    val rating: Double,
    val reviewCount: Int,
    val stock: Int,
    val description: String,
    val imageDrawableRes: String = "category_fresh_produce",
    val storageTip: String? = null,
    val nutritionHighlights: List<String> = emptyList()
)

data class CartItem(
    val product: Product,
    val quantity: Int,
    val notes: String = ""
)

enum class OrderStatus(val label: String) {
    PLACED("Order Placed"),
    PAID("Payment Confirmed"),
    PACKING("Picker Packing"),
    IN_TRANSIT("Courier In Transit"),
    READY_FOR_PICKUP("Ready for Pickup"),
    DELIVERED("Delivered")
}

data class OrderTimelineStep(
    val status: OrderStatus,
    val label: String,
    val description: String,
    val timestamp: String,
    val completed: Boolean
)

data class Order(
    val id: String,
    val createdAt: String,
    val customerName: String,
    val customerEmail: String,
    val customerPhone: String,
    val deliveryMethod: String, // "instant", "scheduled", "pickup"
    val deliveryAddressLine: String? = null,
    val pickupStoreName: String? = null,
    val items: List<CartItem>,
    val subtotal: Long,
    val deliveryFee: Long,
    val discount: Long,
    val voucherApplied: String? = null,
    val total: Long,
    val paymentMethod: String, // "qris", "bank_transfer", "card"
    val paymentStatus: String, // "unpaid", "paid"
    val qrisRef: String? = null,
    val status: OrderStatus,
    val courierName: String? = null,
    val courierPhone: String? = null,
    val vehiclePlate: String? = null,
    val estimatedArrival: String? = null,
    val timeline: List<OrderTimelineStep>
)

data class CustomerAccount(
    val id: String,
    val name: String,
    val email: String,
    val phone: String,
    val memberTier: String, // "Silver Member", "Gold Member", "Platinum Member"
    val grocePoints: Int,
    val memberSince: String,
    val defaultAddress: String
)

data class Milestone(
    val year: Int,
    val title: String,
    val subtitle: String,
    val description: String,
    val metric: String
)

data class StoreOperationalStatus(
    val isOpen: Boolean = true,
    val isHolidayMode: Boolean = false,
    val noticeBanner: String = "All 34 GroceMart locations open. Guaranteed 4°C cold chain fresh delivery within 60 mins.",
    val reopenEstimated: String? = null
)

enum class UserRole(val title: String) {
    STORE_MANAGER("Store Manager"),
    CASHIER("Head Cashier"),
    WAREHOUSE_PICKER("Fulfillment Picker"),
    EXECUTIVE("Operations Executive"),
    ADMIN("System Admin")
}

data class StaffShiftSession(
    val userId: String,
    val userName: String,
    val userRole: UserRole,
    val storeName: String,
    val activeShiftId: String,
    val shiftName: String
)

data class InventoryBatch(
    val batchId: String,
    val sku: String,
    val productName: String,
    val storeName: String,
    val lotNumber: String,
    val currentStock: Int,
    val unitCost: Long,
    val sellingPrice: Long,
    val receivedDate: String,
    val expiryDate: String,
    val daysUntilExpiry: Int,
    val status: String, // "fresh", "near_expiry", "critical", "expired"
    val storageZone: String
)

data class PurchaseOrder(
    val id: String,
    val createdAt: String,
    val storeName: String,
    val supplierName: String,
    val itemsSummary: String,
    val totalCost: Long,
    val status: String, // "Draft", "Sent", "Partially Received", "Completed"
    val expectedDeliveryDate: String
)

data class WasteRecord(
    val id: String,
    val productName: String,
    val storeName: String,
    val quantityScrapped: Double,
    val unit: String,
    val totalLossCost: Long,
    val reason: String,
    val actionTaken: String,
    val reportedAt: String,
    val reportedBy: String
)

data class PickerOrder(
    val orderId: String,
    val customerName: String,
    val storeName: String,
    val deliveryMethod: String,
    val priority: String, // "Express 30-min", "Standard"
    val pickerStatus: String, // "Assigned", "In Progress", "Ready for Packing", "Completed"
    val totalItems: Int,
    val pickedItems: Int,
    val hasCatchWeight: Boolean = false
)

data class GeneralLedgerEntry(
    val id: String,
    val timestamp: String,
    val storeName: String,
    val accountCode: String,
    val accountName: String,
    val debit: Long,
    val credit: Long,
    val referenceType: String,
    val description: String
)

data class POSProductItem(
    val sku: String,
    val name: String,
    val category: String,
    val price: Long,
    val unit: String,
    val barcode: String,
    val isWeighted: Boolean = false,
    val pricePerKg: Long = 0
)

data class POSCartItem(
    val id: String,
    val item: POSProductItem,
    val quantity: Double,
    val lineTotal: Long
)

data class POSTransactionReceipt(
    val receiptNumber: String,
    val timestamp: String,
    val storeName: String,
    val cashierName: String,
    val items: List<POSCartItem>,
    val subtotal: Long,
    val discount: Long,
    val tax: Long,
    val total: Long,
    val paymentMethod: String,
    val cashTendered: Long? = null,
    val cashChange: Long? = null
)
