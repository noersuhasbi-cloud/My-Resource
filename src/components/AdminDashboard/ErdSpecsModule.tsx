import React, { useState } from 'react';
import {
  Database,
  FileCode,
  Layers,
  Palette,
  Terminal,
  Cpu,
  BookOpen,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface ErdSpecsModuleProps {
  theme: 'light' | 'dark';
}

export const ErdSpecsModule: React.FC<ErdSpecsModuleProps> = ({ theme }) => {
  const [activeTab, setActiveTab] = useState<'erd' | 'tokens' | 'algorithms'>('erd');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const isLight = theme === 'light';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 sm:p-6 rounded-2xl border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50 via-white to-stone-50 border-emerald-900/10 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
            : 'bg-stone-900/80 border-stone-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0F4C3A] text-white tracking-wide uppercase">
                Technical Specifications &amp; Architecture
              </span>
              <span className={`text-xs ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                Production ERP Blueprint
              </span>
            </div>
            <h2
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              System Architecture, ERD Schema &amp; Algorithms
            </h2>
            <p
              className={`text-xs sm:text-sm mt-1 max-w-2xl ${
                isLight ? 'text-stone-600' : 'text-stone-400'
              }`}
            >
              Complete enterprise documentation covering normalized PostgreSQL/Firestore schemas,
              clean UI/UX Tailwind design tokens, and algorithmic logic for FEFO stock rotation,
              catch-weight pricing, and multi-store General Ledger double entries.
            </p>
          </div>

          {/* Subtabs */}
          <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('erd')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'erd'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Database ERD
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tokens'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Design Tokens
            </button>
            <button
              onClick={() => setActiveTab('algorithms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'algorithms'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Core Algorithms
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: DATABASE ERD SCHEMA */}
      {activeTab === 'erd' && (
        <div className="space-y-4">
          <div
            className={`rounded-2xl border p-5 sm:p-6 transition-all ${
              isLight
                ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                : 'bg-stone-900/90 border-stone-800'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-stone-900 dark:text-white">
                  Entity-Relationship Data Model (ERD)
                </h3>
              </div>
              <button
                onClick={() =>
                  copyToClipboard(
                    `-- GroceMart Enterprise Multi-Store ERP Schema
CREATE TABLE store_outlets (
  store_id VARCHAR(64) PRIMARY KEY,
  store_name VARCHAR(128) NOT NULL,
  city VARCHAR(64) NOT NULL,
  timezone VARCHAR(10) DEFAULT 'WIB',
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_emergency_closed BOOLEAN DEFAULT FALSE,
  is_holiday_mode BOOLEAN DEFAULT FALSE
);

CREATE TABLE warehouse_zones (
  zone_id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(64) REFERENCES store_outlets(store_id),
  name VARCHAR(64) NOT NULL,
  storage_type VARCHAR(32) NOT NULL, -- 'ambient' | 'cold_chilled' | 'freezer'
  temperature_target VARCHAR(16) NOT NULL,
  capacity_cubic_meters NUMERIC NOT NULL
);

CREATE TABLE inventory_batches (
  batch_id VARCHAR(64) PRIMARY KEY,
  sku VARCHAR(64) NOT NULL,
  store_id VARCHAR(64) REFERENCES store_outlets(store_id),
  warehouse_zone_id VARCHAR(64) REFERENCES warehouse_zones(zone_id),
  lot_number VARCHAR(64) NOT NULL,
  initial_quantity NUMERIC NOT NULL,
  current_stock NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  received_date TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP NOT NULL,
  status VARCHAR(32) DEFAULT 'fresh'
);

CREATE TABLE waste_records (
  waste_id VARCHAR(64) PRIMARY KEY,
  sku VARCHAR(64) NOT NULL,
  store_id VARCHAR(64) REFERENCES store_outlets(store_id),
  batch_id VARCHAR(64),
  quantity_scrapped NUMERIC NOT NULL,
  total_shrinkage_cost NUMERIC NOT NULL,
  reason VARCHAR(64) NOT NULL, -- 'expired' | 'damaged' | 'chiller_temp_breach'
  action_taken VARCHAR(64) NOT NULL, -- 'bio_compost' | 'safe_disposal'
  gl_entry_id VARCHAR(64),
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_orders (
  po_id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(64) REFERENCES store_outlets(store_id),
  supplier_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) DEFAULT 'Sent', -- 'Sent' | 'Partially Received' | 'Completed'
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE general_ledger_entries (
  entry_id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(64) REFERENCES store_outlets(store_id),
  account_code VARCHAR(16) NOT NULL, -- 1010, 1040, 2010, 4010, 5010, 6030
  account_name VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  reference_type VARCHAR(64) NOT NULL,
  reference_id VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
                    'sql'
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedSection === 'sql' ? 'Copied!' : 'Copy DDL'}
              </button>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 mb-4">
              Normalized relational schema architected for PostgreSQL / Cloud SQL and mapped into
              Firestore document collections. Supports isolated multi-store accounting, batch
              expiration tracking (FEFO), and atomic Goods Receipt backorders.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Table 1: Store Outlets */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  store_outlets
                </div>
                <div className="space-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
                  <div>&bull; store_id (PK, varchar)</div>
                  <div>&bull; store_name (varchar)</div>
                  <div>&bull; city (varchar)</div>
                  <div>&bull; open_time, close_time (time)</div>
                  <div>&bull; is_emergency_closed (bool)</div>
                  <div>&bull; is_holiday_mode (bool)</div>
                </div>
              </div>

              {/* Table 2: Warehouse Zones */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  warehouse_zones
                </div>
                <div className="space-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
                  <div>&bull; zone_id (PK, varchar)</div>
                  <div>&bull; store_id (FK &rarr; store_outlets)</div>
                  <div>&bull; storage_type (ambient | chilled | freezer)</div>
                  <div>&bull; temperature_target (varchar)</div>
                  <div>&bull; capacity_cubic_meters (numeric)</div>
                </div>
              </div>

              {/* Table 3: Inventory Batches (FEFO) */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  inventory_batches (FEFO)
                </div>
                <div className="space-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
                  <div>&bull; batch_id (PK, varchar)</div>
                  <div>&bull; sku (varchar, indexed)</div>
                  <div>&bull; store_id (FK &rarr; store_outlets)</div>
                  <div>&bull; lot_number (varchar)</div>
                  <div>&bull; current_stock (numeric)</div>
                  <div>&bull; expiry_date (timestamp, ASC index)</div>
                </div>
              </div>

              {/* Table 4: Waste Records */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  waste_records (Shrinkage)
                </div>
                <div className="space-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
                  <div>&bull; waste_id (PK, varchar)</div>
                  <div>&bull; sku (varchar)</div>
                  <div>&bull; store_id (FK &rarr; store_outlets)</div>
                  <div>&bull; quantity_scrapped (numeric)</div>
                  <div>&bull; total_shrinkage_cost (numeric)</div>
                  <div>&bull; gl_entry_id (FK &rarr; general_ledger)</div>
                </div>
              </div>

              {/* Table 5: Purchase Orders & Partial GR */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  purchase_orders &amp; GR
                </div>
                <div className="space-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
                  <div>&bull; po_id (PK, varchar)</div>
                  <div>&bull; ordered_quantity, received_qty</div>
                  <div>&bull; remaining_backorder (numeric)</div>
                  <div>&bull; status (Sent | Partial | Completed)</div>
                  <div>&bull; cold_chain_verified (bool)</div>
                </div>
              </div>

              {/* Table 6: Multi-Store General Ledger */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  general_ledger_entries
                </div>
                <div className="space-y-1 font-mono text-[11px] text-stone-600 dark:text-stone-400">
                  <div>&bull; entry_id (PK, varchar)</div>
                  <div>&bull; store_id (Tag for per-store P&amp;L)</div>
                  <div>&bull; account_code (1010, 1040, 2010, 6030)</div>
                  <div>&bull; debit, credit (numeric)</div>
                  <div>&bull; reference_type (QRIS | GR | WASTE)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DESIGN TOKENS & SYSTEM SPEC */}
      {activeTab === 'tokens' && (
        <div
          className={`rounded-2xl border p-5 sm:p-6 transition-all ${
            isLight
              ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
              : 'bg-stone-900/90 border-stone-800'
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-stone-900 dark:text-white">
              UI/UX Design Tokens &amp; Theme Matrix
            </h3>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400 mb-6">
            Engineered with a default clean, whitespace-dominant Light Mode using subtle borders,
            soft elevated shadows, and deep forest green accents matching GroceMart&apos;s brand.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Light Mode (Default Theme)
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Page Background</span>
                  <code className="font-mono font-semibold">#F8F9FA / bg-stone-50</code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Card Background</span>
                  <code className="font-mono font-semibold">#FFFFFF / bg-white</code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Subtle Card Border</span>
                  <code className="font-mono font-semibold">#E5E7EB / border-stone-200</code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Primary Brand Accent</span>
                  <code className="font-mono font-semibold text-emerald-800">#0F4C3A (Forest Green)</code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Elevation Shadow</span>
                  <code className="font-mono text-[11px]">box-shadow: 0 4px 20px rgba(0,0,0,0.03)</code>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-stone-500">Border Radius</span>
                  <code className="font-mono font-semibold">rounded-xl / rounded-2xl (12-16px)</code>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Alerts &amp; Semantic Colors
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Critical Expiry &amp; Waste</span>
                  <code className="font-mono font-semibold text-rose-600">#E11D48 / text-rose-600</code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Near-Expiry &amp; Scale Alert</span>
                  <code className="font-mono font-semibold text-amber-600">#D99B00 / text-amber-600</code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Settled QRIS &amp; Fresh</span>
                  <code className="font-mono font-semibold text-emerald-600">#059669 / text-emerald-600</code>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/60 dark:border-stone-800">
                  <span className="text-stone-500">Catch-Weight Precision</span>
                  <code className="font-mono font-semibold text-indigo-600">#4F46E5 / text-indigo-600</code>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-stone-500">Typography Family</span>
                  <code className="font-mono font-semibold">Plus Jakarta Sans / Inter</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CORE EXECUTION ALGORITHMS */}
      {activeTab === 'algorithms' && (
        <div className="space-y-4">
          {/* Algorithm 1: FEFO Stock Allocation */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 transition-all ${
              isLight
                ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                : 'bg-stone-900/90 border-stone-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                1. First Expired, First Out (FEFO) Stock Allocation Algorithm
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
              Triggered during checkout fulfillment. Sorts inventory lots by expiration date and
              exhausts earlier harvested lots first.
            </p>
            <div className="p-4 rounded-xl bg-stone-950 text-stone-100 font-mono text-xs overflow-x-auto leading-relaxed">
              <pre>{`function allocateFEFO(sku, requestedQty, storeId) {
  // 1. Fetch active batches for SKU and store
  const eligibleBatches = db.batches.find({
    sku: sku,
    storeId: storeId,
    currentStock: { $gt: 0 }
  }).sort({ expiryDate: 1 }); // ASCENDING: Earliest expiration first!

  let remaining = requestedQty;
  const allocations = [];
  let totalCogs = 0;

  for (const batch of eligibleBatches) {
    if (remaining <= 0) break;
    const qtyToTake = Math.min(batch.currentStock, remaining);
    
    batch.currentStock -= qtyToTake;
    remaining -= qtyToTake;
    const cogs = qtyToTake * batch.unitCost;
    totalCogs += cogs;

    allocations.push({
      batchId: batch.batchId,
      lotNumber: batch.lotNumber,
      expiryDate: batch.expiryDate,
      allocatedQty: qtyToTake,
      cogsCost: cogs
    });
  }

  // 2. Return trace & verify no shortage
  return { allocations, totalCogs, shortage: remaining };
}`}</pre>
            </div>
          </div>

          {/* Algorithm 2: Partial Goods Receipt */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 transition-all ${
              isLight
                ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                : 'bg-stone-900/90 border-stone-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                2. Partial Goods Receipt (GR) &amp; Backorder Accounting Logic
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
              Handles vendor deliveries fulfilling only part of a PO. Updates stock for received items,
              tracks remaining backorders, and automatically creates Trade Accounts Payable journal entries.
            </p>
            <div className="p-4 rounded-xl bg-stone-950 text-stone-100 font-mono text-xs overflow-x-auto leading-relaxed">
              <pre>{`async function processPartialGoodsReceipt(poId, receivedItems, deliveryNote) {
  return await db.transaction(async (tx) => {
    const po = await tx.purchaseOrders.get(poId);
    let totalValueReceived = 0;

    for (const item of receivedItems) {
      const poLine = po.items.find(i => i.sku === item.sku);
      poLine.receivedQuantity += item.quantityReceived;
      poLine.remainingBackorder = poLine.orderedQuantity - poLine.receivedQuantity;
      
      const lineCost = item.quantityReceived * poLine.unitCost;
      totalValueReceived += lineCost;

      // Increment physical stock & create new FEFO lot
      await tx.inventory.incrementStock(item.sku, po.storeId, item.quantityReceived);
      await tx.batches.createLot({
        sku: item.sku,
        storeId: po.storeId,
        quantity: item.quantityReceived,
        expiryDate: item.expiryDate
      });
    }

    // Check if PO is fully received or partial
    const hasBackorders = po.items.some(i => i.remainingBackorder > 0);
    po.status = hasBackorders ? 'Partially Received' : 'Completed';

    // Auto-Post Double Entry to General Ledger:
    // Debit 1040: Merchandise Inventory Asset
    // Credit 2010: Trade Accounts Payable
    await tx.generalLedger.post({
      debitAccount: '1040',
      creditAccount: '2010',
      amount: totalValueReceived,
      storeId: po.storeId,
      referenceType: 'PARTIAL_GR',
      referenceId: poId
    });
  });
}`}</pre>
            </div>
          </div>

          {/* Algorithm 3: Store Operating Hours Check */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 transition-all ${
              isLight
                ? 'bg-white border-stone-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]'
                : 'bg-stone-900/90 border-stone-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                3. Granular Store Operating Hours &amp; Cart Guard
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
              Guards customer checkouts. Locks QRIS initiation outside configured outlet operating
              hours while retaining customer catalog browsing.
            </p>
            <div className="p-4 rounded-xl bg-stone-950 text-stone-100 font-mono text-xs overflow-x-auto leading-relaxed">
              <pre>{`function checkStoreCheckoutAllowed(outletSchedule, networkStatus) {
  // 1. Company-wide maintenance takes precedence
  if (!networkStatus.isOpen) {
    return { allowed: false, reason: networkStatus.noticeBanner };
  }

  // 2. Outlet emergency closure
  if (outletSchedule.isEmergencyClosed) {
    return { allowed: false, reason: outletSchedule.closureReason };
  }

  // 3. Timezone-aware hours evaluation (WIB/WITA/WIT)
  const now = getCurrentTimeInTimezone(outletSchedule.timezone);
  const isWithinHours = now >= outletSchedule.openTime && now <= outletSchedule.closeTime;

  if (!isWithinHours) {
    return {
      allowed: false,
      reason: \`\${outletSchedule.storeName} is closed. Orders open daily at \${outletSchedule.openTime}.\`,
      catalogAllowed: outletSchedule.allowCatalogBrowsingWhenClosed
    };
  }

  return { allowed: true };
}`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
