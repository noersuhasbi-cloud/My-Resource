# GroceMart - Android Application

GroceMart is a modern Android mobile application built with **Kotlin** and **Jetpack Compose**, implementing Material Design 3 guidelines for an omnichannel grocery retail chain operating 34 supermarkets across Indonesia.

## Highlights & Features

- **Storefront & Catalog**:
  - Live farm-fresh produce, sourdough bakery, dairy, pasture eggs, butchery & single-origin coffee.
  - Sourcing traceability (Lembang, Bedugul, Ciwidey, Salatiga highlands).
  - Search and filter by product categories with nutritional highlights & cold-chain storage tips.
- **34 Supermarket Locations**:
  - Store directory across Jakarta, Bandung, Surabaya, Bali, Yogyakarta, and Medan.
  - Flagship badges, operating hours, amenities, store manager details, and one-tap pickup selection.
- **Cart & Instant Checkout**:
  - 1-Hour cold-chain delivery, scheduled delivery, or free click-and-collect store pickup.
  - Promo vouchers (`GROCEHERITAGE` for 15% discount).
  - Standardized Indonesian QRIS (Quick Response Code Indonesian Standard) payment with interactive instant payment simulation.
- **Real-Time Order Tracking & Customer Portal**:
  - Gold membership status, 2,450 GrocePoints balance.
  - Live 5-stage fulfillment timeline (Placed -> Paid -> Packed -> In Transit -> Delivered).
  - Courier dispatch information (Electric scooter vehicle plate, phone, estimated arrival).
- **Heritage & Cold-Chain Story**:
  - The Santoso family journey from 1998 Pasar Baru Bandung corner stand to 34 supermarkets nationwide.
  - Dedicated 4°C cold-chain fleet and Fair Harvest farmer guarantee.
- **Operations & Staff ERP Portal**:
  - Shift-based login profiles: Store Manager, Head Cashier, Warehouse Picker, Operations Executive, System Admin.
  - Executive Overview: Consolidated chain revenue, DoD/WoW growth, QRIS conversion rate (98.4%).
  - Store Operations: Emergency weather closure toggle, holiday mode toggle, live broadcast banner.
  - FEFO Batches: First Expired, First Out shelf-life tracking and lot numbers.
  - Procurement & POs: Purchase orders and cold-chain goods receipt verification.
  - Waste & Evaporation Shrinkage: Weight loss tolerance monitoring and bio-composting compliance.
  - In-Store Picker Station: Catch-weight scale entries and substitution management.
  - POS Cashier Station: Counter barcode items, 11% PPN tax calculation, cash change calculation, and printable receipts.
  - Financial Ledger: Double-entry accounting and general ledger postings.

## Architecture

- **UI Framework**: Jetpack Compose with Material 3 Design System
- **Architecture Pattern**: MVVM (Model - View - ViewModel) with unidirectional data flow
- **State Management**: Kotlin Coroutines `StateFlow` and `asStateFlow()`
- **Launcher Icon**: Custom adaptive launcher icon with vector foreground, pinned `#15803d` background, and full-density raster mipmaps
- **Package Name**: `com.aistudio.grocemart`
- **Application ID**: `com.aistudio.grocemart.kxmpzq`
- **Android Target**: SDK 35 (compileSdk: 35, minSdk: 26)
