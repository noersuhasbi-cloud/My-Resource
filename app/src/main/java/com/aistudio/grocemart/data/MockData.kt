package com.aistudio.grocemart.data

import com.aistudio.grocemart.model.*

object MockData {

    val STORE_LOCATIONS = listOf(
        StoreLocation(
            id = "store-jkt-senopati",
            name = "GroceMart Senopati Flagship",
            city = "Jakarta",
            district = "Kebayoran Baru, South Jakarta",
            address = "Jl. Senopati No. 82, Selong, Kebayoran Baru",
            postalCode = "12110",
            phone = "+62 21 720 8891",
            hours = "07:00 - 22:00 Daily",
            isFlagship = true,
            manager = "Hendra Setiawan",
            establishedYear = 2012,
            amenities = listOf("In-House Artisan Bakery", "Hydroponic Wall", "Gourmet Butchery", "EV Charging", "1-Hr Express Hub", "Free Parking"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-jkt-pik",
            name = "GroceMart PIK 2 The Avenue",
            city = "Jakarta",
            district = "Penjaringan, North Jakarta",
            address = "Golf Island Boulevard Blok E No. 12-15, PIK",
            postalCode = "14470",
            phone = "+62 21 502 9942",
            hours = "08:00 - 22:00 Daily",
            isFlagship = true,
            manager = "Clarissa Tan",
            establishedYear = 2021,
            amenities = listOf("Live Seafood Tank", "Imported Cheese Cellar", "Café & Salad Bar", "Click & Collect Bay"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-jkt-menteng",
            name = "GroceMart Menteng Heritage",
            city = "Jakarta",
            district = "Menteng, Central Jakarta",
            address = "Jl. Teuku Cik Ditiro No. 24, Menteng",
            postalCode = "10350",
            phone = "+62 21 319 3341",
            hours = "07:30 - 21:30 Daily",
            manager = "Bambang Soediro",
            establishedYear = 2016,
            amenities = listOf("Organic Produce Bar", "Artisanal Deli", "Heritage Coffee Roastery", "Eco Refill"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-bdg-dago",
            name = "GroceMart Dago Green Market",
            city = "Bandung",
            district = "Coblong, North Bandung",
            address = "Jl. Ir. H. Juanda No. 168, Dago",
            postalCode = "40135",
            phone = "+62 22 250 4421",
            hours = "07:00 - 21:30 Daily",
            isFlagship = true,
            manager = "Dewi Kartika",
            establishedYear = 2004,
            amenities = listOf("Lembang Farm Direct", "Sourdough Bakery", "Plant Nursery", "Bike Parking"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-bdg-riau",
            name = "GroceMart Riau Heritage Hub",
            city = "Bandung",
            district = "Sumur Bandung, Bandung",
            address = "Jl. L. L. R.E. Martadinata No. 74, Citarum",
            postalCode = "40115",
            phone = "+62 22 423 7712",
            hours = "08:00 - 21:00 Daily",
            manager = "Asep Ridwan",
            establishedYear = 1998,
            amenities = listOf("Original 1998 Store Room", "Local Artisan Market", "Butchery", "Express Pick & Go"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-sby-dharmahusada",
            name = "GroceMart Dharmahusada Gourmet",
            city = "Surabaya",
            district = "Gubeng, East Surabaya",
            address = "Jl. Raya Dharmahusada Indah No. 45",
            postalCode = "60115",
            phone = "+62 31 599 1100",
            hours = "07:30 - 22:00 Daily",
            isFlagship = true,
            manager = "Surya Wirawan",
            establishedYear = 2017,
            amenities = listOf("Japanese Wagyu Cut", "Cold Pressed Juice", "Click & Collect", "Covered Parking"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-bali-sanur",
            name = "GroceMart Sanur Coastal Fresh",
            city = "Bali",
            district = "Sanur, South Denpasar",
            address = "Jl. Danau Tamblingan No. 102, Sanur",
            postalCode = "80228",
            phone = "+62 361 288 903",
            hours = "07:00 - 22:00 Daily",
            isFlagship = true,
            manager = "Wayan Sudarta",
            establishedYear = 2019,
            amenities = listOf("Bedugul Organic Greens", "Fruit Carving", "Bakery & Gelato", "Bicycle Lockers"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-bali-canggu",
            name = "GroceMart Canggu Organic Market",
            city = "Bali",
            district = "North Kuta, Badung",
            address = "Jl. Pantai Batu Bolong No. 58, Canggu",
            postalCode = "80351",
            phone = "+62 361 909 3321",
            hours = "07:00 - 22:00 Daily",
            manager = "Made Arya",
            establishedYear = 2022,
            amenities = listOf("Vegan & Gluten-Free Section", "Bulk Grains", "Organic Juice Bar", "Pet Friendly"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-ygy-kaliurang",
            name = "GroceMart Kaliurang Agro Fresh",
            city = "Yogyakarta",
            district = "Depok, Sleman",
            address = "Jl. Kaliurang KM 8.5 No. 19, Sinduharjo",
            postalCode = "55581",
            phone = "+62 274 882 109",
            hours = "07:30 - 21:30 Daily",
            manager = "Sri Wahyuni",
            establishedYear = 2020,
            amenities = listOf("Merapi Slope Farm Direct", "Traditional Heritage Rice", "Fresh Milk Station"),
            pickupAvailable = true
        ),
        StoreLocation(
            id = "store-mdn-ringroad",
            name = "GroceMart Medan Ringroad Center",
            city = "Medan",
            district = "Medan Sunggal, Medan",
            address = "Jl. Ring Road Gagak Hitam No. 78",
            postalCode = "20128",
            phone = "+62 61 822 5501",
            hours = "08:00 - 21:30 Daily",
            manager = "Rahmat Hidayat",
            establishedYear = 2023,
            amenities = listOf("Brastagi Fresh Produce Hub", "Halal Butchery Certified", "Family Trolleys", "Fast QRIS"),
            pickupAvailable = true
        )
    )

    val PRODUCTS = listOf(
        Product(
            id = "prod-01",
            name = "Organic Hydroponic Butterhead Lettuce",
            category = ProductCategory.PRODUCE,
            categoryLabel = "Fresh Produce",
            price = 18500,
            unit = "250g head",
            origin = "Lembang Highlands, West Java",
            farmPartner = "Kebun Sari Bumi Eco-Farm",
            isOrganic = true,
            isFarmDirect = true,
            rating = 4.9,
            reviewCount = 342,
            stock = 48,
            description = "Crisp, sweet, and pesticide-free butterhead lettuce harvested early this morning in climate-controlled hydroponic greenhouses. Kept root-intact for prolonged crispness.",
            imageDrawableRes = "category_fresh_produce",
            storageTip = "Store in refrigerator with roots slightly damp in paper towel. Lasts up to 10 days.",
            nutritionHighlights = listOf("Rich in Folate & Vitamin A", "Zero Chemical Residue", "Harvested < 12h Ago")
        ),
        Product(
            id = "prod-02",
            name = "Heirloom Vine-Ripened Sweet Tomatoes",
            category = ProductCategory.PRODUCE,
            categoryLabel = "Fresh Produce",
            price = 24000,
            unit = "500g pack",
            origin = "Ciwidey Valley, West Java",
            farmPartner = "Bumi Lestari Cooperative",
            isOrganic = true,
            isFarmDirect = true,
            rating = 4.8,
            reviewCount = 215,
            stock = 35,
            description = "Sun-kissed heirloom varieties bursting with natural sweetness and balanced acidity. Perfect for fresh garden salads, pasta sauces, or healthy snacking.",
            imageDrawableRes = "about_heritage_farm",
            storageTip = "Keep at room temperature stem-down for richest flavor. Refrigerate only when fully ripe.",
            nutritionHighlights = listOf("High Lycopene Content", "Vitamin C Boost", "Naturally Pollinated")
        ),
        Product(
            id = "prod-03",
            name = "Highland Alpine Strawberries",
            category = ProductCategory.PRODUCE,
            categoryLabel = "Fresh Produce",
            price = 36000,
            unit = "250g punnet",
            origin = "Bedugul, Bali Highlands",
            farmPartner = "Bukit Hijau Farm Bali",
            isOrganic = true,
            isFarmDirect = true,
            rating = 4.9,
            reviewCount = 189,
            stock = 24,
            description = "Sweet, aromatic hand-picked strawberries grown at 1,200m altitude in cool mountain mist. Inspected for uniform ripeness and gentle packing.",
            imageDrawableRes = "category_fresh_produce",
            storageTip = "Wash only right before serving to maintain delicate texture.",
            nutritionHighlights = listOf("Antioxidant Powerhouse", "Low Glycemic Index", "Pure Mountain Sweetness")
        ),
        Product(
            id = "prod-04",
            name = "Stone-Milled Sourdough Country Boule",
            category = ProductCategory.BAKERY,
            categoryLabel = "Artisan Bakery",
            price = 42000,
            unit = "650g loaf",
            origin = "In-House GroceMart Bakery Kitchen",
            farmPartner = "GroceMart Master Bakers",
            isFarmDirect = true,
            rating = 5.0,
            reviewCount = 428,
            stock = 20,
            description = "Slow-fermented for 36 hours using our 12-year-old sourdough mother culture and stone-milled unbleached flour. Features a dark caramelized blistered crust.",
            imageDrawableRes = "category_bakery_deli",
            storageTip = "Store cut-side down on wooden board. Toast thick slices with salted butter.",
            nutritionHighlights = listOf("Naturally Low Glycemic", "Digestive Prebiotics", "Zero Preservatives")
        ),
        Product(
            id = "prod-05",
            name = "French Cultured Butter Croissant (Pack of 2)",
            category = ProductCategory.BAKERY,
            categoryLabel = "Artisan Bakery",
            price = 38000,
            unit = "2 pcs (160g)",
            origin = "In-House GroceMart Bakery Kitchen",
            rating = 4.9,
            reviewCount = 310,
            stock = 28,
            description = "Baked fresh three times daily. Laminated with 84% Normandy-style cultured butter creating 27 delicate golden layers with airy honeycomb interior.",
            imageDrawableRes = "category_bakery_deli",
            storageTip = "Reheat in preheated oven at 170°C for 3 minutes for crisp flake perfection.",
            nutritionHighlights = listOf("Pure Grass-Fed Dairy Butter", "Freshly Baked Today")
        ),
        Product(
            id = "prod-06",
            name = "Free-Range Pasture Golden Omega Eggs",
            category = ProductCategory.DAIRY_EGGS,
            categoryLabel = "Dairy & Farm Eggs",
            price = 32000,
            unit = "Pack of 10 eggs",
            origin = "Salatiga Pastures, Central Java",
            farmPartner = "Peternakan Surya Makmur",
            isFarmDirect = true,
            rating = 4.9,
            reviewCount = 512,
            stock = 50,
            description = "Laid by free-ranging hens fed flaxseed, spirulina, and natural pasture greens. Yields vibrant deep-orange yolks rich in natural DHA and Omega-3 fatty acids.",
            imageDrawableRes = "category_bakery_deli",
            storageTip = "Keep refrigerated pointy end down to maintain air cell stability.",
            nutritionHighlights = listOf("High Omega-3 & Lutein", "Cage-Free Certified", "Antibiotic-Free")
        ),
        Product(
            id = "prod-07",
            name = "Fresh Grass-Fed Whole Milk (Pasteurized)",
            category = ProductCategory.DAIRY_EGGS,
            categoryLabel = "Dairy & Farm Eggs",
            price = 29500,
            unit = "1,000ml bottle",
            origin = "Pengalengan Hills, West Java",
            farmPartner = "Koperasi Susu Lembah Hijau",
            isFarmDirect = true,
            rating = 4.8,
            reviewCount = 260,
            stock = 40,
            description = "Gently low-temperature pasteurized to preserve natural enzymes, creamy mouthfeel, and delicate sweet farm flavor. Non-homogenized with natural cream top.",
            imageDrawableRes = "hero_grocemart_store",
            storageTip = "Store below 4°C. Shake before pouring.",
            nutritionHighlights = listOf("3.8% Natural Butterfat", "Bioavailable Calcium", "Daily Fresh Delivery")
        ),
        Product(
            id = "prod-08",
            name = "Sashimi-Grade Jimbaran Salmon Fillet",
            category = ProductCategory.MEAT_SEAFOOD,
            categoryLabel = "Butchery & Seafood",
            price = 98000,
            unit = "250g skin-on fillet",
            origin = "Cold-Chain Certified Coastal Logistics",
            farmPartner = "Bahari Lestari Indonesia",
            rating = 4.9,
            reviewCount = 178,
            stock = 18,
            description = "Pristine ocean-farmed salmon filleted daily by master fishmongers. Air-shipped on dry ice and never frozen. Rich in natural healthy fats.",
            imageDrawableRes = "category_bakery_deli",
            storageTip = "Cook or consume within 48 hours of purchase. Keep on ice in refrigerator.",
            nutritionHighlights = listOf("1,800mg Omega-3", "Strict Sashimi Sanitation", "Traceable Batch Code")
        ),
        Product(
            id = "prod-09",
            name = "Organic Red Rice from Cianjur Heritage Fields",
            category = ProductCategory.PANTRY_COFFEE,
            categoryLabel = "Pantry & Coffee",
            price = 34000,
            unit = "1 kg vacuum pack",
            origin = "Cianjur, West Java",
            farmPartner = "Kelompok Tani Padi Wangi",
            isOrganic = true,
            isFarmDirect = true,
            rating = 4.9,
            reviewCount = 194,
            stock = 65,
            description = "Cultivated in volcanic soil using ancestral subak irrigation. Naturally fragrant with a wholesome nutty bite, rich dietary fiber, and low glycemic impact.",
            imageDrawableRes = "about_heritage_farm",
            storageTip = "Reseal airtight container after opening. Store in dry cool pantry.",
            nutritionHighlights = listOf("High Dietary Fiber", "Rich in Anthocyanin", "100% Heirloom Grain")
        ),
        Product(
            id = "prod-10",
            name = "Single Origin Toraja Sapan Arabica Coffee",
            category = ProductCategory.PANTRY_COFFEE,
            categoryLabel = "Pantry & Coffee",
            price = 68000,
            unit = "200g whole bean",
            origin = "Sapan, North Toraja, Sulawesi",
            farmPartner = "Toraja Highlands Growers",
            rating = 5.0,
            reviewCount = 304,
            stock = 30,
            description = "Medium roasted weekly in small batches. Tasting notes of dark chocolate, brown sugar sweetness, ripe plum, and sweet herbal finish.",
            imageDrawableRes = "hero_grocemart_store",
            storageTip = "Keep sealed in one-way valve bag away from sunlight.",
            nutritionHighlights = listOf("1,800m Altitude Grown", "Direct Trade Verified", "Fresh Roasted This Week")
        )
    )

    val COMPANY_MILESTONES = listOf(
        Milestone(
            year = 1998,
            title = "The Humble Corner Stand",
            subtitle = "Bandung, West Java",
            description = "Founded by the Santoso family as a modest 30 sqm corner grocery stand in Pasar Baru Bandung, dedicated to sourcing directly from smallholder vegetable growers in Lembang.",
            metric = "1 Store · 4 Local Farmers"
        ),
        Milestone(
            year = 2006,
            title = "Pioneering Cold Chain Standards",
            subtitle = "Preserving Peak Freshness",
            description = "GroceMart established its proprietary 4°C refrigerated supply route from highlands to stores, cutting post-harvest food waste by 65% and delivering farm freshness within 12 hours.",
            metric = "6 Stores · 1st Chilled Fleet"
        ),
        Milestone(
            year = 2014,
            title = "Greater Jakarta Expansion",
            subtitle = "Modernizing Neighborhood Supermarkets",
            description = "Introduced our flagship full-service format combining artisanal bakeries, certified dry-aged butcheries, and hydroponic walls inside premier neighborhood hubs.",
            metric = "18 Stores · 220+ Local Farms"
        ),
        Milestone(
            year = 2021,
            title = "100% Traceable Sustainable Network",
            subtitle = "Fair Farm Pricing & Zero Waste",
            description = "Launched Fair Harvest Agreement guaranteeing contracted baseline purchase prices for Indonesian farmers while eliminating single-use plastic across all stores.",
            metric = "28 Stores · 400+ Farmers"
        ),
        Milestone(
            year = 2026,
            title = "Omnichannel Excellence & QRIS Integration",
            subtitle = "34 Stores Nationwide & Instant Fulfillment",
            description = "Operating 34 premier grocery supermarkets across 6 metropolitan provinces with integrated 1-Hour delivery, automated order tracking, and instant QRIS checkout.",
            metric = "34 Stores · 450+ Farmers · 150k+ Customers"
        )
    )

    val INITIAL_DEMO_ACCOUNT = CustomerAccount(
        id = "usr-demo-01",
        name = "Andi Pratama",
        email = "andi.pratama@gmail.com",
        phone = "+62 812 8892 4431",
        memberTier = "Gold Member",
        grocePoints = 2450,
        memberSince = "March 2021",
        defaultAddress = "Jl. Senopati No. 42B, Kebayoran Baru, Jakarta Selatan"
    )

    val INITIAL_ORDERS = listOf(
        Order(
            id = "ORD-2026-8842",
            createdAt = "Today, 14:15 WIB",
            customerName = "Andi Pratama",
            customerEmail = "andi.pratama@gmail.com",
            customerPhone = "+62 812 8892 4431",
            deliveryMethod = "instant",
            deliveryAddressLine = "Jl. Senopati No. 42B, Kebayoran Baru, Jakarta Selatan",
            pickupStoreName = "GroceMart Senopati Flagship",
            items = listOf(
                CartItem(PRODUCTS[0], 2), // Butterhead Lettuce x2
                CartItem(PRODUCTS[3], 1), // Sourdough Boule x1
                CartItem(PRODUCTS[5], 1)  // Golden Omega Eggs x1
            ),
            subtotal = 111000,
            deliveryFee = 15000,
            discount = 16650,
            voucherApplied = "GROCEHERITAGE",
            total = 109350,
            paymentMethod = "qris",
            paymentStatus = "paid",
            qrisRef = "QRIS-ID-8842-SETTLED",
            status = OrderStatus.IN_TRANSIT,
            courierName = "Budi Hartono",
            courierPhone = "+62 813 9021 8831",
            vehiclePlate = "B 4920 SKJ (Electric Scooter)",
            estimatedArrival = "15:05 WIB (18 mins away)",
            timeline = listOf(
                OrderTimelineStep(OrderStatus.PLACED, "Order Received", "Order recorded in Senopati Flagship hub", "14:15", true),
                OrderTimelineStep(OrderStatus.PAID, "QRIS Instant Settlement", "Verified via Bank Indonesia ASPI Gateway", "14:16", true),
                OrderTimelineStep(OrderStatus.PACKING, "Picked & Cold-Packed", "Chilled insulated tote verified by Picker Rian", "14:32", true),
                OrderTimelineStep(OrderStatus.IN_TRANSIT, "Dispatched on Route", "Courier Budi en route to Kebayoran Baru", "14:45", true),
                OrderTimelineStep(OrderStatus.DELIVERED, "Delivered to Door", "Contactless handoff with photo proof", "Pending", false)
            )
        ),
        Order(
            id = "ORD-2026-8790",
            createdAt = "Yesterday, 10:30 WIB",
            customerName = "Andi Pratama",
            customerEmail = "andi.pratama@gmail.com",
            customerPhone = "+62 812 8892 4431",
            deliveryMethod = "instant",
            deliveryAddressLine = "Jl. Senopati No. 42B, Kebayoran Baru, Jakarta Selatan",
            pickupStoreName = "GroceMart Senopati Flagship",
            items = listOf(
                CartItem(PRODUCTS[7], 1), // Salmon Fillet
                CartItem(PRODUCTS[8], 1)  // Red Rice
            ),
            subtotal = 132000,
            deliveryFee = 15000,
            discount = 0,
            total = 147000,
            paymentMethod = "qris",
            paymentStatus = "paid",
            qrisRef = "QRIS-ID-8790-SETTLED",
            status = OrderStatus.DELIVERED,
            courierName = "Rahmat Santoso",
            courierPhone = "+62 812 4455 6677",
            vehiclePlate = "B 3312 KLP",
            estimatedArrival = "Delivered Yesterday at 11:15 WIB",
            timeline = listOf(
                OrderTimelineStep(OrderStatus.PLACED, "Order Received", "Order confirmed", "10:30", true),
                OrderTimelineStep(OrderStatus.PAID, "Payment Settled", "QRIS payment confirmed", "10:31", true),
                OrderTimelineStep(OrderStatus.PACKING, "Packed", "Master butcher prepared fillet", "10:48", true),
                OrderTimelineStep(OrderStatus.IN_TRANSIT, "Dispatched", "Out for delivery", "10:55", true),
                OrderTimelineStep(OrderStatus.DELIVERED, "Delivered", "Successfully handed to customer", "11:15", true)
            )
        )
    )

    val INITIAL_BATCHES = listOf(
        InventoryBatch("BAT-2026-081", "SKU-PROD-01", "Butterhead Lettuce", "Senopati Flagship", "LOT-LSB-042", 48, 12000, 18500, "16 Oct 2026", "23 Oct 2026", 7, "fresh", "Cold Chilled (4°C)"),
        InventoryBatch("BAT-2026-079", "SKU-PROD-03", "Alpine Strawberries", "Senopati Flagship", "LOT-BHM-019", 24, 24000, 36000, "15 Oct 2026", "18 Oct 2026", 2, "near_expiry", "Cold Chilled (4°C)"),
        InventoryBatch("BAT-2026-075", "SKU-PROD-04", "Sourdough Country Boule", "Senopati Flagship", "LOT-ART-088", 20, 26000, 42000, "17 Oct 2026", "20 Oct 2026", 3, "fresh", "Ambient Bakery (24°C)"),
        InventoryBatch("BAT-2026-068", "SKU-PROD-08", "Jimbaran Salmon Fillet", "Senopati Flagship", "LOT-JMB-033", 18, 68000, 98000, "16 Oct 2026", "18 Oct 2026", 2, "near_expiry", "Chilled Fish Bed (1°C)"),
        InventoryBatch("BAT-2026-062", "SKU-PROD-07", "Grass-Fed Whole Milk", "Senopati Flagship", "LOT-PGL-112", 40, 19000, 29500, "14 Oct 2026", "21 Oct 2026", 5, "fresh", "Cold Chilled (3°C)"),
        InventoryBatch("BAT-2026-055", "SKU-PROD-09", "Cianjur Red Rice", "Senopati Flagship", "LOT-CJR-504", 65, 22000, 34000, "01 Oct 2026", "01 Apr 2027", 166, "fresh", "Dry Ambient (24°C)")
    )

    val INITIAL_PURCHASE_ORDERS = listOf(
        PurchaseOrder("PO-2026-089", "16 Oct 2026", "Senopati Flagship", "Kebun Sari Bumi Eco-Farm", "120x Butterhead Lettuce, 80x Sweet Tomatoes", 2840000, "Sent", "18 Oct 2026"),
        PurchaseOrder("PO-2026-088", "15 Oct 2026", "Senopati Flagship", "Bahari Lestari Indonesia", "30x Sashimi Salmon Fillet, 25x Red Snapper", 3750000, "Partially Received", "17 Oct 2026"),
        PurchaseOrder("PO-2026-085", "12 Oct 2026", "PIK 2 The Avenue", "Peternakan Surya Makmur", "200x Pasture Omega Eggs (10s)", 4800000, "Completed", "14 Oct 2026")
    )

    val INITIAL_WASTE_RECORDS = listOf(
        WasteRecord("WST-2026-042", "Highland Alpine Strawberries", "Senopati Flagship", 1.5, "kg", 144000, "Damaged in Transit", "Bio-Composted (Lembang Partner)", "Today, 09:30", "Dewi Kartika"),
        WasteRecord("WST-2026-041", "Heirloom Vine Tomatoes", "Senopati Flagship", 0.8, "kg", 38400, "Natural Evaporation Trim", "Safe Disposal", "Yesterday, 17:00", "Bambang Soediro")
    )

    val INITIAL_PICKER_ORDERS = listOf(
        PickerOrder("ORD-2026-8842", "Andi Pratama", "Senopati Flagship", "Instant 1-Hr", "Express 30-min", "Completed", 4, 4, true),
        PickerOrder("ORD-2026-8845", "Maya Indrawati", "Senopati Flagship", "Instant 1-Hr", "Express 30-min", "In Progress", 6, 4, false),
        PickerOrder("ORD-2026-8847", "Rizky Fauzi", "Senopati Flagship", "Store Pickup", "Standard", "Assigned", 3, 0, false)
    )

    val INITIAL_LEDGER = listOf(
        GeneralLedgerEntry("GLE-2026-042", "14:16 WIB", "Senopati Flagship", "1010", "Cash & Bank (QRIS Clearing)", 109350, 0, "QRIS_SALE", "ORD-2026-8842 Settlement"),
        GeneralLedgerEntry("GLE-2026-043", "14:16 WIB", "Senopati Flagship", "4010", "Gross Grocery Sales Revenue", 0, 111000, "QRIS_SALE", "Revenue from ORD-2026-8842"),
        GeneralLedgerEntry("GLE-2026-044", "14:16 WIB", "Senopati Flagship", "5010", "Cost of Goods Sold (COGS)", 68000, 0, "INVENTORY_DEDUCT", "FEFO Stock Deduction for ORD-8842"),
        GeneralLedgerEntry("GLE-2026-045", "14:16 WIB", "Senopati Flagship", "1040", "Merchandise Inventory", 0, 68000, "INVENTORY_DEDUCT", "Asset relief for ORD-8842")
    )

    val AVAILABLE_STAFF_SESSIONS = listOf(
        StaffShiftSession("usr-mgr-01", "Hendra Setiawan", UserRole.STORE_MANAGER, "Senopati Flagship", "SHIFT-MORNING-01", "Morning Shift (07:00 - 15:00)"),
        StaffShiftSession("usr-csh-02", "Siti Rahma", UserRole.CASHIER, "Senopati Flagship", "SHIFT-MORNING-01", "Morning Shift (07:00 - 15:00)"),
        StaffShiftSession("usr-pck-03", "Rian Nugraha", UserRole.WAREHOUSE_PICKER, "Senopati Flagship", "SHIFT-MORNING-01", "Morning Shift (07:00 - 15:00)"),
        StaffShiftSession("usr-exe-04", "Budi Santoso", UserRole.EXECUTIVE, "Consolidated HQ", "SHIFT-ALL", "Executive Operations"),
        StaffShiftSession("usr-adm-05", "System Admin", UserRole.ADMIN, "Senopati Flagship", "SHIFT-GLOBAL", "Full Administrator")
    )

    val INITIAL_POS_PRODUCTS = listOf(
        POSProductItem("SKU-PROD-01", "Butterhead Lettuce", "Produce", 18500, "head", "899200101"),
        POSProductItem("SKU-PROD-02", "Heirloom Tomatoes", "Produce", 24000, "pack", "899200102", true, 48000),
        POSProductItem("SKU-PROD-03", "Alpine Strawberries", "Produce", 36000, "punnet", "899200103"),
        POSProductItem("SKU-PROD-04", "Sourdough Boule", "Bakery", 42000, "loaf", "899200104"),
        POSProductItem("SKU-PROD-05", "Cultured Croissant (2x)", "Bakery", 38000, "pack", "899200105"),
        POSProductItem("SKU-PROD-06", "Pasture Golden Eggs", "Dairy", 32000, "pack", "899200106"),
        POSProductItem("SKU-PROD-07", "Grass-Fed Milk (1L)", "Dairy", 29500, "bottle", "899200107"),
        POSProductItem("SKU-PROD-08", "Jimbaran Salmon Fillet", "Meat", 98000, "fillet", "899200108", true, 392000),
        POSProductItem("SKU-PROD-09", "Cianjur Red Rice (1kg)", "Pantry", 34000, "pack", "899200109"),
        POSProductItem("SKU-PROD-10", "Toraja Sapan Coffee", "Coffee", 68000, "bag", "899200110")
    )
}
