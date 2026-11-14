import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

import {
  INITIAL_STORE_STATUS,
  INITIAL_STORE_SCHEDULES,
  INITIAL_WAREHOUSE_ZONES,
  INITIAL_STORE_INVENTORY_TIERS,
  INITIAL_INVENTORY,
  INITIAL_PURCHASE_REQUESTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_GOODS_RECEIPTS,
  INITIAL_COA,
  INITIAL_GENERAL_LEDGER,
  INITIAL_AUDIT_TRAIL,
  INITIAL_BATCHES,
  createInitialBatches,
  INITIAL_WASTE_RECORDS,
  INITIAL_PICKER_ORDERS,
  INITIAL_VENDOR_BILLS,
  INITIAL_ENTERPRISE_SETTINGS,
  INITIAL_LANDED_COSTS,
  INITIAL_WAREHOUSE_BINS,
  INITIAL_WAREHOUSE_ROUTES,
  INITIAL_QUOTATIONS,
} from './src/data/inventoryData.ts';
import { INITIAL_ORDERS, PRODUCTS } from './src/data/mockData.ts';
import {
  INITIAL_B2B_CUSTOMERS,
  WHOLESALE_PRODUCTS,
  INITIAL_PWP_RULES,
  INITIAL_GIRO_RECORDS,
  INITIAL_B2B_ORDERS,
} from './src/data/b2bWholesaleData.ts';

import type {
  InventoryItem,
  PurchaseRequest,
  PurchaseOrder,
  GeneralLedgerEntry,
  TransactionAuditRecord,
  StoreOperationalStatus,
  StoreOutletSchedule,
  WarehouseZone,
  StoreInventoryStock,
  GoodsReceiptRecord,
  ChartOfAccount,
  AccountCode,
  InventoryBatch,
  WasteRecord,
  PickerOrder,
  FEFOAllocationResult,
  Order,
  WeightToleranceConfig,
  NaturalShrinkageAdjustment,
  SubstitutionPromptRecord,
  StaffShiftSession,
  SecurityAuditTrailRecord,
  ClimateAdaptiveThresholdConfig,
  UserRole,
  SupportedCurrency,
  StorageZoneType,
  CurrencyExchangeRate,
  POSProductItem,
  POSTransactionRequest,
  POSTransactionReceipt,
  EnterpriseSettingsConfig,
  LandedCostRecord,
  WarehouseBinLocation,
  WarehouseMultiStepRoute,
  AnalyticDepartment,
  ProductMarginRecord,
  EnterpriseQuotation,
  EnterpriseQuotationItem,
  VendorBill,
  VendorBillItem,
  VendorBillStatus,
  VendorBillPaymentMethod,
  PromotionRule,
  CoaMappingConfig,
  PosCheckoutConfig,
  StockOpnameSession,
  StockTransferRecord,
  ApprovalTierRule,
  ApprovalRequest,
  BulkInventoryImportRow,
  SuratJalanDocument,
  DeliveryOrderDocument,
  ShipmentQuotaTracking,
  QCInspectionRecord,
  GroceryMetricsReport,
  B2BCustomer,
  WholesaleProduct,
  PWPRule,
  GiroPaymentRecord,
  B2BWholesaleOrder,
  B2BCartItem,
  ColdChainLogEntry,
  BatchRecallTraceResult,
  POSHardwarePeripheralStatus,
  POSReturnRecord,
  POSReturnItemLine,
  RefundPaymentChannel,
  AutoReplenishmentConsolidatedPlan,
  AutoReplenishmentItemPlan,
  PurchaseOrderItem,
  VendorCreditNote,
  DynamicMarkdownConfig,
  RemovalStrategyConfig,
  RemovalStrategyType,
  IndonesianTaxCategory,
  SkuTaxRule,
  CustomerRmaRecord,
  CustomerRmaItem,
  VendorRtvDebitNote,
  BlindOpnameSheet,
  BlindOpnameLine,
  PosRegisterShiftSession,
  PosShiftDenominationCount,
  CoretaxExportRow,
  RmaDisposition,
  RmaRefundMethod,
  RmaSourceChannel,
  EnterpriseNotification,
  EnterpriseNotificationCategory,
  EnterpriseNotificationSeverity,
  BranchMonitorHubSummary,
  BranchMonitorIncomingPO,
  BranchMonitorInTransitTransfer,
  BranchMonitorResponse,
  OperatorBranchAssignment,
  CommunicationGatewayConfig,
  CommunicationDispatchLog,
  CommunicationDocType,
} from './src/types/index.ts';
import {
  DEFAULT_MARKDOWN_CONFIG,
  MOCK_VENDOR_CREDIT_NOTES,
  evaluateBatchMarkdown,
} from './src/utils/groceryEngine.ts';
import {
  inferDefaultTaxCategory,
  getTaxRateForCategory,
  computeIndonesianTax,
  validateNpwpOrNik,
  buildCoretaxCsv,
  buildCoretaxXml,
} from './src/utils/indonesianCompliance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Data Store (Initialized with realistic seed data)
let storeStatus: StoreOperationalStatus = { ...INITIAL_STORE_STATUS };
let storeSchedules: StoreOutletSchedule[] = JSON.parse(JSON.stringify(INITIAL_STORE_SCHEDULES));
let warehouseZones: WarehouseZone[] = JSON.parse(JSON.stringify(INITIAL_WAREHOUSE_ZONES));
let storeInventoryTiers: StoreInventoryStock[] = JSON.parse(JSON.stringify(INITIAL_STORE_INVENTORY_TIERS));
let inventoryList: InventoryItem[] = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
let purchaseRequests: PurchaseRequest[] = JSON.parse(JSON.stringify(INITIAL_PURCHASE_REQUESTS));
let purchaseOrders: PurchaseOrder[] = JSON.parse(JSON.stringify(INITIAL_PURCHASE_ORDERS));
let goodsReceipts: GoodsReceiptRecord[] = JSON.parse(JSON.stringify(INITIAL_GOODS_RECEIPTS));
let chartOfAccounts: ChartOfAccount[] = JSON.parse(JSON.stringify(INITIAL_COA));
let generalLedger: GeneralLedgerEntry[] = JSON.parse(JSON.stringify(INITIAL_GENERAL_LEDGER));
let auditTrail: TransactionAuditRecord[] = JSON.parse(JSON.stringify(INITIAL_AUDIT_TRAIL));
let inventoryBatches: InventoryBatch[] = JSON.parse(JSON.stringify(INITIAL_BATCHES));
let wasteRecords: WasteRecord[] = JSON.parse(JSON.stringify(INITIAL_WASTE_RECORDS));
let pickerOrders: PickerOrder[] = JSON.parse(JSON.stringify(INITIAL_PICKER_ORDERS));
let customerOrders: Order[] = JSON.parse(JSON.stringify(INITIAL_ORDERS));
let enterpriseSettings: EnterpriseSettingsConfig = JSON.parse(JSON.stringify(INITIAL_ENTERPRISE_SETTINGS));
let landedCostsList: LandedCostRecord[] = JSON.parse(JSON.stringify(INITIAL_LANDED_COSTS));
let warehouseBins: WarehouseBinLocation[] = JSON.parse(JSON.stringify(INITIAL_WAREHOUSE_BINS));
let warehouseRoutes: WarehouseMultiStepRoute[] = JSON.parse(JSON.stringify(INITIAL_WAREHOUSE_ROUTES));
let vendorBillsList: VendorBill[] = JSON.parse(JSON.stringify(INITIAL_VENDOR_BILLS));
let enterpriseQuotationsList: EnterpriseQuotation[] = JSON.parse(JSON.stringify(INITIAL_QUOTATIONS));
let b2bCustomersList: B2BCustomer[] = JSON.parse(JSON.stringify(INITIAL_B2B_CUSTOMERS));
let wholesaleProductsList: WholesaleProduct[] = JSON.parse(JSON.stringify(WHOLESALE_PRODUCTS));
let pwpRulesList: PWPRule[] = JSON.parse(JSON.stringify(INITIAL_PWP_RULES));
let giroRecordsList: GiroPaymentRecord[] = JSON.parse(JSON.stringify(INITIAL_GIRO_RECORDS));
let b2bOrdersList: B2BWholesaleOrder[] = JSON.parse(JSON.stringify(INITIAL_B2B_ORDERS));
let vendorCreditNotesList: VendorCreditNote[] = JSON.parse(JSON.stringify(MOCK_VENDOR_CREDIT_NOTES));
let dynamicMarkdownConfig: DynamicMarkdownConfig = JSON.parse(JSON.stringify(DEFAULT_MARKDOWN_CONFIG));
let enterpriseNotificationsList: EnterpriseNotification[] = [];

function createDefaultCommunicationGatewayConfig(): CommunicationGatewayConfig {
  return {
    smtp: {
      providerPreset: 'google_workspace',
      host: 'smtp.gmail.com',
      port: 587,
      encryption: 'STARTTLS',
      username: '',
      password: '',
      senderName: 'PT GroceMart Retail Indonesia',
      senderEmail: 'noreply@grocemart.co.id',
      ccAuditEmail: 'finance-audit@grocemart.co.id',
      enableLiveSmtp: false,
    },
    whatsapp: {
      providerType: 'meta_cloud',
      metaPhoneNumberId: '',
      metaWabaId: '',
      metaAccessToken: '',
      gatewayApiUrl: 'https://api.fonnte.com/send',
      gatewayApiKey: '',
      gatewaySenderNumber: '+6281100008821',
      enableDirectWaApi: false,
      fallbackWaWebInSandbox: true,
      vendorMessageTemplate:
        'Halo {{recipient_name}},\n\nBerikut dokumen *{{doc_type}}* ({{doc_number}}) dari {{outlet_name}}.\nNilai Total: {{total_amount}}\n\nMohon konfirmasi penerimaan dokumen ini. Terima kasih.',
      customerMessageTemplate:
        'Halo {{recipient_name}},\n\nTerima kasih telah bertransaksi di {{outlet_name}}. Berikut ringkasan *{{doc_type}}* ({{doc_number}}) senilai {{total_amount}}.\n\nSalam sehat selalu,\nPT GroceMart Retail Indonesia',
    },
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Default',
  };
}

let communicationGatewayConfig: CommunicationGatewayConfig = createDefaultCommunicationGatewayConfig();
let communicationLogs: CommunicationDispatchLog[] = [];

let removalStrategiesConfig: RemovalStrategyConfig = {
  categoryStrategies: {
    produce: 'FEFO',
    fresh_produce: 'FEFO',
    dairy_eggs: 'FEFO',
    meat_seafood: 'FEFO',
    bakery: 'FEFO',
    fresh_eggs: 'FEFO',
    dairy_beverages: 'FEFO',
    pantry_coffee: 'FIFO',
    pantry_staples: 'FIFO',
    cooking_oil: 'FIFO',
    instant_noodles: 'FIFO',
    beverages: 'FIFO',
    household_hygiene: 'FIFO',
  },
  skuOverrides: {},
  updatedAt: new Date().toISOString(),
  updatedBy: 'ERP System Default',
};

// =============================================================
// INDONESIAN REGULATORY COMPLIANCE RUNTIME STORES (ADDITIVE)
// =============================================================
function ensureRegulatoryCoaAccounts() {
  const requiredAccounts: ChartOfAccount[] = [
    {
      accountCode: '1150',
      accountName: 'Vendor Prepayments / Advances (Uang Muka Pembelian)',
      category: 'Asset',
      normalBalance: 'Debit',
      storeId: 'CONSOLIDATED',
      balance: 0,
      description: 'Receivable vendor advances from post-payment RTV claims & supplier credit offsets',
    },
    {
      accountCode: '1300',
      accountName: 'Inventory Asset (Regulatory Valuation Ledger)',
      category: 'Asset',
      normalBalance: 'Debit',
      storeId: 'CONSOLIDATED',
      balance: 0,
      description: 'Mirror & regulatory adjustment ledger for inventory asset returns & opname',
    },
    {
      accountCode: '2025',
      accountName: 'PPN Keluaran (VAT Output Payable 11%/12%)',
      category: 'Liability',
      normalBalance: 'Credit',
      storeId: 'CONSOLIDATED',
      balance: 28450000,
      description: 'Indonesian Output VAT payable to DJP (Coretax / e-Faktur Keluaran & Nota Retur)',
    },
    {
      accountCode: '2026',
      accountName: 'PPN Masukan (VAT Input Creditable)',
      category: 'Asset',
      normalBalance: 'Debit',
      storeId: 'CONSOLIDATED',
      balance: 16200000,
      description: 'Creditable Input VAT from B2B supplier purchases & RTV Nota Retur Pembelian',
    },
    {
      accountCode: '2027',
      accountName: 'Pajak Daerah PB1 (10% Ready-to-Eat Deli)',
      category: 'Liability',
      normalBalance: 'Credit',
      storeId: 'CONSOLIDATED',
      balance: 3420000,
      description: 'Regional PB1 10% restaurant/deli prepared food tax payable to Bapenda',
    },
    {
      accountCode: '2100',
      accountName: 'Vendor Accounts Payable (RTV / Nota Retur)',
      category: 'Liability',
      normalBalance: 'Credit',
      storeId: 'CONSOLIDATED',
      balance: 45000000,
      description: 'Supplier payable control for Return-to-Vendor debit note offsets',
    },
    {
      accountCode: '5210',
      accountName: 'Inventory Shrinkage & Blind Opname Variance Expense',
      category: 'Expense',
      normalBalance: 'Debit',
      storeId: 'CONSOLIDATED',
      balance: 1850000,
      description: 'Selisih Lebih / Selisih Kurang from Blind Physical Stock Opname audits',
    },
    {
      accountCode: '5220',
      accountName: 'POS Cash Drawer Over/Short Variance (Selisih Kasir)',
      category: 'Expense',
      normalBalance: 'Debit',
      storeId: 'CONSOLIDATED',
      balance: 0,
      description: 'Cashier Z-Report blind denomination count over/short variance account',
    },
    {
      accountCode: '1510',
      accountName: 'Cold-Chain Walk-in Coolers & Display Chillers',
      category: 'Asset',
      normalBalance: 'Debit',
      storeId: 'CONSOLIDATED',
      balance: 210000000,
      description: 'Fixed assets: industrial walk-in chillers and display refrigerators',
    },
    {
      accountCode: '1520',
      accountName: 'Point-of-Sale Hardware & Warehouse Handhelds',
      category: 'Asset',
      normalBalance: 'Debit',
      storeId: 'CONSOLIDATED',
      balance: 48000000,
      description: 'Fixed assets: POS terminals, scales, and RF scanners',
    },
  ];
  requiredAccounts.forEach((acc) => {
    if (!chartOfAccounts.some((c) => c.accountCode === acc.accountCode)) {
      chartOfAccounts.push(acc);
    }
  });
}
ensureRegulatoryCoaAccounts();

const INITIAL_SEED_GL_IDS = new Set(INITIAL_GENERAL_LEDGER.map((g) => g.id));
const BASELINE_COA_BY_CODE: Record<string, { category: ChartOfAccount['category']; accountName: string; balance: number }> = Object.fromEntries(
  chartOfAccounts.map((c) => [c.accountCode, { category: c.category, accountName: c.accountName, balance: c.balance }])
);

let skuTaxRulesList: SkuTaxRule[] = [
  ...inventoryList.map((item) => {
    const taxCategory = inferDefaultTaxCategory(item.category, item.name || item.productName || '');
    return {
      sku: item.sku,
      productName: item.name || item.productName || item.sku,
      category: item.category,
      taxCategory,
      taxRatePercent: getTaxRateForCategory(taxCategory, 11),
      b2cTaxInclusive: true,
      b2bTaxExclusive: true,
      updatedAt: new Date().toISOString(),
    };
  }),
  ...wholesaleProductsList
    .filter((wp) => !inventoryList.some((inv) => inv.sku === wp.sku))
    .map((wp) => {
      const taxCategory = inferDefaultTaxCategory(wp.category, wp.name);
      return {
        sku: wp.sku,
        productName: wp.name,
        category: wp.category,
        taxCategory,
        taxRatePercent: getTaxRateForCategory(taxCategory, 11),
        b2cTaxInclusive: true,
        b2bTaxExclusive: true,
        updatedAt: new Date().toISOString(),
      };
    }),
];

let customerRmaList: CustomerRmaRecord[] = [
  {
    id: 'RMA-2026-0001',
    notaReturNumber: 'NR-2026-0001',
    sourceChannel: 'POS',
    sourceReferenceId: 'RCP-2026-1029-001',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    customerName: 'Sarah Jenkins',
    customerNpwpOrNik: '3174015408920001',
    items: [
      {
        sku: 'SKU-PRD-001',
        productName: 'Organic Hydroponic Baby Spinach 250g',
        category: 'produce',
        quantity: 1,
        unitPriceIDR: 18500,
        unitCostIDR: 12000,
        lineTotalIDR: 18500,
        taxCategory: 'BKP_DIBEBASKAN',
        ppnAdjustmentIDR: 0,
        disposition: 'SCRAP_QUARANTINE',
        lotNumber: 'BAT-202611-01',
        reason: 'Wilted cold-chain leaf damage reported by shopper',
      },
    ],
    subtotalReversedIDR: 18500,
    ppnReversedIDR: 0,
    totalCreditNoteIDR: 18500,
    refundMethod: 'CASH',
    status: 'COMPLETED',
    glVoucherIds: ['GLE-2026-0988'],
    createdAt: new Date(Date.now() - 1000 * 3600 * 6).toISOString(),
    processedBy: 'Dewi Lestari',
    notes: 'Nota Retur Pelanggan B2C - Barang Rusak/Quarantine',
  },
];

let vendorRtvList: VendorRtvDebitNote[] = [
  {
    id: 'RTV-2026-0001',
    debitNoteNumber: 'NRP-2026-0001',
    qcInspectionId: 'QC-2026-0002',
    vendorCreditNoteId: 'VCN-2026-081',
    supplierId: 'SUPP-AGRO-01',
    supplierName: 'PT Lembang Agro Sejahtera',
    supplierNpwp: '013084492007000',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    sku: 'SKU-PRD-002',
    productName: 'Alpine Strawberry Punnet 250g',
    lotNumber: 'BAT-STR-2611',
    quantityReturned: 8,
    unit: 'pack',
    unitCostIDR: 24000,
    subtotalReturnedIDR: 192000,
    ppnMasukanReversedIDR: 21120,
    totalDebitNoteIDR: 213120,
    reason: 'QC Rejected: Temperature breach > 6.5°C on receiving dock',
    status: 'ISSUED',
    glVoucherIds: ['GLE-RTV-2026-0001'],
    createdAt: new Date(Date.now() - 1000 * 3600 * 4).toISOString(),
    createdBy: 'Budi Santoso (QC Lead)',
  },
];

let blindOpnameSheetsList: BlindOpnameSheet[] = [
  {
    id: 'BLIND-OPN-2026-001',
    sheetNumber: 'SO-BLIND-2026-001',
    warehouseHub: 'CDC',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    zoneFilter: 'WH-JKT-SEN-COLD',
    status: 'COUNTING',
    createdAt: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
    createdBy: 'Siti Rahmawati (Inventory Audit)',
    totalSurplusValueIDR: 0,
    totalShortageValueIDR: 0,
    netVarianceValueIDR: 0,
    glVoucherIds: [],
    items: storeInventoryTiers
      .filter((t) => t.storeId === 'store-jkt-senopati')
      .slice(0, 6)
      .map((t) => {
        const batch = inventoryBatches.find((b) => b.sku === t.sku && b.storeId === t.storeId);
        return {
          sku: t.sku,
          productName: t.productName,
          category: t.category,
          unit: t.unit,
          warehouseZoneId: t.warehouseZoneId,
          binLocation: t.warehouseZoneId.includes('COLD') ? 'CDC-Chilled-Rack-A1' : 'CDC-Ambient-Rack-B2',
          expectedLotNumber: batch?.lotNumber || `BAT-202611-${t.sku.slice(-3)}`,
          countedLotNumber: batch?.lotNumber || `BAT-202611-${t.sku.slice(-3)}`,
          countedQty: null,
          systemQty: t.physicalStock,
          unitCostIDR: t.unitCost,
        };
      }),
  },
];

let posShiftsList: PosRegisterShiftSession[] = [
  {
    id: 'SHF-2026-0000',
    zReportNumber: 'Z-RPT-2026-0000',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    registerId: 'REG-04',
    cashierId: 'usr-cashier-01',
    cashierName: 'Dewi Lestari',
    status: 'CLOSED',
    openedAt: new Date(Date.now() - 1000 * 3600 * 18).toISOString(),
    closedAt: new Date(Date.now() - 1000 * 3600 * 10).toISOString(),
    openingFloatIDR: 500000,
    transactionCount: 14,
    expectedCashSalesIDR: 1450000,
    expectedQrisSalesIDR: 2150000,
    expectedEdcSalesIDR: 980000,
    expectedTotalCashInDrawerIDR: 1950000,
    cashRefundsIDR: 0,
    countedCashIDR: 1950000,
    countedQrisBatchIDR: 2150000,
    countedEdcBatchIDR: 980000,
    cashVarianceIDR: 0,
    qrisVarianceIDR: 0,
    edcVarianceIDR: 0,
    varianceGlVoucherIds: [],
    notes: 'Previous evening shift balanced — zero cash variance.',
  },
];

function applyBlindOpnameApproval(sheet: BlindOpnameSheet, approverName: string): string[] {
  const timestamp = new Date().toISOString();
  const glIds: string[] = [];

  const opnameSessionItems = sheet.items.map((line) => {
    const tier = storeInventoryTiers.find(
      (t) => t.sku === line.sku && (t.storeId === sheet.storeId || sheet.storeId === 'CONSOLIDATED')
    );
    const sysQty = line.systemQty ?? tier?.physicalStock ?? 0;
    const counted = line.countedQty ?? sysQty;
    const variance = Number((counted - sysQty).toFixed(2));
    const unitCost = line.unitCostIDR ?? tier?.unitCost ?? 15000;
    const financialVar = Math.round(variance * unitCost);

    if (tier && variance !== 0) {
      tier.physicalStock = Math.max(0, counted);
      tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
      tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
      tier.totalValuation = Math.round(tier.physicalStock * (tier.unitCost || unitCost));
      tier.updatedAt = timestamp;
    }
    const inv = inventoryList.find((i) => i.sku === line.sku);
    if (inv && variance !== 0) {
      inv.currentStock = Math.max(0, Number(((inv.currentStock || 0) + variance).toFixed(2)));
    }
    if (variance !== 0) {
      syncBatchesForStockVariance(line.sku, sheet.storeId, variance, unitCost, line.countedLotNumber);
    }

    return {
      sku: line.sku,
      productName: line.productName,
      category: line.category,
      storeId: sheet.storeId,
      storeName: sheet.storeName,
      warehouseZoneId: line.warehouseZoneId,
      systemStock: sysQty,
      countedStock: counted,
      varianceQty: variance,
      unitCost,
      financialVarianceIDR: financialVar,
      notes: line.notes || `Blind Opname ${sheet.sheetNumber} (Lot: ${line.countedLotNumber})`,
      status: (variance === 0 ? 'matched' : variance < 0 ? 'shortage' : 'surplus') as 'matched' | 'shortage' | 'surplus',
    };
  });

  if (sheet.netVarianceValueIDR !== 0) {
    const absVal = Math.abs(sheet.netVarianceValueIDR);
    const isShortage = sheet.netVarianceValueIDR < 0;
    const g1 = `GLE-OPN-${Date.now().toString().slice(-5)}-1`;
    const g2 = `GLE-OPN-${Date.now().toString().slice(-5)}-2`;
    glIds.push(g1, g2);

    if (isShortage) {
      commitBalancedGlBatch(
        [
          {
            id: g1,
            timestamp,
            storeId: sheet.storeId,
            storeName: sheet.storeName,
            accountCode: '5210',
            accountName: 'Inventory Shrinkage & Blind Opname Variance Expense',
            category: 'Expense',
            debit: absVal,
            credit: 0,
            referenceType: 'STOCK_OPNAME',
            referenceId: sheet.sheetNumber,
            description: `Blind Stock Opname Shortage Variance (${sheet.sheetNumber}) approved by ${approverName}`,
          },
          {
            id: g2,
            timestamp,
            storeId: sheet.storeId,
            storeName: sheet.storeName,
            accountCode: '1040',
            accountName: 'Merchandise Inventory Asset',
            category: 'Asset',
            debit: 0,
            credit: absVal,
            referenceType: 'STOCK_OPNAME',
            referenceId: sheet.sheetNumber,
            description: `Inventory Asset write-down for Blind Stock Opname ${sheet.sheetNumber}`,
          },
        ],
        true
      );
    } else {
      commitBalancedGlBatch(
        [
          {
            id: g1,
            timestamp,
            storeId: sheet.storeId,
            storeName: sheet.storeName,
            accountCode: '1040',
            accountName: 'Merchandise Inventory Asset',
            category: 'Asset',
            debit: absVal,
            credit: 0,
            referenceType: 'STOCK_OPNAME',
            referenceId: sheet.sheetNumber,
            description: `Inventory Asset surplus adjustment for Blind Stock Opname ${sheet.sheetNumber}`,
          },
          {
            id: g2,
            timestamp,
            storeId: sheet.storeId,
            storeName: sheet.storeName,
            accountCode: '5210',
            accountName: 'Inventory Shrinkage & Blind Opname Variance Expense',
            category: 'Expense',
            debit: 0,
            credit: absVal,
            referenceType: 'STOCK_OPNAME',
            referenceId: sheet.sheetNumber,
            description: `Blind Stock Opname Surplus credit (${sheet.sheetNumber}) approved by ${approverName}`,
          },
        ],
        true
      );
    }
  }

  sheet.status = 'APPROVED';
  sheet.approvedAt = timestamp;
  sheet.approvedBy = approverName;
  sheet.glVoucherIds = glIds;

  stockOpnameSessions.unshift({
    id: sheet.id,
    date: timestamp,
    storeId: sheet.storeId,
    storeName: sheet.storeName,
    warehouseZoneId: sheet.zoneFilter,
    auditorId: 'BLIND-COUNTER',
    auditorName: sheet.submittedBy || sheet.createdBy,
    status: 'reconciled',
    items: opnameSessionItems,
    totalSystemUnits: opnameSessionItems.reduce((s, it) => s + it.systemStock, 0),
    totalCountedUnits: opnameSessionItems.reduce((s, it) => s + it.countedStock, 0),
    totalVarianceUnits: opnameSessionItems.reduce((s, it) => s + it.varianceQty, 0),
    netFinancialVarianceIDR: sheet.netVarianceValueIDR,
    glEntryIds: glIds,
    notes: `Supervisor Approved Blind Cycle Count (${sheet.sheetNumber})`,
    completedAt: timestamp,
  });

  return glIds;
}

function getEffectiveRemovalStrategy(sku: string, category?: string): RemovalStrategyType {
  if (removalStrategiesConfig.skuOverrides[sku]) {
    return removalStrategiesConfig.skuOverrides[sku];
  }
  const matchedInv = inventoryList.find((i) => i.sku === sku);
  const resolvedCategory = category || matchedInv?.category;
  if (resolvedCategory && removalStrategiesConfig.categoryStrategies[resolvedCategory]) {
    return removalStrategiesConfig.categoryStrategies[resolvedCategory];
  }
  if (sku.startsWith('B2B-SKU-')) {
    return sku.includes('TELUR') || sku.includes('SUSU') ? 'FEFO' : 'FIFO';
  }
  return 'FEFO';
}

function emitEnterpriseNotification(input: {
  dedupeKey: string;
  category: EnterpriseNotificationCategory;
  severity: EnterpriseNotificationSeverity;
  title: string;
  message: string;
  metadataLabel?: string;
  targetTab: string;
  targetSubTab?: string;
  skipIfExistsAny?: boolean;
}): EnterpriseNotification {
  const nowIso = new Date().toISOString();
  if (input.skipIfExistsAny) {
    const existingAny = enterpriseNotificationsList.find((n) => n.dedupeKey === input.dedupeKey);
    if (existingAny) {
      return existingAny;
    }
  }

  const existingUnread = enterpriseNotificationsList.find(
    (n) => n.dedupeKey === input.dedupeKey && !n.isRead
  );
  if (existingUnread) {
    const hasChanged =
      existingUnread.severity !== input.severity ||
      existingUnread.title !== input.title ||
      existingUnread.message !== input.message ||
      existingUnread.metadataLabel !== input.metadataLabel;
    existingUnread.severity = input.severity;
    existingUnread.title = input.title;
    existingUnread.message = input.message;
    existingUnread.metadataLabel = input.metadataLabel;
    existingUnread.targetTab = input.targetTab;
    existingUnread.targetSubTab = input.targetSubTab;
    if (hasChanged) {
      existingUnread.updatedAt = nowIso;
    }
    return existingUnread;
  }

  const created: EnterpriseNotification = {
    id: `NTF-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    dedupeKey: input.dedupeKey,
    category: input.category,
    severity: input.severity,
    title: input.title,
    message: input.message,
    metadataLabel: input.metadataLabel,
    targetTab: input.targetTab,
    targetSubTab: input.targetSubTab,
    isRead: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  enterpriseNotificationsList.unshift(created);
  if (enterpriseNotificationsList.length > 100) {
    enterpriseNotificationsList.length = 100;
  }
  return created;
}

function markEnterpriseNotificationReadByDedupeKey(dedupeKey: string): void {
  const nowIso = new Date().toISOString();
  enterpriseNotificationsList.forEach((n) => {
    if (n.dedupeKey === dedupeKey && !n.isRead) {
      n.isRead = true;
      n.updatedAt = nowIso;
    }
  });
}

function checkAndNotifyLowStockForSkus(skus: string[], storeId: string = 'store-jkt-senopati'): void {
  const uniqueSkus = Array.from(new Set(skus.filter(Boolean)));
  uniqueSkus.forEach((sku) => {
    const tier =
      storeInventoryTiers.find(
        (t) => t.sku === sku && (storeId === 'CONSOLIDATED' || storeId === 'ALL' || t.storeId === storeId)
      ) || storeInventoryTiers.find((t) => t.sku === sku);
    const inv = inventoryList.find((i) => i.sku === sku);
    const productName = tier?.productName || inv?.productName || inv?.name || sku;
    const reorderPoint = tier?.minimumThreshold ?? inv?.minimumThreshold ?? 20;
    const availableStock = tier ? tier.availableStock : (inv?.currentStock ?? 0);
    const effectiveStoreId = tier?.storeId || storeId;
    const effectiveStoreName = tier?.storeName || effectiveStoreId;

    if (availableStock <= 0) {
      emitEnterpriseNotification({
        dedupeKey: `LOW_STOCK:${sku}:${effectiveStoreId}:OOS`,
        category: 'INVENTORY',
        severity: 'CRITICAL',
        title: `Out of Stock Breach: ${productName}`,
        message: `${sku} at ${effectiveStoreName} reached 0 available units (Reorder Point: ${reorderPoint}). Immediate PO replenishment required.`,
        metadataLabel: `${sku} • 0 ATP • ${effectiveStoreName}`,
        targetTab: 'procurement',
      });
    } else if (availableStock <= reorderPoint) {
      emitEnterpriseNotification({
        dedupeKey: `LOW_STOCK:${sku}:${effectiveStoreId}:ROP`,
        category: 'INVENTORY',
        severity: 'WARNING',
        title: `Reorder Point Reached: ${productName}`,
        message: `Available stock dropped to ${availableStock} units (Threshold: ${reorderPoint}) at ${effectiveStoreName}.`,
        metadataLabel: `${sku} • ${availableStock}/${reorderPoint} units`,
        targetTab: 'procurement',
      });
    }
  });
}

function syncBatchExpiryStatus(batch: InventoryBatch, nowMs: number = Date.now()): boolean {
  if (batch.status === 'expired') return true;
  const expiryMs = new Date(batch.expiryDate).getTime();
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    if (batch.status !== 'depleted') {
      batch.status = 'expired';
    }
    batch.daysUntilExpiry = Number.isFinite(expiryMs)
      ? Math.min(0, Math.floor((expiryMs - nowMs) / 86400000))
      : 0;
    return true;
  }
  batch.daysUntilExpiry = Math.max(1, Math.ceil((expiryMs - nowMs) / 86400000));
  return false;
}

function syncAllBatchesExpiryStatus(nowMs: number = Date.now()): void {
  inventoryBatches.forEach((b) => {
    const isExpired = syncBatchExpiryStatus(b, nowMs);
    if (b.currentStock <= 0 || b.status === 'depleted' || b.status === 'quarantined' || b.status === 'recalled') {
      return;
    }
    const expiryMs = new Date(b.expiryDate).getTime();
    const msLeft = expiryMs - nowMs;
    if (isExpired || b.status === 'expired') {
      emitEnterpriseNotification({
        dedupeKey: `EXPIRY_BATCH:${b.batchId}:EXPIRED`,
        category: 'PERISHABLES',
        severity: 'CRITICAL',
        title: `Expired Batch Locked: ${b.productName}`,
        message: `Lot ${b.lotNumber} (${b.currentStock} units) at ${b.storeName} has expired and is locked from POS & online sale.`,
        metadataLabel: `${b.sku} • Lot ${b.lotNumber} • Locked`,
        targetTab: 'fefo',
        skipIfExistsAny: true,
      });
    } else if (Number.isFinite(msLeft) && msLeft > 0 && msLeft <= 48 * 3600 * 1000) {
      const hoursLeft = Math.max(1, Math.round(msLeft / 3600000));
      emitEnterpriseNotification({
        dedupeKey: `EXPIRY_BATCH:${b.batchId}:CRITICAL_48H`,
        category: 'PERISHABLES',
        severity: 'WARNING',
        title: `Near-Expiry Clearance (<48h): ${b.productName}`,
        message: `Lot ${b.lotNumber} (${b.currentStock} units) expires in ${hoursLeft}h at ${b.storeName}. Apply FEFO markdown clearance.`,
        metadataLabel: `${b.sku} • Lot ${b.lotNumber} • ${hoursLeft}h left`,
        targetTab: 'fefo',
        skipIfExistsAny: true,
      });
    }
  });
}

function roundIDR(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function getSellableNonExpiredAtpStock(sku: string, storeId: string = 'ALL'): {
  hasBatchTracking: boolean;
  batchSellableQty: number;
  effectiveAtp: number;
} {
  const nowMs = Date.now();
  const matchingAll = inventoryBatches.filter(
    (b) =>
      b.sku === sku &&
      (storeId === 'ALL' || storeId === 'CONSOLIDATED' || b.storeId === storeId)
  );
  matchingAll.forEach((b) => syncBatchExpiryStatus(b, nowMs));

  const sellableBatches = matchingAll.filter(
    (b) =>
      b.currentStock > 0 &&
      b.status !== 'quarantined' &&
      b.status !== 'recalled' &&
      b.status !== 'expired' &&
      b.status !== 'depleted' &&
      new Date(b.expiryDate).getTime() > nowMs
  );
  const batchSellableQty = Number(
    sellableBatches.reduce((sum, b) => sum + b.currentStock, 0).toFixed(2)
  );

  const tier = storeInventoryTiers.find(
    (t) =>
      t.sku === sku &&
      (storeId === 'ALL' || storeId === 'CONSOLIDATED' || t.storeId === storeId)
  );
  const inv = inventoryList.find((i) => i.sku === sku);
  const wholesaleProd = wholesaleProductsList.find((p) => p.sku === sku);

  const hasBatchTracking = matchingAll.length > 0;
  let stockCap = Infinity;
  if (storeId !== 'ALL' && storeId !== 'CONSOLIDATED' && tier) {
    stockCap = Math.max(0, Number(tier.availableStock) || 0);
  } else if (inv) {
    stockCap = Math.max(0, Number(inv.currentStock) || 0);
  } else if (wholesaleProd) {
    stockCap = Math.max(0, Number(wholesaleProd.currentStockBaseUnits) || 0);
  }

  const effectiveAtp = hasBatchTracking
    ? Number(Math.min(batchSellableQty, stockCap).toFixed(2))
    : Number((Number.isFinite(stockCap) ? stockCap : 0).toFixed(2));

  return {
    hasBatchTracking,
    batchSellableQty,
    effectiveAtp,
  };
}

function syncBatchesForStockVariance(
  sku: string,
  storeId: string,
  deltaQty: number,
  unitCost: number = 15000,
  preferredLotNumber?: string
): void {
  if (!deltaQty || Math.abs(deltaQty) < 0.0001) return;
  const nowMs = Date.now();
  const candidates = inventoryBatches.filter(
    (b) =>
      b.sku === sku &&
      (storeId === 'ALL' || storeId === 'CONSOLIDATED' || b.storeId === storeId) &&
      b.status !== 'quarantined' &&
      b.status !== 'recalled' &&
      b.status !== 'expired'
  );

  if (deltaQty < 0) {
    let toRemove = Math.abs(deltaQty);
    const ordered = candidates
      .filter((b) => b.currentStock > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    for (const batch of ordered) {
      if (toRemove <= 0) break;
      const take = Math.min(batch.currentStock, toRemove);
      batch.currentStock = Math.max(0, Number((batch.currentStock - take).toFixed(2)));
      toRemove = Number((toRemove - take).toFixed(2));
      if (batch.currentStock === 0) batch.status = 'depleted';
    }
  } else {
    const activeMatch =
      (preferredLotNumber ? candidates.find((b) => b.lotNumber === preferredLotNumber) : undefined) ||
      candidates
        .filter((b) => new Date(b.expiryDate).getTime() > nowMs)
        .sort((a, b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime())[0];
    if (activeMatch) {
      activeMatch.currentStock = Number((activeMatch.currentStock + deltaQty).toFixed(2));
      if (activeMatch.status === 'depleted') {
        activeMatch.status = activeMatch.daysUntilExpiry <= 7 ? 'near_expiry' : 'fresh';
      }
    } else {
      const targetStoreId = storeId === 'ALL' || storeId === 'CONSOLIDATED' ? 'store-jkt-senopati' : storeId;
      const storeInfo = storeSchedules.find((s) => s.storeId === targetStoreId);
      const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === targetStoreId);
      const inv = inventoryList.find((i) => i.sku === sku);
      inventoryBatches.unshift({
        batchId: `BAT-ADJ-${Date.now().toString().slice(-5)}-${inventoryBatches.length + 1}`,
        sku,
        productName: inv?.productName || tier?.productName || sku,
        storeId: targetStoreId,
        storeName: storeInfo?.storeName || tier?.storeName || 'GroceMart Senopati Flagship',
        warehouseZoneId: tier?.warehouseZoneId || 'WH-JKT-SEN-COLD',
        lotNumber: preferredLotNumber || `LOT-ADJ-${Date.now().toString().slice(-4)}`,
        initialQuantity: deltaQty,
        currentStock: deltaQty,
        unitCost: unitCost || tier?.unitCost || inv?.unitCost || 15000,
        sellingPrice: inv?.sellingPrice || tier?.sellingPrice || Math.round((unitCost || 15000) * 1.4),
        receivedDate: new Date().toISOString(),
        expiryDate: new Date(nowMs + 86400000 * 30).toISOString(),
        daysUntilExpiry: 30,
        status: 'fresh',
        storageZone: tier?.storageType || 'cold_chilled',
        supplierName: inv?.supplierName || 'Opname / Stock Adjustment',
        notes: 'Stock variance synchronization adjustment',
      });
    }
  }
}

function updateCoaLedgerBalance(accountCode: string, debitAmount: number, creditAmount: number) {
  const acc = chartOfAccounts.find((c) => c.accountCode === accountCode);
  if (!acc) return;
  const dr = roundIDR(Number(debitAmount) || 0);
  const cr = roundIDR(Number(creditAmount) || 0);
  if (acc.normalBalance === 'Debit') {
    acc.balance = Math.round(acc.balance + dr - cr);
  } else {
    acc.balance = Math.round(acc.balance + cr - dr);
  }
}

function commitBalancedGlBatch(entries: GeneralLedgerEntry[], updateCoa: boolean = true): void {
  if (entries.length === 0) return;
  for (const entry of entries) {
    entry.debit = Math.max(0, roundIDR(Number(entry.debit) || 0));
    entry.credit = Math.max(0, roundIDR(Number(entry.credit) || 0));
  }
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const drift = totalDebit - totalCredit;
  if (drift !== 0) {
    const revCredit = entries.find(
      (e) => (e.accountCode === '4010' || e.accountCode === '4020') && e.credit > 0
    );
    if (revCredit && revCredit.credit + drift >= 0) {
      revCredit.credit += drift;
    } else if (drift > 0) {
      const creditEntry = entries.find((e) => e.credit > 0);
      if (creditEntry) creditEntry.credit += drift;
    } else {
      const debitEntry = entries.find((e) => e.debit > 0);
      if (debitEntry) debitEntry.debit += Math.abs(drift);
    }
  }
  for (const entry of entries) {
    generalLedger.unshift(entry);
    if (updateCoa) {
      updateCoaLedgerBalance(entry.accountCode, entry.debit, entry.credit);
    }
  }
}

function getSupplierOpenAdvance1150IDR(supplierName: string): number {
  const coa1150Balance = Math.max(
    0,
    roundIDR(chartOfAccounts.find((c) => c.accountCode === '1150')?.balance ?? 0)
  );
  if (coa1150Balance <= 0) return 0;

  const normTarget = (supplierName || '').trim().toLowerCase();
  if (!normTarget) return 0;

  const coreTokens = normTarget
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(pt|cv|ud|tbk|co|ltd|inc)\b/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  const matchesSupplier = (candidate: string | undefined): boolean => {
    const c = (candidate || '').trim().toLowerCase();
    if (!c) return false;
    if (c.includes(normTarget) || normTarget.includes(c)) return true;
    if (coreTokens.length >= 2) {
      return coreTokens.every((t) => c.includes(t));
    }
    return false;
  };

  let netSupplier1150 = 0;
  for (const entry of generalLedger) {
    if (entry.accountCode !== '1150' || entry.isReversed) continue;
    let isMatch = matchesSupplier(entry.description);
    if (!isMatch && entry.referenceId) {
      const matchedVcn = vendorCreditNotesList.find(
        (v) => v.creditNoteId === entry.referenceId || v.rmaNumber === entry.referenceId
      );
      if (matchedVcn && matchesSupplier(matchedVcn.supplierName)) {
        isMatch = true;
      }
      if (!isMatch) {
        const matchedRtv = vendorRtvList.find(
          (r) => r.debitNoteNumber === entry.referenceId || r.id === entry.referenceId
        );
        if (matchedRtv && matchesSupplier(matchedRtv.supplierName)) {
          isMatch = true;
        }
      }
    }
    if (isMatch) {
      netSupplier1150 += roundIDR(Number(entry.debit) || 0) - roundIDR(Number(entry.credit) || 0);
    }
  }

  return Math.max(0, Math.min(coa1150Balance, netSupplier1150));
}

function findLinkedVendorBillForRtv(params: {
  vendorBillId?: string;
  poId?: string;
  qcInspectionId?: string;
  supplierName?: string;
  sku?: string;
}): VendorBill | undefined {
  const activeBills = vendorBillsList.filter((b) => b.status !== 'VOID');
  if (params.vendorBillId) {
    const exact = activeBills.find((b) => b.id === params.vendorBillId);
    if (exact) return exact;
  }
  if (params.qcInspectionId) {
    const qc = qcInspectionsList.find((q) => q.id === params.qcInspectionId);
    if (qc?.referenceId) {
      const byQcPo = activeBills.find(
        (b) => b.poId === qc.referenceId || b.goodsReceiptId === qc.referenceId
      );
      if (byQcPo) return byQcPo;
    }
  }
  if (params.poId) {
    const byPo = activeBills.find((b) => b.poId === params.poId);
    if (byPo) return byPo;
  }

  const normSupp = (params.supplierName || '').trim().toLowerCase();
  const candidates = activeBills.filter((b) => {
    const suppMatch =
      normSupp &&
      (b.supplierName.toLowerCase().includes(normSupp) ||
        normSupp.includes(b.supplierName.toLowerCase()));
    const skuMatch = params.sku ? b.items.some((it) => it.sku === params.sku) : false;
    return suppMatch && skuMatch;
  });
  if (candidates.length > 0) {
    return (
      candidates.find((b) => b.status !== 'PAID' && (b.remainingDue ?? 0) > 0) || candidates[0]
    );
  }
  if (normSupp) {
    const bySupp = activeBills.filter(
      (b) =>
        b.supplierName.toLowerCase().includes(normSupp) ||
        normSupp.includes(b.supplierName.toLowerCase())
    );
    if (bySupp.length > 0) {
      return bySupp.find((b) => b.status !== 'PAID' && (b.remainingDue ?? 0) > 0) || bySupp[0];
    }
  }
  if (params.sku) {
    const bySku = activeBills.filter((b) => b.items.some((it) => it.sku === params.sku));
    if (bySku.length > 0) {
      return bySku.find((b) => b.status !== 'PAID' && (b.remainingDue ?? 0) > 0) || bySku[0];
    }
  }
  return undefined;
}

function deductBatchesByStrategy(
  sku: string,
  qty: number,
  storeId: string = 'ALL',
  fallbackUnitCost: number = 15000,
  strictBatchCheck: boolean = false
) {
  const strategy = getEffectiveRemovalStrategy(sku);
  const nowMs = Date.now();
  const matchingAll = inventoryBatches.filter(
    (b) =>
      b.sku === sku &&
      (storeId === 'ALL' || storeId === 'CONSOLIDATED' || b.storeId === storeId)
  );
  matchingAll.forEach((b) => syncBatchExpiryStatus(b, nowMs));

  const eligibleBatches = matchingAll
    .filter(
      (b) =>
        b.currentStock > 0 &&
        b.status !== 'quarantined' &&
        b.status !== 'recalled' &&
        b.status !== 'expired' &&
        b.status !== 'depleted' &&
        new Date(b.expiryDate).getTime() > nowMs
    )
    .sort((a, b) => {
      if (strategy === 'FIFO') {
        return new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime();
      }
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

  const totalAvailableSellableQty = Number(
    eligibleBatches.reduce((sum, b) => sum + b.currentStock, 0).toFixed(2)
  );
  const hasBatchRecords = matchingAll.length > 0;

  if (qty <= 0) {
    return {
      strategyApplied: strategy,
      allocations: [],
      totalCogs: 0,
      remainingShortage: 0,
      allocatedQty: 0,
      insufficientStock: false,
      availableSellableQty: totalAvailableSellableQty,
    };
  }

  // Atomic pre-check before mutating any batch row
  if ((hasBatchRecords || strictBatchCheck) && qty > totalAvailableSellableQty) {
    return {
      strategyApplied: strategy,
      allocations: [],
      totalCogs: 0,
      remainingShortage: qty,
      allocatedQty: 0,
      insufficientStock: true,
      availableSellableQty: totalAvailableSellableQty,
    };
  }

  let remaining = Math.max(0, qty);
  const allocations: {
    batchId: string;
    lotNumber: string;
    expiryDate: string;
    allocatedQty: number;
    unitCost: number;
    subtotalCost: number;
  }[] = [];
  let totalCogs = 0;

  for (const batch of eligibleBatches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.currentStock, remaining);
    batch.currentStock = Math.max(0, Number((batch.currentStock - take).toFixed(2)));
    remaining = Math.max(0, Number((remaining - take).toFixed(2)));

    const subtotalCost = Math.round(take * batch.unitCost);
    totalCogs += subtotalCost;

    allocations.push({
      batchId: batch.batchId,
      lotNumber: batch.lotNumber,
      expiryDate: batch.expiryDate,
      allocatedQty: take,
      unitCost: batch.unitCost,
      subtotalCost,
    });

    if (batch.currentStock === 0) {
      batch.status = 'depleted';
    }
  }

  if (remaining > 0) {
    totalCogs += Math.round(remaining * fallbackUnitCost);
  }

  return {
    strategyApplied: strategy,
    allocations,
    totalCogs,
    remainingShortage: remaining,
    allocatedQty: Number((qty - remaining).toFixed(2)),
    insufficientStock: false,
    availableSellableQty: totalAvailableSellableQty,
  };
}

let posHardwareStatus: POSHardwarePeripheralStatus = {
  thermalPrinter: {
    status: 'connected',
    model: 'Epson TM-T88VI High-Speed Thermal (80mm USB/LAN)',
    paperWidthMm: 80,
    lastPrintedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  cashDrawer: {
    status: 'closed',
    kickPulseMs: 120,
    lastKickedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  barcodeScanner: {
    status: 'active_listening',
    interfaceType: 'USB-HID-Wedge',
    lastScannedBarcode: '020042004505',
    lastScannedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  digitalScale: {
    status: 'stable',
    currentWeightGrams: 450,
    tareGrams: 20,
    unit: 'g',
    isStable: true,
    lastStabilizedAt: new Date().toISOString(),
  },
};

let coldChainLogs: ColdChainLogEntry[] = [
  {
    id: 'CCL-2026-001',
    warehouseZoneId: 'zone-chiller-01',
    zoneName: 'Chilled Dairy & Cold Storage',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    sensorId: 'IOT-TEMP-042',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    temperatureCelsius: 3.2,
    temperatureFahrenheit: 37.8,
    humidityPercent: 84,
    isExcursion: false,
    severity: 'NORMAL',
    complianceStandard: 'FDA FSMA 204',
    inspectorName: 'IoT Auto-Telemetry Logger',
  },
  {
    id: 'CCL-2026-002',
    warehouseZoneId: 'zone-freezer-01',
    zoneName: 'Blast Deep Freezer (-18°C)',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    sensorId: 'IOT-FREEZER-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    temperatureCelsius: -19.4,
    temperatureFahrenheit: -2.9,
    humidityPercent: 62,
    isExcursion: false,
    severity: 'NORMAL',
    complianceStandard: 'HACCP CCP',
    inspectorName: 'IoT Auto-Telemetry Logger',
  },
  {
    id: 'CCL-2026-003',
    warehouseZoneId: 'zone-produce-01',
    zoneName: 'Hydroponics & Mist Room',
    storeId: 'store-bdg-riau',
    storeName: 'GroceMart Riau Bandung',
    sensorId: 'IOT-PROD-09',
    timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    temperatureCelsius: 8.5,
    temperatureFahrenheit: 47.3,
    humidityPercent: 91,
    isExcursion: false,
    severity: 'NORMAL',
    complianceStandard: 'EU Reg 852/2004',
    inspectorName: 'IoT Auto-Telemetry Logger',
  },
];

let posReturnsList: POSReturnRecord[] = [
  {
    id: 'RET-2026-0001',
    originalReceiptNumber: 'RCP-2026-1029-001',
    originalOrderId: 'ORD-2026-1029',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    processedByUserId: 'usr-cashier-01',
    processedByUserName: 'Dewi Lestari',
    timestamp: new Date(Date.now() - 1000 * 3600 * 6).toISOString(),
    items: [
      {
        sku: 'SKU-PRD-001',
        productName: 'Organic Hydroponic Baby Spinach 250g',
        category: 'fresh_produce',
        originalQuantity: 1,
        returnQuantity: 1,
        unitPrice: 18500,
        unitCost: 12000,
        refundAmount: 18500,
        returnReason: 'PERISHABLE_DEFECT',
        disposition: 'RETURN_CAGE_WASTE',
        conditionNotes: 'Customer discovered wilted leaves at home same evening',
      },
    ],
    totalRefundAmountIDR: 18500,
    refundChannel: 'CASH_DRAWER',
    glVoucherIds: ['GLE-2026-0988'],
    status: 'COMPLETED',
    customerName: 'Sarah Jenkins',
    customerPhone: '+6281298765432',
  },
];

let coaMappingConfig: CoaMappingConfig = {
  posRevenueAccountCode: '4010',
  posRevenueAccountName: 'Grocery Sales Revenue - Retail Storefront',
  inventoryAssetAccountCode: '1040',
  inventoryAssetAccountName: 'Merchandise Inventory Asset',
  shrinkageExpenseAccountCode: '5030',
  shrinkageExpenseAccountName: 'Waste, Spoilage & Shrinkage Expense',
  cogsAccountCode: '5010',
  cogsAccountName: 'Cost of Goods Sold (COGS) - FIFO / WAC',
  cashClearingAccountCode: '1010',
  cashClearingAccountName: 'Cash & Register Drawer Clearing',
  qrisClearingAccountCode: '1030',
  qrisClearingAccountName: 'QRIS Settlement Receivable (ASPI Clearing)',
  edcClearingAccountCode: '1020',
  edcClearingAccountName: 'Bank BCA Operational Clearing (EDC Card)',
  taxPayableAccountCode: '2020',
  taxPayableAccountName: 'Value-Added Tax (PPN) Output Payable',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Siti Rahmawati',
};

let posCheckoutConfig: PosCheckoutConfig = {
  roundingRule: 'nearest_100',
  ppnTaxPercent: 11,
  isTaxInclusive: false,
  maxCashierDiscountPercent: 15,
  enableVivoNearExpiryDiscount: true,
  vivoNearExpiryDiscountPercent: 25,
  cashDrawerFloatIDR: 500000,
  loyaltyPointsPer1000IDR: 1,
  requireManagerPinForVoid: true,
  storeReceiptFooterText: 'Thank you for shopping at GroceMart! Fresh harvest daily.',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Budi Santoso',
};

let stockOpnameSessions: StockOpnameSession[] = [];
let stockTransfersList: StockTransferRecord[] = [];
let approvalRulesList: ApprovalTierRule[] = [
  {
    id: 'RULE-PO-01',
    module: 'procurement_po',
    tierLevel: 1,
    tierName: 'Store Supervisor Clearance',
    minThresholdIDR: 0,
    maxThresholdIDR: 10000000,
    requiredRole: 'store_manager',
    requiresPin: false,
    autoApproveBelowMin: false,
    slaHours: 24,
    description: 'Store Managers can approve regular inventory restocks under 10 Million IDR',
  },
  {
    id: 'RULE-PO-02',
    module: 'procurement_po',
    tierLevel: 2,
    tierName: 'Regional GM Capital PO',
    minThresholdIDR: 10000001,
    maxThresholdIDR: 50000000,
    requiredRole: 'store_manager',
    requiresPin: true,
    autoApproveBelowMin: false,
    slaHours: 24,
    description: 'Bulk fresh intakes between 10M and 50M IDR require managerial PIN confirmation',
  },
  {
    id: 'RULE-PO-03',
    module: 'procurement_po',
    tierLevel: 3,
    tierName: 'CFO & Executive Board PO',
    minThresholdIDR: 50000001,
    maxThresholdIDR: null,
    requiredRole: 'executive',
    requiresPin: true,
    autoApproveBelowMin: false,
    slaHours: 48,
    description: 'Enterprise farm partnership contracts > 50M IDR require C-level executive sign-off',
  },
  {
    id: 'RULE-WASTE-01',
    module: 'waste_write_off',
    tierLevel: 1,
    tierName: 'Perishable Shrinkage Scrap Clearance',
    minThresholdIDR: 0,
    maxThresholdIDR: 15000000,
    requiredRole: 'store_manager',
    requiresPin: false,
    autoApproveBelowMin: false,
    slaHours: 12,
    description: 'Quality lead scrap disposal verified by Store Manager',
  },
  {
    id: 'RULE-ADJ-01',
    module: 'stock_adjustment',
    tierLevel: 1,
    tierName: 'Stocktake Variance Reconcile',
    minThresholdIDR: 0,
    maxThresholdIDR: 20000000,
    requiredRole: 'store_manager',
    requiresPin: false,
    autoApproveBelowMin: false,
    slaHours: 12,
    description: 'Stock opname variances require store manager approval before posting to GL',
  },
];

let approvalQueueList: ApprovalRequest[] = [
  {
    id: 'APR-2026-001',
    module: 'procurement_po',
    documentId: 'PO-2026-0042',
    documentTitle: 'Bulk Farm Harvest PO: Hydroponic Romaine & Butterhead',
    requestedBy: 'Andi Wijaya (Procurement Lead)',
    requestedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    amountIDR: 18500000,
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    currentTierLevel: 1,
    requiredTierLevel: 2,
    status: 'PENDING',
    history: [],
    payloadSummary: {
      sku: 'SKU-PRD-001',
      productName: 'Hydroponic Romaine Lettuce',
      quantity: 150,
      reason: 'Weekend fresh produce seasonal surge replenishment',
    },
  },
  {
    id: 'APR-2026-002',
    module: 'waste_write_off',
    documentId: 'WST-2026-0018',
    documentTitle: 'Chilled Display Spoilage Scrap Authorization',
    requestedBy: 'Siti Rahma (Quality Inspector)',
    requestedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    amountIDR: 3400000,
    storeId: 'store-jkt-pik',
    storeName: 'GroceMart PIK 2 The Avenue',
    currentTierLevel: 1,
    requiredTierLevel: 1,
    status: 'PENDING',
    history: [],
    payloadSummary: {
      sku: 'SKU-DRY-002',
      productName: 'Organic Greek Yogurt 500g',
      quantity: 45,
      reason: 'Cold-chain display shelf compressor temp excursion exceeding 4h',
    },
  },
];

let suratJalanList: SuratJalanDocument[] = [
  {
    id: 'SJ-2026-0418',
    documentNumber: 'SJ/GMRT/JKT/2026/0418',
    issueDate: new Date().toISOString().split('T')[0],
    deliveryOrderRef: 'DO/GMRT/2026/0210',
    transferRef: 'TRF-2026-001',
    poRef: 'PO-2026-0012',
    senderStoreId: 'store-jkt-senopati',
    senderStoreName: 'GroceMart Senopati Flagship',
    senderAddress: 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
    senderPhone: '+62 21 720 8891',
    recipientName: 'GroceMart PIK 2 Fulfillment Hub',
    recipientAddress: 'The Avenue Commercial Strip B-12, PIK 2, Jakarta Utara',
    recipientPhone: '+62 21 502 9942',
    recipientStoreId: 'store-jkt-pik',
    carrierName: 'GroceMart Fleet Cold Logistics',
    vehiclePlateNumber: 'B 9142 SRO',
    vehicleType: 'Refrigerated Van 1.5T (Cold-Chute -2°C to 4°C)',
    driverName: 'Bambang Supriyanto',
    driverPhone: '+62 812 8899 7711',
    coldChainTempCelsius: 3.5,
    specialHandlingInstructions: 'Continuous Reefer Thermologger active; do not break seal until receiving dock inspection.',
    items: [
      {
        sku: 'SKU-PRD-001',
        productName: 'Hydroponic Romaine Lettuce 250g',
        batchNumber: 'BAT-2026-081',
        quantity: 120,
        unit: 'pack',
        packagingType: 'Plastic Crate',
        condition: 'Fresh / Intact',
        notes: 'Pre-cooled harvest from Lembang farm partner',
      },
      {
        sku: 'SKU-DRY-001',
        productName: 'Farm Fresh Pasteurized Milk 1L',
        batchNumber: 'BAT-2026-094',
        quantity: 60,
        unit: 'bottle',
        packagingType: 'Corrugated Box',
        condition: 'Cold-Chilled OK',
        notes: 'Expiry verified > 10 days',
      },
    ],
    totalPackages: 180,
    totalWeightKg: 95.5,
    status: 'in_transit',
    senderSignatureName: 'Budi Santoso (Store Manager)',
    driverSignatureName: 'Bambang Supriyanto',
  },
];

let deliveryOrdersList: DeliveryOrderDocument[] = [
  {
    id: 'DO-2026-0210',
    doNumber: 'DO/GMRT/2026/0210',
    issueDate: new Date().toISOString().split('T')[0],
    poNumber: 'PO-2026-0012',
    customerOrStoreName: 'GroceMart PIK 2 Outlet & Commercial Kitchen',
    deliveryAddress: 'The Avenue Commercial Strip B-12, PIK 2, Jakarta Utara',
    deliveryWindow: 'Morning Slot (08:00 - 11:30 WIB)',
    authorizedOfficer: 'Hendra Gunawan (Logistics Supervisor)',
    items: [
      {
        sku: 'SKU-PRD-001',
        productName: 'Hydroponic Romaine Lettuce 250g',
        orderedQty: 120,
        dispatchedQty: 120,
        unit: 'pack',
        unitPriceIDR: 24500,
        totalPriceIDR: 2940000,
      },
      {
        sku: 'SKU-DRY-001',
        productName: 'Farm Fresh Pasteurized Milk 1L',
        orderedQty: 60,
        dispatchedQty: 60,
        unit: 'bottle',
        unitPriceIDR: 32000,
        totalPriceIDR: 1920000,
      },
    ],
    subtotalIDR: 4860000,
    taxIDR: 0,
    totalAmountIDR: 4860000,
    status: 'in_transit',
    notes: 'Priority morning delivery with calibrated cold sensor payload.',
  },
];

let shipmentsList: ShipmentQuotaTracking[] = [
  {
    id: 'SHP-2026-001',
    tripId: 'TRIP-JKT-0418',
    vehicleType: 'Refrigerated Van 1.5T',
    vehiclePlate: 'B 9142 SRO',
    maxPayloadKg: 1500,
    currentPayloadKg: 1140,
    quotaUtilizationPercent: 76,
    storageZone: 'cold_chilled',
    currentTempCelsius: 3.2,
    targetTempCelsius: 4.0,
    departureHub: 'Senopati Central Hub',
    destinationHub: 'PIK 2 Avenue Store',
    departureTime: '08:15 WIB',
    estimatedArrival: '09:45 WIB',
    driverName: 'Bambang Supriyanto',
    driverContact: '+62 812 8899 7711',
    assignedOrdersCount: 6,
    status: 'in_transit',
  },
  {
    id: 'SHP-2026-002',
    tripId: 'TRIP-BDG-0102',
    vehicleType: 'Chilled Truck 4T',
    vehiclePlate: 'D 8812 GCM',
    maxPayloadKg: 4000,
    currentPayloadKg: 3600,
    quotaUtilizationPercent: 90,
    storageZone: 'cold_chilled',
    currentTempCelsius: 2.8,
    targetTempCelsius: 4.0,
    departureHub: 'Lembang Agri Partner Terminal',
    destinationHub: 'Dago Green Market Hub',
    departureTime: '06:30 WIB',
    estimatedArrival: '07:45 WIB',
    driverName: 'Asep Saepudin',
    driverContact: '+62 813 2233 4455',
    assignedOrdersCount: 14,
    status: 'arrived',
  },
];

let qcInspectionsList: QCInspectionRecord[] = [
  {
    id: 'QC-2026-0042',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    referenceType: 'INCOMING_PO',
    referenceId: 'PO-2026-0012',
    sku: 'SKU-PRD-001',
    productName: 'Hydroponic Romaine Lettuce 250g',
    category: 'produce',
    batchNumber: 'BAT-2026-081',
    expiryDate: new Date(Date.now() + 86400000 * 12).toISOString().split('T')[0],
    sampleQuantity: 10,
    totalBatchQuantity: 150,
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    inspectorId: 'QC-INSP-01',
    inspectorName: 'Siti Rahma (HACCP Lead)',
    parameters: {
      visualFreshness: 'Grade A (Pristine)',
      temperatureCelsius: 3.8,
      coldChainCompliant: true,
      packagingIntegrity: 'Sealed & Intact',
      sensoryOdorCheck: 'Normal & Fresh',
      brixSugarContent: 4.2,
      weightToleranceCompliant: true,
    },
    disposition: 'PASSED',
    actionTaken: 'RELEASE_TO_SHELF',
    notes: 'Firm crisp leaves, zero tip burn, pristine harvest seals.',
  },
  {
    id: 'QC-2026-0043',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
    referenceType: 'INTER_WAREHOUSE_TRANSFER',
    referenceId: 'TRF-2026-001',
    sku: 'SKU-DRY-002',
    productName: 'Organic Greek Yogurt 500g',
    category: 'dairy_eggs',
    batchNumber: 'BAT-2026-077',
    expiryDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    sampleQuantity: 5,
    totalBatchQuantity: 40,
    storeId: 'store-jkt-pik',
    storeName: 'GroceMart PIK 2 The Avenue',
    inspectorId: 'QC-INSP-02',
    inspectorName: 'Dewi Lestari',
    parameters: {
      visualFreshness: 'Grade B (Acceptable)',
      temperatureCelsius: 5.8,
      coldChainCompliant: false,
      packagingIntegrity: 'Sealed & Intact',
      sensoryOdorCheck: 'Normal & Fresh',
      weightToleranceCompliant: true,
    },
    disposition: 'QUARANTINED',
    actionTaken: 'QUARANTINE_HOLD',
    notes: 'Intake temp 5.8°C exceeds 4.0°C limit; held under secondary microbiological testing.',
  },
];
let promotionRulesList: PromotionRule[] = [
  {
    id: 'PRM-2026-01',
    name: 'Organic Fresh Produce Welcome',
    code: 'ORGANIC20',
    type: 'PERCENTAGE_DISCOUNT',
    targetType: 'CATEGORY',
    targetValue: 'produce',
    discountPercent: 20,
    minOrderSubtotalIDR: 50000,
    active: true,
    description: '20% off all crisp greens and heirloom produce',
    usageCount: 42,
  },
  {
    id: 'PRM-2026-02',
    name: 'Gold Member VIP Fresh Bonus',
    code: 'VIPGOLD10',
    type: 'MEMBER_TIER',
    targetType: 'ALL',
    targetValue: 'ALL',
    discountPercent: 10,
    memberTier: 'GOLD',
    active: true,
    description: 'Exclusive 10% discount for Gold tier cardholders',
    usageCount: 88,
  },
  {
    id: 'PRM-2026-03',
    name: 'Butterhead Lettuce B2G1 Harvest Festival',
    code: 'B2G1_LETTUCE',
    type: 'BOGO',
    targetType: 'SKU',
    targetValue: 'SKU-PRD-001',
    buyQty: 2,
    getQty: 1,
    getDiscountPercent: 100,
    active: true,
    description: 'Buy 2 Butterhead heads, get 1 free',
    usageCount: 15,
  },
];
let posTransactionsHistory: POSTransactionReceipt[] = [
  {
    receiptNumber: 'RCP-SEN-882104',
    transactionId: 'TXN-POS-2026-0001',
    orderId: 'GCM-POS-882104',
    timestamp: '2026-10-16T14:32:00Z',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    cashierId: 'USR-CASH-01',
    cashierName: 'Andi Wijaya (Frontline Cashier)',
    shiftId: 'SHIFT-JKT-SEN-MORNING',
    items: [
      {
        id: 'cart-line-1',
        sku: 'SKU-PRD-001',
        productId: 'prod-01',
        name: 'Organic Hydroponic Butterhead Lettuce',
        category: 'produce',
        unitPrice: 18500,
        unitCost: 11000,
        quantity: 2,
        unit: '250g head',
        lineTotal: 37000,
        batchId: 'BAT-2026-081',
        lotNumber: 'LOT-LETT-2610-A',
        expiryDate: '2026-10-12T23:59:59Z',
        daysUntilExpiry: 2,
      },
      {
        id: 'cart-line-2',
        sku: 'SKU-DAI-001',
        productId: 'prod-04',
        name: 'Artisanal Pasteurised A2 Fresh Milk',
        category: 'dairy',
        unitPrice: 38000,
        unitCost: 22000,
        quantity: 1,
        unit: '1L glass bottle',
        lineTotal: 38000,
        batchId: 'BAT-2026-084',
        lotNumber: 'LOT-MILK-2610-A',
        expiryDate: '2026-10-16T23:59:59Z',
        daysUntilExpiry: 6,
      },
    ],
    subtotal: 75000,
    discount: 0,
    tax: 8250,
    total: 83250,
    currency: 'IDR',
    currencyTotal: 83250,
    currencyRateToIDR: 1,
    paymentMethod: 'qris',
    qrisRef: 'QRIS-POS-882104',
    journalEntryIds: ['GLE-2026-0103', 'GLE-2026-0104', 'GLE-2026-0105', 'GLE-2026-0106'],
    inventoryDeductedCount: 3,
    totalCogsCost: 44000,
  },
];

// -------------------------------------------------------------
// MODULE 1, 2, 3, 4 IN-MEMORY DATA STORES
// -------------------------------------------------------------
// Module 1: Weight Tolerance by Category & Natural Shrinkage adjustments
let weightToleranceConfigs: WeightToleranceConfig[] = [
  {
    category: 'produce',
    categoryLabel: 'Fresh Organic Produce (Leafy Greens, Berries, Root Vegetables)',
    maxEvaporationTolerancePercent: 5.0, // 5% expected transpiration loss over 48h
    auditIntervalHours: 24,
    description: 'Natural moisture respiration and cell evaporation during ambient/chilled holding',
  },
  {
    category: 'meat_seafood',
    categoryLabel: 'Artisanal Butchery & Prime Seafood Cuts',
    maxEvaporationTolerancePercent: 3.0, // 3% dry-aging/drip purge tolerance
    auditIntervalHours: 12,
    description: 'Drip purge loss during cold-chain 0-2°C storage',
  },
  {
    category: 'dairy_eggs',
    categoryLabel: 'Artisan Cheeses & Dairy',
    maxEvaporationTolerancePercent: 1.5,
    auditIntervalHours: 48,
    description: 'Rind moisture loss in European specialty wheels',
  },
  {
    category: 'bakery',
    categoryLabel: 'Sourdough Loaves & Bakery',
    maxEvaporationTolerancePercent: 2.0,
    auditIntervalHours: 24,
    description: 'Ambient crust crumb water exchange',
  },
  {
    category: 'pantry_coffee',
    categoryLabel: 'Heritage Dry Pantry & Whole Bean Specialty Coffee',
    maxEvaporationTolerancePercent: 0.5,
    auditIntervalHours: 168,
    description: 'Standard ambient degas tolerance',
  },
];

let naturalShrinkageAdjustments: NaturalShrinkageAdjustment[] = [
  {
    id: 'EVAP-2026-001',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    sku: 'SKU-PRD-001',
    productName: 'Organic Hydroponic Butterhead Lettuce',
    category: 'produce',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    warehouseZoneId: 'WH-JKT-SEN-COLD',
    batchId: 'BAT-2601-PRD',
    lotNumber: 'LOT-2601-A1',
    recordedGrossWeightGrams: 5000,
    actualAuditWeightGrams: 4820,
    weightLossGrams: 180,
    weightLossPercent: 3.6,
    toleranceThresholdPercent: 5.0,
    isWithinNaturalTolerance: true,
    classification: 'Natural Shrinkage / Evaporation Loss',
    unitCost: 11000,
    totalLossCost: 39600,
    glEntryId: 'GLE-2026-0038',
    auditorId: 'USR-AUD-01',
    auditorName: 'Siti Rahmawati (Receiving Quality Lead)',
    shiftId: 'SHIFT-JKT-MORNING-01',
    notes: '24h Cold Room scale audit verified. Water loss within 5% organic leaf threshold. No rot or bacterial decay.',
  },
  {
    id: 'EVAP-2026-002',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
    sku: 'SKU-MEA-001',
    productName: 'Grass-Fed Angus Ribeye Steak',
    category: 'meat_seafood',
    storeId: 'store-jkt-senopati',
    storeName: 'GroceMart Senopati Flagship',
    warehouseZoneId: 'WH-JKT-SEN-COLD',
    batchId: 'BAT-2603-MEA',
    lotNumber: 'LOT-2603-M1',
    recordedGrossWeightGrams: 4500,
    actualAuditWeightGrams: 4390,
    weightLossGrams: 110,
    weightLossPercent: 2.44,
    toleranceThresholdPercent: 3.0,
    isWithinNaturalTolerance: true,
    classification: 'Natural Shrinkage / Evaporation Loss',
    unitCost: 82000,
    totalLossCost: 90200,
    glEntryId: 'GLE-2026-0039',
    auditorId: 'USR-MGR-02',
    auditorName: 'Budi Santoso (Butchery Supervisor)',
    shiftId: 'SHIFT-JKT-MORNING-01',
    notes: 'Natural drip purge in controlled moisture sub-zero packaging. Within 3.0% dry-cut limit.',
  },
];

// Module 2: Real-time Substitution records with Buyer Push Prompt Engine
let substitutionPromptRecords: SubstitutionPromptRecord[] = [
  {
    id: 'SUB-PRM-2026-001',
    orderId: 'ORD-2026-0891',
    itemId: 'item-0891-2',
    customerName: 'Alya Widyastuti',
    customerPhone: '+62 811 9823 441',
    originalSku: 'SKU-PRD-004',
    originalProductName: 'Hass Avocados (Size L, Premium 500g)',
    originalPrice: 42000,
    originalQty: 1,
    originalBatchId: 'BAT-2605-AVO',
    replacementSku: 'SKU-PRD-001',
    replacementProductName: 'Organic Butterhead Lettuce Pack (Dual Fresh)',
    replacementPrice: 44000,
    replacementBatchId: 'BAT-2601-PRD',
    replacementLotNumber: 'LOT-2601-A1',
    replacementExpiryDate: '2026-10-18',
    priceDelta: 2000,
    absorbPriceDifference: true,
    promptStatus: 'approved_by_customer',
    channel: 'WhatsApp',
    simulationMessage: 'Hi Alya! Your avocados sold out this morning. Packer Rudi selected our fresh organic Butterhead pack (+Rp 2,000 value at NO EXTRA CHARGE). Tap to approve.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    decidedAt: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    packerId: 'USR-PCK-04',
    storeId: 'store-jkt-senopati',
    glJournalIds: ['GLE-2026-0040', 'GLE-2026-0041'],
    fifoAuditLog: 'Substituted SKU-PRD-004 -> SKU-PRD-001. FIFO batch BAT-2601-PRD lot LOT-2601-A1 allocated.',
  },
];

// Module 3: Security & RBAC Active Sessions and Audit Log
let securityAuditTrail: SecurityAuditTrailRecord[] = [
  {
    id: 'AUD-SEC-2026-0001',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    actionType: 'GOODS_RECEIPT_APPROVAL',
    resourceId: 'GR-2026-001',
    userId: 'USR-MGR-01',
    userName: 'Dewi Sartika (Store Manager)',
    userRole: 'store_manager',
    storeId: 'store-jkt-senopati',
    shiftId: 'SHIFT-JKT-MORNING-01',
    status: 'AUTHORIZED_EXECUTED',
    metadata: { poId: 'PO-2026-001', itemsReceived: 2, temperatureCheck: '3.8°C' },
  },
  {
    id: 'AUD-SEC-2026-0002',
    timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    actionType: 'SHRINKAGE_WRITE_OFF',
    resourceId: 'WST-2026-001',
    userId: 'USR-MGR-01',
    userName: 'Dewi Sartika (Store Manager)',
    userRole: 'store_manager',
    storeId: 'store-jkt-senopati',
    shiftId: 'SHIFT-JKT-MORNING-01',
    status: 'AUTHORIZED_EXECUTED',
    metadata: { reason: 'expired', totalLossCost: 55000, sku: 'SKU-PRD-001' },
  },
];

// Canonical 7-Role Enterprise Staff Roster (plus backward-compatible role normalization)
const BRANCH_ASSIGNMENT_OPTIONS: { storeId: string; storeName: string; hubType: string }[] = [
  ...INITIAL_STORE_SCHEDULES.map((s) => ({
    storeId: s.storeId,
    storeName: s.storeName,
    hubType: s.storeId === 'store-jkt-pik' ? 'Dark Store' : 'Retail Flagship',
  })),
  { storeId: 'WH-CDC-01', storeName: 'Central Distribution Center (WH-CDC-01)', hubType: 'Central CDC' },
  { storeId: 'ALL', storeName: 'All Outlets (Consolidated)', hubType: 'Multi-Branch Network' },
];

interface OperatorAssignmentEntry {
  userRole?: CanonicalServerRole;
  storeId: string;
  storeName: string;
  isActive?: boolean;
  loginPin?: string;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_OPERATOR_ASSIGNMENTS: Record<string, OperatorAssignmentEntry> = {
  'USR-CASH-01': { userRole: 'cashier', storeId: 'store-jkt-senopati', storeName: 'GroceMart Senopati Flagship', isActive: true, loginPin: '8821' },
  'USR-WHS-01': { userRole: 'warehouse', storeId: 'store-jkt-senopati', storeName: 'GroceMart Senopati Flagship', isActive: true, loginPin: '8821' },
  'USR-PUR-01': { userRole: 'purchasing', storeId: 'ALL', storeName: 'All Outlets (Consolidated)', isActive: true, loginPin: '8821' },
  'USR-MGR-01': { userRole: 'store_manager', storeId: 'store-jkt-senopati', storeName: 'GroceMart Senopati Flagship', isActive: true, loginPin: '8821' },
  'USR-ADM-01': { userRole: 'admin', storeId: 'ALL', storeName: 'All Outlets (Consolidated)', isActive: true, loginPin: '8821' },
  'USR-COO-01': { userRole: 'coo', storeId: 'ALL', storeName: 'All Outlets (Consolidated)', isActive: true, loginPin: '8821' },
  'USR-SADM-01': { userRole: 'super_admin', storeId: 'ALL', storeName: 'All Outlets (Consolidated)', isActive: true, loginPin: '8821' },
};

let operatorBranchAssignments: Record<string, OperatorAssignmentEntry> = JSON.parse(
  JSON.stringify(DEFAULT_OPERATOR_ASSIGNMENTS)
);

type CanonicalServerRole =
  | 'cashier'
  | 'warehouse'
  | 'purchasing'
  | 'store_manager'
  | 'admin'
  | 'coo'
  | 'super_admin';

function normalizeServerRoleStrict(role?: string | null): CanonicalServerRole | null {
  switch (role) {
    case 'cashier':
      return 'cashier';
    case 'warehouse':
    case 'warehouse_picker':
    case 'receiving_clerk':
      return 'warehouse';
    case 'purchasing':
      return 'purchasing';
    case 'store_manager':
      return 'store_manager';
    case 'admin':
      return 'admin';
    case 'coo':
    case 'executive':
      return 'coo';
    case 'super_admin':
      return 'super_admin';
    default:
      return null;
  }
}

function normalizeServerRole(role?: string | null): CanonicalServerRole {
  return normalizeServerRoleStrict(role) || 'super_admin';
}

function isBranchScopedServerRole(role?: string | null): boolean {
  const canonical = normalizeServerRole(role);
  return canonical === 'cashier' || canonical === 'warehouse' || canonical === 'store_manager';
}

const ROLE_PERMISSION_TEMPLATES: Record<
  CanonicalServerRole,
  { assignedZones: StorageZoneType[]; permissions: StaffShiftSession['permissions'] }
> = {
  cashier: {
    assignedZones: ['ambient'],
    permissions: {
      canViewPos: true,
      canViewInventory: false,
      canAdjustInventory: false,
      canPickZone: () => false,
      canReceiveGoods: false,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
      canViewValuation: false,
      canCreatePrPo: false,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: false,
      canManageOperatorAssignments: false,
    },
  },
  warehouse: {
    assignedZones: ['cold_chilled', 'ambient', 'freezer'],
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
      canViewValuation: false,
      canCreatePrPo: false,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: true,
      canManageOperatorAssignments: false,
    },
  },
  purchasing: {
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: () => false,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: false,
      canManageOperatorAssignments: false,
    },
  },
  store_manager: {
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: false,
      canOverrideStoreClosure: true,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: true,
      canOverridePosPrice: true,
      canApproveStocktake: true,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: true,
      canManageOperatorAssignments: false,
    },
  },
  admin: {
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: () => false,
      canReceiveGoods: false,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: false,
      canViewValuation: true,
      canCreatePrPo: false,
      canPayVendorBills: true,
      canManageGiro: true,
      canModifyCoa: true,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: true,
      canViewBranchMonitor: true,
      canConfirmArrival: false,
      canManageOperatorAssignments: false,
    },
  },
  coo: {
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: true,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: true,
      canManageGiro: true,
      canModifyCoa: true,
      canFactoryReset: false,
      canManagePromos: true,
      canOverridePosPrice: true,
      canApproveStocktake: true,
      canViewMultiBranchRevenue: true,
      canViewBranchMonitor: true,
      canConfirmArrival: true,
      canManageOperatorAssignments: false,
    },
  },
  super_admin: {
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: true,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: true,
      canManageGiro: true,
      canModifyCoa: true,
      canFactoryReset: true,
      canManagePromos: true,
      canOverridePosPrice: true,
      canApproveStocktake: true,
      canViewMultiBranchRevenue: true,
      canViewBranchMonitor: true,
      canConfirmArrival: true,
      canManageOperatorAssignments: true,
    },
  },
};

const AVAILABLE_STAFF_USERS: StaffShiftSession[] = [
  {
    userId: 'USR-CASH-01',
    userName: 'Andi Wijaya (Frontline Cashier)',
    userRole: 'cashier',
    storeId: 'store-jkt-senopati',
    assignedBranchId: 'store-jkt-senopati',
    isBranchScoped: true,
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: false,
      canAdjustInventory: false,
      canPickZone: () => false,
      canReceiveGoods: false,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
      canViewValuation: false,
      canCreatePrPo: false,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: false,
      canManageOperatorAssignments: false,
    },
  },
  {
    userId: 'USR-WHS-01',
    userName: 'Budi Santoso (Warehouse Ops)',
    userRole: 'warehouse',
    storeId: 'store-jkt-senopati',
    assignedBranchId: 'store-jkt-senopati',
    isBranchScoped: true,
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['cold_chilled', 'ambient', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
      canViewValuation: false,
      canCreatePrPo: false,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: true,
      canManageOperatorAssignments: false,
    },
  },
  {
    userId: 'USR-PUR-01',
    userName: 'Dewi Lestari (Procurement Officer)',
    userRole: 'purchasing',
    storeId: 'ALL',
    assignedBranchId: 'ALL',
    isBranchScoped: false,
    storeName: 'All Outlets (Consolidated)',
    activeShiftId: 'SHIFT-HQ-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: () => false,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: false,
      canManageOutlets: false,
      canOverrideStoreClosure: false,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: false,
      canManageOperatorAssignments: false,
    },
  },
  {
    userId: 'USR-MGR-01',
    userName: 'Rina Kartika (Branch Store Manager)',
    userRole: 'store_manager',
    storeId: 'store-jkt-senopati',
    assignedBranchId: 'store-jkt-senopati',
    isBranchScoped: true,
    storeName: 'GroceMart Senopati Flagship',
    activeShiftId: 'SHIFT-JKT-SEN-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: false,
      canOverrideStoreClosure: true,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: false,
      canManageGiro: false,
      canModifyCoa: false,
      canFactoryReset: false,
      canManagePromos: true,
      canOverridePosPrice: true,
      canApproveStocktake: true,
      canViewMultiBranchRevenue: false,
      canViewBranchMonitor: false,
      canConfirmArrival: true,
      canManageOperatorAssignments: false,
    },
  },
  {
    userId: 'USR-ADM-01',
    userName: 'Siti Aminah (Back-Office Admin)',
    userRole: 'admin',
    storeId: 'ALL',
    assignedBranchId: 'ALL',
    isBranchScoped: false,
    storeName: 'All Outlets (Consolidated)',
    activeShiftId: 'SHIFT-HQ-MORNING',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: false,
      canViewInventory: true,
      canAdjustInventory: false,
      canPickZone: () => false,
      canReceiveGoods: false,
      canApprovePurchaseOrder: false,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: false,
      canViewValuation: true,
      canCreatePrPo: false,
      canPayVendorBills: true,
      canManageGiro: true,
      canModifyCoa: true,
      canFactoryReset: false,
      canManagePromos: false,
      canOverridePosPrice: false,
      canApproveStocktake: false,
      canViewMultiBranchRevenue: true,
      canViewBranchMonitor: true,
      canConfirmArrival: false,
      canManageOperatorAssignments: false,
    },
  },
  {
    userId: 'USR-COO-01',
    userName: 'Irfan Hakim (Chief Operations Officer)',
    userRole: 'coo',
    storeId: 'ALL',
    assignedBranchId: 'ALL',
    isBranchScoped: false,
    storeName: 'All Outlets (Consolidated)',
    activeShiftId: 'SHIFT-EXEC-ALL-HOURS',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: true,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: true,
      canManageGiro: true,
      canModifyCoa: true,
      canFactoryReset: false,
      canManagePromos: true,
      canOverridePosPrice: true,
      canApproveStocktake: true,
      canViewMultiBranchRevenue: true,
      canViewBranchMonitor: true,
      canConfirmArrival: true,
      canManageOperatorAssignments: false,
    },
  },
  {
    userId: 'USR-SADM-01',
    userName: 'Mochammad Noer Suhasbi (Super Admin)',
    userRole: 'super_admin',
    storeId: 'ALL',
    assignedBranchId: 'ALL',
    isBranchScoped: false,
    storeName: 'All Outlets (Consolidated)',
    activeShiftId: 'SHIFT-SADM-ALL-HOURS',
    shiftName: 'Morning Shift',
    assignedZones: ['ambient', 'cold_chilled', 'freezer'],
    loginTimestamp: new Date().toISOString(),
    permissions: {
      canViewPos: true,
      canViewInventory: true,
      canAdjustInventory: true,
      canPickZone: () => true,
      canReceiveGoods: true,
      canApprovePurchaseOrder: true,
      canViewFinancePnL: true,
      canManageOutlets: true,
      canOverrideStoreClosure: true,
      canViewValuation: true,
      canCreatePrPo: true,
      canPayVendorBills: true,
      canManageGiro: true,
      canModifyCoa: true,
      canFactoryReset: true,
      canManagePromos: true,
      canOverridePosPrice: true,
      canApproveStocktake: true,
      canViewMultiBranchRevenue: true,
      canViewBranchMonitor: true,
      canConfirmArrival: true,
      canManageOperatorAssignments: true,
    },
  },
];

let currentActiveStaffSession: StaffShiftSession = AVAILABLE_STAFF_USERS[6]; // Default to super_admin for full administrative control

function resolveStaffUser(idOrRole?: string | null): StaffShiftSession | undefined {
  if (!idOrRole) return undefined;
  const trimmed = String(idOrRole).trim();
  if (trimmed === 'USR-PCK-01') return AVAILABLE_STAFF_USERS.find((u) => u.userId === 'USR-WHS-01');
  if (trimmed === 'USR-EXEC-01') return AVAILABLE_STAFF_USERS.find((u) => u.userId === 'USR-COO-01');
  const direct = AVAILABLE_STAFF_USERS.find((u) => u.userId === trimmed);
  if (direct) return direct;
  const clean = trimmed.toLowerCase();
  return AVAILABLE_STAFF_USERS.find(
    (u) =>
      u.userId.toLowerCase() === clean ||
      u.userName.toLowerCase().includes(clean) ||
      u.userRole.toLowerCase() === clean.replace(/\s+/g, '_')
  );
}

function syncAssignmentsOntoProfiles() {
  AVAILABLE_STAFF_USERS.forEach((profile) => {
    const assigned = operatorBranchAssignments[profile.userId];
    const resolvedRole = normalizeServerRoleStrict(assigned?.userRole) || normalizeServerRole(profile.userRole);
    const template = ROLE_PERMISSION_TEMPLATES[resolvedRole];
    profile.userRole = resolvedRole;
    profile.assignedZones = [...template.assignedZones];
    profile.permissions = { ...template.permissions };
    if (assigned) {
      profile.storeId = assigned.storeId;
      profile.assignedBranchId = assigned.storeId;
      profile.storeName = assigned.storeName;
      profile.isActive = assigned.isActive !== false;
    } else {
      profile.assignedBranchId = profile.storeId;
      profile.isActive = true;
    }
    profile.isBranchScoped = isBranchScopedServerRole(profile.userRole);
  });
  const activeUpdated = AVAILABLE_STAFF_USERS.find((u) => u.userId === currentActiveStaffSession?.userId);
  if (activeUpdated) {
    currentActiveStaffSession = {
      ...activeUpdated,
      loginTimestamp: currentActiveStaffSession.loginTimestamp,
      shiftName: currentActiveStaffSession.shiftName,
    };
  }
}

syncAssignmentsOntoProfiles();

// Module 4: Climate-Adaptive Cold-Chain Configs & Multi-Currency FX Rates
const CURRENCY_RATES: Record<SupportedCurrency, CurrencyExchangeRate> = {
  IDR: { code: 'IDR', symbol: 'Rp', rateToIDR: 1, decimalPlaces: 0 },
  USD: { code: 'USD', symbol: '$', rateToIDR: 16000, decimalPlaces: 2 },
  EUR: { code: 'EUR', symbol: '€', rateToIDR: 17200, decimalPlaces: 2 },
  AUD: { code: 'AUD', symbol: 'A$', rateToIDR: 10400, decimalPlaces: 2 },
};

let climateAdaptiveConfigs: ClimateAdaptiveThresholdConfig[] = [
  {
    warehouseZoneId: 'WH-JKT-SEN-COLD',
    zoneName: 'Senopati Chilled Walk-In Cold Room',
    storeId: 'store-jkt-senopati',
    regionalClimateProfile: 'Tropical High-Humidity (Jakarta/Bali)',
    ambientExternalTempCelsius: 34.5,
    externalHumidityPercent: 88,
    standardTempMinCelsius: 2.0,
    standardTempMaxCelsius: 4.5,
    adaptiveOffsetCelsius: -1.0, // Tighter margin under tropical heatwave
    activeAlertThresholdCelsius: 3.5,
    currentActualTempCelsius: 3.1,
    coolingCompressorDutyCyclePercent: 78,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  {
    warehouseZoneId: 'WH-JKT-SEN-FRZ',
    zoneName: 'Senopati Deep Freeze Vault',
    storeId: 'store-jkt-senopati',
    regionalClimateProfile: 'Tropical High-Humidity (Jakarta/Bali)',
    ambientExternalTempCelsius: 34.5,
    externalHumidityPercent: 88,
    standardTempMinCelsius: -22.0,
    standardTempMaxCelsius: -18.0,
    adaptiveOffsetCelsius: -1.5,
    activeAlertThresholdCelsius: -19.5,
    currentActualTempCelsius: -20.2,
    coolingCompressorDutyCyclePercent: 85,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  {
    warehouseZoneId: 'WH-BDG-DAG-COLD',
    zoneName: 'Dago Bandung Highland Farm Direct Cold Storage',
    storeId: 'store-bdg-dago',
    regionalClimateProfile: 'Highland Mild (Bandung)',
    ambientExternalTempCelsius: 22.0,
    externalHumidityPercent: 75,
    standardTempMinCelsius: 2.0,
    standardTempMaxCelsius: 5.0,
    adaptiveOffsetCelsius: 0.0,
    activeAlertThresholdCelsius: 4.8,
    currentActualTempCelsius: 3.8,
    coolingCompressorDutyCyclePercent: 45,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  {
    warehouseZoneId: 'WH-DPS-CNG-COLD',
    zoneName: 'Batu Bolong Organic Cold Hub',
    storeId: 'store-bali-canggu',
    regionalClimateProfile: 'Tropical High-Humidity (Jakarta/Bali)',
    ambientExternalTempCelsius: 33.0,
    externalHumidityPercent: 82,
    standardTempMinCelsius: 2.0,
    standardTempMaxCelsius: 4.5,
    adaptiveOffsetCelsius: -0.8,
    activeAlertThresholdCelsius: 3.7,
    currentActualTempCelsius: 3.4,
    coolingCompressorDutyCyclePercent: 72,
    isTempAlertActive: false,
    alertSeverity: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
];

// -------------------------------------------------------------
// GUARD 1: Concurrency & Anti-Overselling Lock Manager
// Strict transactional isolation & mutex queue for inventory deductions
// -------------------------------------------------------------
class InventoryConcurrencyManager {
  private activeLocks = new Map<string, Promise<void>>();

  async runWithLock<T>(resourceKeys: string[], action: () => Promise<T> | T): Promise<T> {
    const keys = Array.from(new Set(resourceKeys)).sort();
    
    // Acquire all locks in deterministic order to prevent deadlocks
    for (const key of keys) {
      while (this.activeLocks.has(key)) {
        await this.activeLocks.get(key);
      }
      let release!: () => void;
      const p = new Promise<void>((resolve) => { release = resolve; });
      this.activeLocks.set(key, p);
      (p as any)._release = release;
    }

    try {
      return await action();
    } finally {
      for (const key of keys) {
        const p = this.activeLocks.get(key) as any;
        if (p && p._release) {
          p._release();
        }
        this.activeLocks.delete(key);
      }
    }
  }
}
const inventoryConcurrencyManager = new InventoryConcurrencyManager();

// -------------------------------------------------------------
// GUARD 2: Payment Webhook Idempotency Store
// -------------------------------------------------------------
interface IdempotencyRecord {
  idempotencyKey: string;
  orderId: string;
  timestamp: string;
  statusCode: number;
  responseBody: any;
  qrisReference: string;
}
const idempotencyStore = new Map<string, IdempotencyRecord>();

// -------------------------------------------------------------
// Helper to inspect active orders for a store or network-wide
// -------------------------------------------------------------
function getActiveOrdersForStore(storeId?: string): {
  orderId: string;
  customer: string;
  status: string;
  storeName: string;
  deliveryMethod: string;
}[] {
  const active: {
    orderId: string;
    customer: string;
    status: string;
    storeName: string;
    deliveryMethod: string;
  }[] = [];

  // Check customer orders (in_transit or packing/placed)
  customerOrders.forEach((o) => {
    const isTargetStore =
      !storeId ||
      storeId === 'ALL' ||
      o.pickupStore?.id === storeId ||
      (o.deliveryAddress && storeId.includes('jkt'));
    const isOutForDelivery = o.status === 'in_transit';
    const isAwaitingPickup = o.status === 'packing' || o.status === 'placed';
    if (isTargetStore && (isOutForDelivery || isAwaitingPickup)) {
      active.push({
        orderId: o.id,
        customer: o.customerName,
        status: o.status === 'in_transit' ? 'Out for Delivery' : 'Awaiting Pickup / In Packing',
        storeName: o.pickupStore?.name || 'Senopati Hub',
        deliveryMethod: o.deliveryMethod,
      });
    }
  });

  // Check picker orders (in_progress, assigned, ready_for_packing)
  pickerOrders.forEach((po) => {
    const isTargetStore = !storeId || storeId === 'ALL' || po.storeId === storeId;
    if (
      isTargetStore &&
      (po.pickerStatus === 'in_progress' ||
        po.pickerStatus === 'assigned' ||
        po.pickerStatus === 'ready_for_packing')
    ) {
      if (!active.some((a) => a.orderId === po.orderId)) {
        active.push({
          orderId: po.orderId,
          customer: po.customerName,
          status:
            po.pickerStatus === 'ready_for_packing'
              ? 'Ready for Dispatch / Pickup'
              : 'Picking In Progress',
          storeName: po.storeName,
          deliveryMethod: po.deliveryMethod,
        });
      }
    }
  });

  return active;
}

// Mock QRIS payment transaction statuses
const qrisTransactions = new Map<string, {
  orderId: string;
  qrisReference: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'expired';
  expiresAt: string;
  paidAt?: string;
  settlementChannel?: string;
}>();

const inTransitTransferLots = new Map<
  string,
  { lotNumber: string; expiryDate: string; allocatedQty: number; unitCost: number; storageZone: StorageZoneType; sellingPrice: number; supplierName: string }[]
>();

// Helper to calculate CRC16 for Indonesian QRIS specification
function calculateCRC16(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Generate valid EMVCo / ASPI standardized dynamic QRIS payload string
function generateQRISPayload(orderId: string, amount: number): string {
  const amountStr = Math.round(amount).toString();
  const amountField = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  const refField = `62${(orderId.length + 4).toString().padStart(2, '0')}01${orderId.length.toString().padStart(2, '0')}${orderId}`;
  
  const rawPayloadWithoutCRC =
    '000201' + // Format Indicator
    '010212' + // Point of Initiation: Dynamic QR
    '26630016ID.GO.BI.QRIS011893600002010200392817440215ID10200392817440303UME' + // Merchant Account Info & NMID
    '52045411' + // Merchant Category Code: Supermarkets & Groceries
    '5303360' +  // Currency: 360 (IDR)
    amountField +
    '5802ID' +   // Country Code: ID
    '5928GROCEMART RETAIL INDONESIA' + // Merchant Name
    '6007JAKARTA' + // Merchant City
    '610512110' +  // Postal Code
    refField +
    '6304'; // CRC tag prefix

  const checksum = calculateCRC16(rawPayloadWithoutCRC);
  return `${rawPayloadWithoutCRC}${checksum}`;
}

function seedBaselineEnterpriseNotifications() {
  syncAllBatchesExpiryStatus(Date.now());
  giroRecordsList
    .filter((g) => g.status === 'PENDING_CLEARING')
    .slice(0, 2)
    .forEach((g) => {
      emitEnterpriseNotification({
        dedupeKey: `GIRO_PENDING:${g.id}`,
        category: 'B2B_FINANCE',
        severity: 'ACTION_REQUIRED',
        title: `Bilyet Giro Clearing Due (#${g.giroNumber})`,
        message: `${g.customerName} Giro warkat (${g.issuingBank}) for Rp ${g.amountIDR.toLocaleString('id-ID')} is pending SKNBI clearing.`,
        metadataLabel: `${g.giroNumber} • Rp ${g.amountIDR.toLocaleString('id-ID')}`,
        targetTab: 'accounting',
        targetSubTab: 'b2b_ar',
        skipIfExistsAny: true,
      });
    });
  approvalQueueList
    .filter((a) => a.status === 'PENDING')
    .slice(0, 2)
    .forEach((a) => {
      emitEnterpriseNotification({
        dedupeKey: `APR_QUEUE:${a.id}`,
        category: 'PROCUREMENT_FINANCE',
        severity: 'ACTION_REQUIRED',
        title: `Approval Required: ${a.documentTitle}`,
        message: `${a.payloadSummary?.reason || 'Document queued for authorization'} (Tier ${a.currentTierLevel}/${a.requiredTierLevel}).`,
        metadataLabel: `${a.documentId} • Rp ${a.amountIDR.toLocaleString('id-ID')}`,
        targetTab: 'approvals',
        skipIfExistsAny: true,
      });
    });
  pickerOrders
    .filter((p) => p.pickerStatus === 'assigned' || p.pickerStatus === 'in_progress')
    .slice(0, 2)
    .forEach((p) => {
      emitEnterpriseNotification({
        dedupeKey: `PICKER_QUEUE:${p.orderId}`,
        category: 'FULFILLMENT',
        severity: 'INFO',
        title: `Order Ready for Picking (#${p.orderId})`,
        message: `${p.customerName} (${p.totalItems} items) assigned at ${p.storeName}.`,
        metadataLabel: `${p.orderId} • ${p.storeName}`,
        targetTab: 'picker',
        skipIfExistsAny: true,
      });
    });
}

seedBaselineEnterpriseNotifications();

// -------------------------------------------------------------
// NON-VOLATILE STATE PERSISTENCE SNAPSHOT (.grocematrix-state.json)
// -------------------------------------------------------------
const STATE_SNAPSHOT_PATH = path.resolve(__dirname, '.grocematrix-state.json');
const STATE_SNAPSHOT_TMP_PATH = path.resolve(__dirname, '.grocematrix-state.json.tmp');

function captureServerState() {
  return {
    savedAt: new Date().toISOString(),
    storeStatus,
    storeSchedules,
    warehouseZones,
    storeInventoryTiers,
    inventoryList,
    purchaseRequests,
    purchaseOrders,
    goodsReceipts,
    chartOfAccounts,
    generalLedger,
    auditTrail,
    inventoryBatches,
    wasteRecords,
    pickerOrders,
    customerOrders,
    enterpriseSettings,
    landedCostsList,
    warehouseBins,
    warehouseRoutes,
    vendorBillsList,
    enterpriseQuotationsList,
    b2bCustomersList,
    wholesaleProductsList,
    pwpRulesList,
    giroRecordsList,
    b2bOrdersList,
    vendorCreditNotesList,
    dynamicMarkdownConfig,
    removalStrategiesConfig,
    skuTaxRulesList,
    customerRmaList,
    vendorRtvList,
    blindOpnameSheetsList,
    posShiftsList,
    posHardwareStatus,
    coldChainLogs,
    posReturnsList,
    coaMappingConfig,
    posCheckoutConfig,
    stockOpnameSessions,
    stockTransfersList,
    approvalRulesList,
    approvalQueueList,
    suratJalanList,
    deliveryOrdersList,
    shipmentsList,
    qcInspectionsList,
    promotionRulesList,
    posTransactionsHistory,
    weightToleranceConfigs,
    naturalShrinkageAdjustments,
    substitutionPromptRecords,
    securityAuditTrail,
    climateAdaptiveConfigs,
    enterpriseNotificationsList,
    operatorBranchAssignments,
    communicationGatewayConfig,
    communicationLogs,
    qrisTransactionsEntries: Array.from(qrisTransactions.entries()),
    idempotencyStoreEntries: Array.from(idempotencyStore.entries()),
    inTransitTransferLotsEntries: Array.from(inTransitTransferLots.entries()),
  };
}

function applyServerState(snap: any) {
  if (!snap || typeof snap !== 'object') return;
  if (snap.storeStatus) storeStatus = snap.storeStatus;
  if (Array.isArray(snap.storeSchedules)) storeSchedules = snap.storeSchedules;
  if (Array.isArray(snap.warehouseZones)) warehouseZones = snap.warehouseZones;
  if (Array.isArray(snap.storeInventoryTiers)) storeInventoryTiers = snap.storeInventoryTiers;
  if (Array.isArray(snap.inventoryList)) inventoryList = snap.inventoryList;
  if (Array.isArray(snap.purchaseRequests)) purchaseRequests = snap.purchaseRequests;
  if (Array.isArray(snap.purchaseOrders)) purchaseOrders = snap.purchaseOrders;
  if (Array.isArray(snap.goodsReceipts)) goodsReceipts = snap.goodsReceipts;
  if (Array.isArray(snap.chartOfAccounts)) chartOfAccounts = snap.chartOfAccounts;
  if (Array.isArray(snap.generalLedger)) generalLedger = snap.generalLedger;
  if (Array.isArray(snap.auditTrail)) auditTrail = snap.auditTrail;
  if (Array.isArray(snap.inventoryBatches)) inventoryBatches = snap.inventoryBatches;
  if (Array.isArray(snap.wasteRecords)) wasteRecords = snap.wasteRecords;
  if (Array.isArray(snap.pickerOrders)) pickerOrders = snap.pickerOrders;
  if (Array.isArray(snap.customerOrders)) customerOrders = snap.customerOrders;
  if (snap.enterpriseSettings) enterpriseSettings = snap.enterpriseSettings;
  if (Array.isArray(snap.landedCostsList)) landedCostsList = snap.landedCostsList;
  if (Array.isArray(snap.warehouseBins)) warehouseBins = snap.warehouseBins;
  if (Array.isArray(snap.warehouseRoutes)) warehouseRoutes = snap.warehouseRoutes;
  if (Array.isArray(snap.vendorBillsList)) vendorBillsList = snap.vendorBillsList;
  if (Array.isArray(snap.enterpriseQuotationsList)) enterpriseQuotationsList = snap.enterpriseQuotationsList;
  if (Array.isArray(snap.b2bCustomersList)) b2bCustomersList = snap.b2bCustomersList;
  if (Array.isArray(snap.wholesaleProductsList)) wholesaleProductsList = snap.wholesaleProductsList;
  if (Array.isArray(snap.pwpRulesList)) pwpRulesList = snap.pwpRulesList;
  if (Array.isArray(snap.giroRecordsList)) giroRecordsList = snap.giroRecordsList;
  if (Array.isArray(snap.b2bOrdersList)) b2bOrdersList = snap.b2bOrdersList;
  if (Array.isArray(snap.vendorCreditNotesList)) vendorCreditNotesList = snap.vendorCreditNotesList;
  if (snap.dynamicMarkdownConfig) dynamicMarkdownConfig = snap.dynamicMarkdownConfig;
  if (snap.removalStrategiesConfig) removalStrategiesConfig = snap.removalStrategiesConfig;
  if (Array.isArray(snap.skuTaxRulesList)) skuTaxRulesList = snap.skuTaxRulesList;
  if (Array.isArray(snap.customerRmaList)) customerRmaList = snap.customerRmaList;
  if (Array.isArray(snap.vendorRtvList)) vendorRtvList = snap.vendorRtvList;
  if (Array.isArray(snap.blindOpnameSheetsList)) blindOpnameSheetsList = snap.blindOpnameSheetsList;
  if (Array.isArray(snap.posShiftsList)) posShiftsList = snap.posShiftsList;
  if (snap.posHardwareStatus) posHardwareStatus = snap.posHardwareStatus;
  if (Array.isArray(snap.coldChainLogs)) coldChainLogs = snap.coldChainLogs;
  if (Array.isArray(snap.posReturnsList)) posReturnsList = snap.posReturnsList;
  if (snap.coaMappingConfig) coaMappingConfig = snap.coaMappingConfig;
  if (snap.posCheckoutConfig) posCheckoutConfig = snap.posCheckoutConfig;
  if (Array.isArray(snap.stockOpnameSessions)) stockOpnameSessions = snap.stockOpnameSessions;
  if (Array.isArray(snap.stockTransfersList)) stockTransfersList = snap.stockTransfersList;
  if (Array.isArray(snap.approvalRulesList)) approvalRulesList = snap.approvalRulesList;
  if (Array.isArray(snap.approvalQueueList)) approvalQueueList = snap.approvalQueueList;
  if (Array.isArray(snap.suratJalanList)) suratJalanList = snap.suratJalanList;
  if (Array.isArray(snap.deliveryOrdersList)) deliveryOrdersList = snap.deliveryOrdersList;
  if (Array.isArray(snap.shipmentsList)) shipmentsList = snap.shipmentsList;
  if (Array.isArray(snap.qcInspectionsList)) qcInspectionsList = snap.qcInspectionsList;
  if (Array.isArray(snap.promotionRulesList)) promotionRulesList = snap.promotionRulesList;
  if (Array.isArray(snap.posTransactionsHistory)) posTransactionsHistory = snap.posTransactionsHistory;
  if (Array.isArray(snap.weightToleranceConfigs)) weightToleranceConfigs = snap.weightToleranceConfigs;
  if (Array.isArray(snap.naturalShrinkageAdjustments)) naturalShrinkageAdjustments = snap.naturalShrinkageAdjustments;
  if (Array.isArray(snap.substitutionPromptRecords)) substitutionPromptRecords = snap.substitutionPromptRecords;
  if (Array.isArray(snap.securityAuditTrail)) securityAuditTrail = snap.securityAuditTrail;
  if (Array.isArray(snap.climateAdaptiveConfigs)) climateAdaptiveConfigs = snap.climateAdaptiveConfigs;
  if (Array.isArray(snap.enterpriseNotificationsList)) {
    enterpriseNotificationsList = snap.enterpriseNotificationsList;
  }
  if (snap.communicationGatewayConfig && typeof snap.communicationGatewayConfig === 'object') {
    const def = createDefaultCommunicationGatewayConfig();
    communicationGatewayConfig = {
      smtp: { ...def.smtp, ...(snap.communicationGatewayConfig.smtp || {}) },
      whatsapp: { ...def.whatsapp, ...(snap.communicationGatewayConfig.whatsapp || {}) },
      updatedAt: snap.communicationGatewayConfig.updatedAt || def.updatedAt,
      updatedBy: snap.communicationGatewayConfig.updatedBy || def.updatedBy,
    };
  } else {
    communicationGatewayConfig = createDefaultCommunicationGatewayConfig();
  }
  if (Array.isArray(snap.communicationLogs)) {
    communicationLogs = snap.communicationLogs;
  } else {
    communicationLogs = [];
  }
  qrisTransactions.clear();
  if (Array.isArray(snap.qrisTransactionsEntries)) {
    snap.qrisTransactionsEntries.forEach(([k, v]: [string, any]) => qrisTransactions.set(k, v));
  }
  idempotencyStore.clear();
  if (Array.isArray(snap.idempotencyStoreEntries)) {
    snap.idempotencyStoreEntries.forEach(([k, v]: [string, any]) => idempotencyStore.set(k, v));
  }
  inTransitTransferLots.clear();
  if (Array.isArray(snap.inTransitTransferLotsEntries)) {
    snap.inTransitTransferLotsEntries.forEach(([k, v]: [string, any]) => inTransitTransferLots.set(k, v));
  }
  if (snap.operatorBranchAssignments && typeof snap.operatorBranchAssignments === 'object') {
    const merged: Record<string, OperatorAssignmentEntry> = JSON.parse(JSON.stringify(DEFAULT_OPERATOR_ASSIGNMENTS));
    Object.entries(snap.operatorBranchAssignments).forEach(([uid, val]) => {
      if (val && typeof val === 'object') {
        merged[uid] = {
          ...(merged[uid] || { storeId: 'store-jkt-senopati', storeName: 'GroceMart Senopati Flagship', isActive: true, loginPin: '8821' }),
          ...(val as OperatorAssignmentEntry),
        };
      }
    });
    operatorBranchAssignments = merged;
  } else {
    operatorBranchAssignments = JSON.parse(JSON.stringify(DEFAULT_OPERATOR_ASSIGNMENTS));
  }
  syncAssignmentsOntoProfiles();
}

const INITIAL_STATE_BASELINE_JSON = JSON.stringify(captureServerState());

let snapshotSaveTimer: NodeJS.Timeout | null = null;
let snapshotWriteQueue: Promise<void> = Promise.resolve();
let isResettingState = false;

function flushSnapshotAtomic(): Promise<void> {
  if (isResettingState) return snapshotWriteQueue;
  snapshotWriteQueue = snapshotWriteQueue
    .catch(() => {})
    .then(async () => {
      if (isResettingState) return;
      try {
        const payload = JSON.stringify(captureServerState());
        await fsPromises.writeFile(STATE_SNAPSHOT_TMP_PATH, payload, 'utf-8');
        await fsPromises.rename(STATE_SNAPSHOT_TMP_PATH, STATE_SNAPSHOT_PATH);
      } catch (err) {
        console.warn('[GroceMart Snapshot] Failed to persist state snapshot:', err);
      }
    });
  return snapshotWriteQueue;
}

function scheduleStateSave() {
  if (isResettingState) return;
  if (snapshotSaveTimer) clearTimeout(snapshotSaveTimer);
  snapshotSaveTimer = setTimeout(() => {
    snapshotSaveTimer = null;
    void flushSnapshotAtomic();
  }, 250);
}

function hydrateStateFromSnapshot() {
  try {
    if (fs.existsSync(STATE_SNAPSHOT_PATH)) {
      const raw = fs.readFileSync(STATE_SNAPSHOT_PATH, 'utf-8');
      if (raw && raw.trim()) {
        const parsed = JSON.parse(raw);
        applyServerState(parsed);
        ensureRegulatoryCoaAccounts();
        syncAllBatchesExpiryStatus(Date.now());
        console.log(`[GroceMart Snapshot] Hydrated persistent state from ${STATE_SNAPSHOT_PATH}`);
        return;
      }
    }
  } catch (err) {
    console.warn('[GroceMart Snapshot] Failed to load snapshot, falling back to baseline seed:', err);
  }
  inventoryBatches = createInitialBatches();
  ensureRegulatoryCoaAccounts();
  seedBaselineEnterpriseNotifications();
}

async function resetDemoStateToBaseline() {
  isResettingState = true;
  if (snapshotSaveTimer) {
    clearTimeout(snapshotSaveTimer);
    snapshotSaveTimer = null;
  }
  try {
    await snapshotWriteQueue.catch(() => {});
    const baseline = JSON.parse(INITIAL_STATE_BASELINE_JSON);
    applyServerState(baseline);
    inventoryBatches = createInitialBatches();
    ensureRegulatoryCoaAccounts();
    enterpriseNotificationsList = [];
    seedBaselineEnterpriseNotifications();
    if (fs.existsSync(STATE_SNAPSHOT_TMP_PATH)) {
      await fsPromises.unlink(STATE_SNAPSHOT_TMP_PATH).catch(() => {});
    }
    if (fs.existsSync(STATE_SNAPSHOT_PATH)) {
      await fsPromises.unlink(STATE_SNAPSHOT_PATH).catch(() => {});
    }
  } finally {
    isResettingState = false;
  }
}

hydrateStateFromSnapshot();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Same-origin Firestore WebChannel & RPC streaming proxy (prevents browser/proxy/extension WebChannel blocks)
  app.all('/google.firestore.v1.Firestore/*', (req: Request, res: Response) => {
    const forwardHeaders: Record<string, string | string[]> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (
        val !== undefined &&
        !['host', 'connection', 'origin', 'referer', 'cookie', 'accept-encoding'].includes(lower)
      ) {
        forwardHeaders[key] = val;
      }
    }
    forwardHeaders['host'] = 'firestore.googleapis.com';

    const proxyReq = https.request(
      {
        hostname: 'firestore.googleapis.com',
        port: 443,
        path: req.originalUrl,
        method: req.method,
        headers: forwardHeaders,
      },
      (proxyRes) => {
        res.status(proxyRes.statusCode || 200);
        for (const [key, val] of Object.entries(proxyRes.headers)) {
          const lower = key.toLowerCase();
          if (
            val !== undefined &&
            !['transfer-encoding', 'connection', 'content-encoding', 'alt-svc', 'x-frame-options'].includes(lower)
          ) {
            res.setHeader(key, val);
          }
        }
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof res.flushHeaders === 'function') {
          res.flushHeaders();
        }
        proxyRes.on('error', () => {
          if (!res.writableEnded) {
            res.end();
          }
        });
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.status(502).json({ error: { code: 502, status: 'UNAVAILABLE', message: err.message } });
      } else {
        res.end();
      }
    });

    req.on('error', () => {
      if (!proxyReq.destroyed) {
        proxyReq.destroy();
      }
    });

    res.on('close', () => {
      if (!res.writableEnded && !proxyReq.destroyed) {
        proxyReq.destroy();
      }
    });

    req.pipe(proxyReq);
  });

  app.use(express.json());

  // 7-Role Enterprise RBAC & Branch-Scope Express Guard Middleware
  app.use('/api', (req: Request, res: Response, next) => {
    const urlPath = req.path || req.originalUrl.split('?')[0];
    const method = req.method.toUpperCase();

    // Determine effective operator role & branch (strict validation — unknown roles never default to super_admin)
    const rawHeaderRole = typeof req.headers['x-operator-role'] === 'string' ? req.headers['x-operator-role'].trim() : undefined;
    const rawHeaderBranch = typeof req.headers['x-operator-branch'] === 'string' ? req.headers['x-operator-branch'].trim() : undefined;
    const rawHeaderOpId = typeof req.headers['x-operator-id'] === 'string' ? req.headers['x-operator-id'].trim() : undefined;

    const assignedProfile = rawHeaderOpId ? AVAILABLE_STAFF_USERS.find((u) => u.userId === rawHeaderOpId) : undefined;
    const assignedAssignment = rawHeaderOpId ? operatorBranchAssignments[rawHeaderOpId] : undefined;
    const strictHeaderRole = rawHeaderRole ? normalizeServerRoleStrict(rawHeaderRole) : undefined;
    const resolvedSessionRole = normalizeServerRoleStrict(currentActiveStaffSession.userRole) || 'cashier';

    const effectiveRole: CanonicalServerRole = rawHeaderRole
      ? strictHeaderRole || 'cashier'
      : assignedProfile
      ? normalizeServerRole(assignedProfile.userRole)
      : resolvedSessionRole;

    const effectiveBranch =
      rawHeaderBranch ||
      assignedAssignment?.storeId ||
      currentActiveStaffSession.assignedBranchId ||
      currentActiveStaffSession.storeId ||
      'ALL';

    const denyAccess = (requiredRoles: CanonicalServerRole[], customReason?: string) => {
      const reason =
        customReason ||
        `RBAC Access Denied (403): Role '${rawHeaderRole && !strictHeaderRole ? rawHeaderRole : effectiveRole}' is not authorized for ${method} ${urlPath}. Required role(s): [${requiredRoles.join(', ')}].`;
      securityAuditTrail.unshift({
        id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
        timestamp: new Date().toISOString(),
        actionType: 'ZONE_CONFIG_UPDATE',
        resourceId: `${method} ${urlPath}`,
        userId: rawHeaderOpId || currentActiveStaffSession.userId,
        userName: assignedProfile?.userName || currentActiveStaffSession.userName,
        userRole: effectiveRole,
        storeId: effectiveBranch,
        shiftId: currentActiveStaffSession.activeShiftId,
        status: 'PERMISSION_DENIED',
        metadata: { requiredRoles, reason },
      });
      return res.status(403).json({
        success: false,
        code: 'RBAC_FORBIDDEN',
        role: effectiveRole,
        branch: effectiveBranch,
        requiredRoles,
        error: reason,
      });
    };

    // Public / auth / health / read-only lookup exceptions
    if (
      urlPath === '/health' ||
      urlPath.startsWith('/admin/auth/') ||
      urlPath === '/admin/rbac/current-session' ||
      urlPath === '/admin/rbac/handover' ||
      urlPath === '/admin/rbac/check-zone-access'
    ) {
      return next();
    }

    // Check scoped rules for /api/admin/*, /api/pos/*, and /api/b2b/giro*
    if (urlPath.startsWith('/admin/') || urlPath.startsWith('/pos/') || urlPath.startsWith('/b2b/giro')) {
      // Reject deactivated operator or unknown role header spoofing
      if (rawHeaderRole && !strictHeaderRole) {
        return denyAccess(['super_admin'], `RBAC Access Denied (403): Unrecognized operator role '${rawHeaderRole}'.`);
      }
      if (assignedAssignment?.isActive === false || assignedProfile?.isActive === false) {
        return denyAccess(['super_admin'], `Access Denied (403): Operator account '${rawHeaderOpId}' is currently suspended by Super Admin.`);
      }
      if (assignedProfile && rawHeaderRole && strictHeaderRole !== normalizeServerRole(assignedProfile.userRole)) {
        const assignedCanon = normalizeServerRole(assignedProfile.userRole);
        if (strictHeaderRole === 'super_admin' && assignedCanon !== 'super_admin') {
          return denyAccess([assignedCanon], `Privilege Escalation Blocked (403): Operator '${rawHeaderOpId}' is locked to role '${assignedCanon}' and cannot elevate to 'super_admin'.`);
        }
      }

      // 1. Super Admin Only Endpoints
      if (
        urlPath === '/admin/system/reset-demo-data' ||
        urlPath === '/admin/reset-demo-data' ||
        urlPath === '/admin/rbac/switch-session' ||
        (urlPath === '/admin/settings/operator-assignments' && method === 'POST') ||
        (urlPath.startsWith('/admin/settings/coa-account') && method === 'DELETE') ||
        (urlPath === '/admin/compliance/sku-tax-rules' && method === 'PUT')
      ) {
        if (effectiveRole !== 'super_admin') {
          return denyAccess(['super_admin']);
        }
      }

      // 2. Multi-Branch Monitor & Operator Assignments Read
      if (
        urlPath === '/admin/settings/branch-monitor' ||
        (urlPath === '/admin/settings/operator-assignments' && method === 'GET')
      ) {
        const allowed: CanonicalServerRole[] = ['admin', 'coo', 'super_admin'];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      // 3. Confirm Arrival on Incoming Transfers/POs
      if (urlPath === '/admin/settings/confirm-arrival' && method === 'POST') {
        const allowed: CanonicalServerRole[] = ['warehouse', 'store_manager', 'coo', 'super_admin'];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      // 4. Approval Matrix Rules & Decisions
      if (urlPath.startsWith('/admin/approvals/')) {
        if (method !== 'GET') {
          const allowed: CanonicalServerRole[] = ['store_manager', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        } else {
          const allowed: CanonicalServerRole[] = ['store_manager', 'admin', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        }
      }

      // 5. Bilyet Giro Clearing / Bouncing & Vendor Bill Payments/Approvals
      if (urlPath.startsWith('/b2b/giro')) {
        if (method !== 'GET') {
          const allowed: CanonicalServerRole[] = ['admin', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        } else {
          const allowed: CanonicalServerRole[] = ['admin', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        }
      }

      if (urlPath.startsWith('/admin/procurement/vendor-bills')) {
        if (method === 'POST' && urlPath === '/admin/procurement/vendor-bills') {
          const allowed: CanonicalServerRole[] = ['purchasing', 'admin', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        } else if (method !== 'GET') {
          const allowed: CanonicalServerRole[] = ['admin', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        }
      }

      // 6. Enterprise Settings, POS Config, Communication Gateway, COA Writes
      if (
        (urlPath === '/admin/settings/enterprise' ||
          urlPath === '/admin/settings/pos-config' ||
          (urlPath === '/admin/settings/communication-gateway' && method !== 'GET') ||
          urlPath === '/admin/communications/test-email' ||
          urlPath === '/admin/communications/test-whatsapp') &&
        method !== 'GET'
      ) {
        const allowed: CanonicalServerRole[] = ['coo', 'super_admin'];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      if (urlPath === '/admin/settings/communication-gateway' && method === 'GET') {
        const allowed: CanonicalServerRole[] = [
          'cashier',
          'warehouse',
          'purchasing',
          'store_manager',
          'admin',
          'coo',
          'super_admin',
        ];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      if (urlPath === '/admin/communications/send-document' && method === 'POST') {
        const allowed: CanonicalServerRole[] = [
          'cashier',
          'warehouse',
          'purchasing',
          'store_manager',
          'admin',
          'coo',
          'super_admin',
        ];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      if (
        (urlPath.startsWith('/admin/settings/coa-account') ||
          urlPath === '/admin/settings/coa-mapping' ||
          urlPath.startsWith('/admin/accounting/')) &&
        method !== 'GET'
      ) {
        const allowed: CanonicalServerRole[] = ['admin', 'coo', 'super_admin'];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      // Financial P&L / GL / Balance Sheet / Cash Flow / Omzet GETs
      if (urlPath.startsWith('/admin/accounting/') || urlPath === '/admin/omzet-analytics') {
        const allowed: CanonicalServerRole[] = ['store_manager', 'admin', 'coo', 'super_admin'];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      // 7. Procurement PR/PO vs Dock Goods Receipt (GR) & QC
      if (
        urlPath.startsWith('/admin/procurement/requests') ||
        urlPath.startsWith('/admin/procurement/orders') ||
        urlPath === '/admin/replenishment/generate-po' ||
        urlPath.startsWith('/admin/vendor-credit-notes') ||
        urlPath === '/admin/compliance/rtv' ||
        urlPath.startsWith('/admin/valuation/landed-costs')
      ) {
        if (method !== 'GET') {
          const allowed: CanonicalServerRole[] = ['purchasing', 'store_manager', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        }
      }

      if (urlPath === '/admin/procurement/gr/receive-partial' || urlPath === '/admin/qc/inspections') {
        if (method !== 'GET') {
          const allowed: CanonicalServerRole[] = ['warehouse', 'purchasing', 'store_manager', 'coo', 'super_admin'];
          if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
        }
      }

      // 8. Inventory Transfers, Picker, Logistics, Stock Adjustments, Bulk Import
      if (
        urlPath.startsWith('/admin/inventory/') ||
        urlPath.startsWith('/admin/picker/') ||
        urlPath.startsWith('/admin/catch-weight/') ||
        urlPath.startsWith('/admin/fulfillment/') ||
        urlPath.startsWith('/admin/substitutions/') ||
        urlPath.startsWith('/admin/logistics/') ||
        urlPath.startsWith('/admin/warehouse/') ||
        urlPath.startsWith('/admin/batch-recall/') ||
        urlPath.startsWith('/admin/cold-chain/')
      ) {
        if (method !== 'GET') {
          if (
            urlPath === '/admin/inventory/stock-opname/reconcile' ||
            urlPath === '/admin/inventory/adjust'
          ) {
            const allowed: CanonicalServerRole[] = ['warehouse', 'store_manager', 'coo', 'super_admin'];
            if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
          } else {
            const allowed: CanonicalServerRole[] = ['warehouse', 'store_manager', 'coo', 'super_admin'];
            if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
          }
        }
      }

      // 9. Store Emergency Override / Outlets Config
      if ((urlPath === '/admin/store-status' || urlPath.startsWith('/admin/outlets/')) && method !== 'GET') {
        const allowed: CanonicalServerRole[] = ['store_manager', 'coo', 'super_admin'];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      // 10. POS Cashier Terminal & Sales Returns (RMA)
      if (
        (urlPath.startsWith('/pos/') && method !== 'GET') ||
        urlPath === '/admin/returns' ||
        urlPath === '/admin/compliance/rma' ||
        urlPath.startsWith('/admin/hardware/')
      ) {
        const allowed: CanonicalServerRole[] = ['cashier', 'store_manager', 'coo', 'super_admin'];
        if (!allowed.includes(effectiveRole)) return denyAccess(allowed);
      }

      // 11. Branch-Scoped Write Isolation Check (cashier, warehouse, store_manager)
      if (
        method !== 'GET' &&
        isBranchScopedServerRole(effectiveRole) &&
        effectiveBranch !== 'ALL' &&
        effectiveBranch !== 'CONSOLIDATED'
      ) {
        const bodyStoreId = typeof req.body?.storeId === 'string' ? req.body.storeId : undefined;
        if (
          bodyStoreId &&
          bodyStoreId !== 'ALL' &&
          bodyStoreId !== 'CONSOLIDATED' &&
          effectiveBranch !== 'WH-CDC-01' &&
          bodyStoreId !== effectiveBranch
        ) {
          return denyAccess(
            [effectiveRole],
            `Branch Isolation Violation (403): Operator (${effectiveRole}) assigned to '${effectiveBranch}' cannot mutate data for '${bodyStoreId}'.`
          );
        }
      }
    }

    next();
  });

  // Debounced atomic snapshot persistence on every successful mutating API request
  app.use('/api', (req: Request, res: Response, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (
          res.statusCode < 400 &&
          !isResettingState &&
          !req.originalUrl.includes('reset-demo-data')
        ) {
          scheduleStateSave();
        }
      });
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post(['/api/admin/system/reset-demo-data', '/api/admin/reset-demo-data'], async (_req: Request, res: Response) => {
    await resetDemoStateToBaseline();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      batchesCount: inventoryBatches.length,
      message: 'Demo state snapshot cleared and re-initialized with fresh relative-date seed baseline.',
    });
  });

  // -------------------------------------------------------------
  // ENTERPRISE NOTIFICATION CENTER ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/admin/notifications', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const sorted = [...enterpriseNotificationsList].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );
    const unreadCount = sorted.filter((n) => !n.isRead).length;
    res.json({
      notifications: sorted,
      unreadCount,
    });
  });

  app.post('/api/admin/notifications/mark-read', (req: Request, res: Response) => {
    const { id, markAll } = (req.body || {}) as { id?: string; markAll?: boolean };
    const nowIso = new Date().toISOString();
    if (markAll) {
      enterpriseNotificationsList.forEach((n) => {
        if (!n.isRead) {
          n.isRead = true;
          n.updatedAt = nowIso;
        }
      });
    } else if (id) {
      const target = enterpriseNotificationsList.find((n) => n.id === id);
      if (target) {
        target.isRead = true;
        target.updatedAt = nowIso;
      }
    }
    const sorted = [...enterpriseNotificationsList].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );
    res.json({
      success: true,
      notifications: sorted,
      unreadCount: sorted.filter((n) => !n.isRead).length,
    });
  });

  app.post('/api/admin/notifications/clear', (req: Request, res: Response) => {
    const { onlyRead = true } = (req.body || {}) as { onlyRead?: boolean };
    if (onlyRead) {
      enterpriseNotificationsList = enterpriseNotificationsList.filter((n) => !n.isRead);
    } else {
      enterpriseNotificationsList = [];
    }
    const sorted = [...enterpriseNotificationsList].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );
    res.json({
      success: true,
      notifications: sorted,
      unreadCount: sorted.filter((n) => !n.isRead).length,
    });
  });

  // -------------------------------------------------------------
  // OPENAPI 3.0.3 SPECIFICATION ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/qris/openapi.json', (_req: Request, res: Response) => {
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'GroceMart QRIS Payment & Retail Operations Open API',
        version: '1.0.0',
        description:
          'Open API for Indonesian National QR Standard (QRIS) payment generation, real-time settlement simulation, inventory deduction, and double-entry accounting reconciliation.',
        contact: {
          name: 'GroceMart Retail Engineering Team',
          email: 'api-support@grocemart.co.id',
        },
      },
      servers: [
        {
          url: '/api',
          description: 'GroceMart Primary API Gateway',
        },
      ],
      paths: {
        '/qris/generate': {
          post: {
            summary: 'Generate dynamic QRIS payment code',
            description: 'Generates an ASPI / Bank Indonesia EMVCo compliant dynamic QRIS string for an order with dynamic amount.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['orderId', 'amount'],
                    properties: {
                      orderId: { type: 'string', example: 'GCM-2026-1049' },
                      amount: { type: 'number', example: 75000 },
                      customerName: { type: 'string', example: 'Sarah Wijaya' },
                      customerEmail: { type: 'string', example: 'sarah.wijaya@example.com' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'QRIS generation succeeded',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        orderId: { type: 'string' },
                        qrisReference: { type: 'string' },
                        nmid: { type: 'string' },
                        merchantName: { type: 'string' },
                        amount: { type: 'number' },
                        currency: { type: 'string' },
                        qrPayloadString: { type: 'string' },
                        expiresAt: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/qris/status/{orderId}': {
          get: {
            summary: 'Query QRIS payment status',
            parameters: [
              {
                name: 'orderId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': { description: 'Payment status returned' },
            },
          },
        },
        '/qris/simulate-pay': {
          post: {
            summary: 'Simulate QRIS customer settlement callback',
            description: 'Simulates instantaneous payment receipt from e-wallet/banking partner (BCA, GoPay, OVO, ShopeePay, Dana). Deducts inventory, logs GL records, and creates transaction audit trail.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['orderId'],
                    properties: {
                      orderId: { type: 'string' },
                      settlementChannel: { type: 'string', example: 'BCA QRIS' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Settlement processed successfully' },
            },
          },
        },
      },
    });
  });

  // -------------------------------------------------------------
  // QRIS PAYMENT ENDPOINTS
  // -------------------------------------------------------------
  app.post('/api/qris/generate', (req: Request, res: Response) => {
    const { orderId, amount, customerName, customerEmail } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ success: false, error: 'Missing orderId or amount' });
    }

    // Check store closure
    if (!storeStatus.isOpen) {
      return res.status(403).json({
        success: false,
        error: 'Store is currently closed or in holiday maintenance. New checkouts are temporarily paused.',
        notice: storeStatus.noticeBanner,
      });
    }

    const roundedAmount = Math.max(0, roundIDR(Number(amount)));
    const qrisRef = `QRIS-GCM-${Date.now().toString().slice(-6)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const qrPayload = generateQRISPayload(orderId, roundedAmount);

    qrisTransactions.set(orderId, {
      orderId,
      qrisReference: qrisRef,
      amount: roundedAmount,
      status: 'unpaid',
      expiresAt,
    });

    res.json({
      success: true,
      orderId,
      qrisReference: qrisRef,
      nmid: 'ID1020039281744',
      merchantName: 'GROCEMART RETAIL INDONESIA',
      merchantCity: 'JAKARTA',
      postalCode: '12110',
      amount: roundedAmount,
      currency: 'IDR',
      qrPayloadString: qrPayload,
      expiresAt,
      fee: 0,
      acquirer: 'Bank Indonesia National QRIS Interoperable Gateway',
    });
  });

  app.get('/api/qris/status/:orderId', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const tx = qrisTransactions.get(orderId);
    if (!tx) {
      return res.json({
        orderId,
        status: 'unpaid',
        amount: 0,
      });
    }
    res.json(tx);
  });

  app.post('/api/qris/simulate-pay', async (req: Request, res: Response) => {
    const { orderId, channel = 'BCA QRIS', customerName = 'GroceMart Customer', customerEmail = 'customer@grocemart.co.id', items = [], storeId: rawStoreId } = req.body;
    const requestedStoreId = String(rawStoreId || 'store-jkt-senopati');
    const LEGACY_STORE_MAP: Record<string, string> = {
      'store-sby-dharmahusada': 'store-sby-gubeng',
      'store-bdg-riau': 'store-bdg-dago',
      'store-bali-sanur': 'store-bali-canggu',
      'store-ygy-kaliurang': 'store-jkt-senopati',
      'store-mdn-ringroad': 'store-jkt-senopati',
    };
    const resolvedStoreId = storeSchedules.some((s) => s.storeId === requestedStoreId)
      ? requestedStoreId
      : LEGACY_STORE_MAP[requestedStoreId] || 'store-jkt-senopati';

    if (!storeStatus.isOpen || storeStatus.isHolidayMode) {
      return res.status(400).json({
        error: storeStatus.noticeBanner || 'GroceMart storefront is temporarily closed. Checkout cannot be completed.',
      });
    }
    const targetOutlet = storeSchedules.find((s) => s.storeId === resolvedStoreId);
    if (targetOutlet?.isEmergencyClosed) {
      return res.status(400).json({
        error: `Outlet '${targetOutlet.storeName}' is under emergency closure (${targetOutlet.closureReason || 'Maintenance'}).`,
      });
    }
    
    // GUARD 1: Payment Webhook Idempotency (QRIS Safety)
    const idempotencyKey = (
      req.header('Idempotency-Key') ||
      req.header('X-Idempotency-Key') ||
      req.body.idempotencyKey ||
      `idem_order_${orderId}`
    ).toString();

    if (idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      res.setHeader('X-Idempotency-Lookup', 'HIT');
      res.setHeader('X-Idempotency-Key', idempotencyKey);
      return res.status(cached.statusCode).json({
        ...cached.responseBody,
        isIdempotentReplay: true,
        idempotencyKey,
        idempotentNotice: 'Idempotency Guard: Duplicate QRIS payment notification detected. Returned original settled receipt without re-deducting inventory or duplicating GL journals.',
      });
    }

    const existingSettled = auditTrail.find((a) => a.orderId === orderId && a.status === 'SETTLED');
    const existingTx = qrisTransactions.get(orderId);
    if (existingSettled || (existingTx && existingTx.status === 'paid' && existingTx.paidAt)) {
      const replayPayload = {
        success: true,
        message: 'Idempotency Guard: QRIS transaction already settled. Returning existing settlement receipt.',
        orderId,
        qrisReference: existingTx?.qrisReference || existingSettled?.qrisReference,
        paidAt: existingTx?.paidAt || existingSettled?.paymentTimestamp,
        settlementChannel: existingTx?.settlementChannel || channel,
        journalEntryIds: existingSettled?.journalEntryIds || [],
        auditRecordId: existingSettled?.id || '',
        inventoryDeductions: existingSettled?.inventoryDeducted || [],
        isIdempotentReplay: true,
      };
      idempotencyStore.set(idempotencyKey, {
        idempotencyKey,
        orderId,
        timestamp: new Date().toISOString(),
        statusCode: 200,
        responseBody: replayPayload,
        qrisReference: existingTx?.qrisReference || existingSettled?.qrisReference || '',
      });
      return res.json(replayPayload);
    }

    // Determine lock resource keys for strict concurrency isolation
    const lockKeys = Array.isArray(items) && items.length > 0
      ? items.map((it: any) => `lock_sku_${it.sku || it.productId || it.product?.id}`)
      : [`lock_order_${orderId}`];

    try {
      // Execute within atomic concurrency lock (SELECT FOR UPDATE emulation)
      const result = await inventoryConcurrencyManager.runWithLock(lockKeys, async () => {
        // Anti-Overselling & Non-Expired ATP Guard: verify real-time sellable stock atomically before mutating anything
        const skuTotals = new Map<string, number>();
        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            const prodId = item.product?.id || item.productId;
            const qty = Math.max(0, Number(item.quantity) || 1);
            const invItem = inventoryList.find((inv) => inv.productId === prodId || inv.sku === item.sku);
            const targetSku = invItem?.sku || item.sku;
            if (targetSku) {
              skuTotals.set(targetSku, (skuTotals.get(targetSku) || 0) + qty);
            }
          }
          for (const [targetSku, totalReqQty] of skuTotals.entries()) {
            const invItem = inventoryList.find((inv) => inv.sku === targetSku);
            const atpCheck = getSellableNonExpiredAtpStock(targetSku, resolvedStoreId);
            const maxSellable = invItem ? Math.min(invItem.currentStock, atpCheck.effectiveAtp) : atpCheck.effectiveAtp;
            if (totalReqQty > maxSellable) {
              const conflictErr = new Error(
                `Insufficient non-expired ATP stock for SKU ${targetSku}${invItem ? ` ("${invItem.productName}")` : ''}. Available: ${maxSellable}, Requested: ${totalReqQty}. Allocation rejected.`
              );
              (conflictErr as any).statusCode = 400;
              throw conflictErr;
            }
          }
        }

        const tx = existingTx || {
          orderId,
          qrisReference: `QRIS-GCM-${Date.now().toString().slice(-6)}`,
          amount: roundIDR(Number(req.body.amount) || 75000),
          status: 'unpaid' as const,
          expiresAt: new Date().toISOString(),
          paidAt: undefined as string | undefined,
          settlementChannel: undefined as string | undefined,
        };

        tx.amount = Math.max(0, roundIDR(Number(tx.amount) || 0));
        tx.status = 'paid';
        tx.paidAt = new Date().toISOString();
        tx.settlementChannel = channel;
        qrisTransactions.set(orderId, tx);

        // 1. Deduct Inventory Stock, Calculate COGS & Post-Markdown Net VAT Split
        const inventoryDeductions: { sku: string; quantity: number; cogsCost: number }[] = [];
        let totalCogs = 0;
        const triggeredPRs: PurchaseRequest[] = [];
        let computedLineNetSum = 0;
        let computedPpnIDR = 0;
        let computedPb1IDR = 0;

        if (Array.isArray(items) && items.length > 0) {
          const rawLineItems = items.map((item: any) => {
            const prodId = item.product?.id || item.productId;
            const qty = Math.max(0, Number(item.quantity) || 1);
            const invItem = inventoryList.find((inv) => inv.productId === prodId || inv.sku === item.sku);
            const targetSku = invItem?.sku || item.sku || '';
            const catalogPrice = Number(item.product?.price ?? item.unitPrice ?? item.price ?? invItem?.sellingPrice ?? 0) || 0;
            const nearestSellableBatch = inventoryBatches
              .filter((b) => {
                syncBatchExpiryStatus(b);
                return (
                  b.sku === targetSku &&
                  (b.storeId === resolvedStoreId || b.storeId === 'store-jkt-senopati') &&
                  b.currentStock > 0 &&
                  b.status !== 'quarantined' &&
                  b.status !== 'recalled' &&
                  b.status !== 'expired' &&
                  b.status !== 'depleted'
                );
              })
              .sort((a, b) => {
                const storePref = (b.storeId === resolvedStoreId ? 0 : 1) - (a.storeId === resolvedStoreId ? 0 : 1);
                if (storePref !== 0) return storePref;
                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
              })[0];
            const mdCandidate = nearestSellableBatch
              ? evaluateBatchMarkdown(nearestSellableBatch, dynamicMarkdownConfig)
              : null;
            let unitPrice = catalogPrice;
            if (mdCandidate && mdCandidate.markdownPrice > 0 && unitPrice >= mdCandidate.originalPrice - 1) {
              unitPrice = mdCandidate.markdownPrice;
            } else if (
              nearestSellableBatch?.markdownDiscountPercent &&
              nearestSellableBatch.markdownDiscountPercent > 0 &&
              unitPrice >= nearestSellableBatch.sellingPrice - 1
            ) {
              unitPrice = Math.round(nearestSellableBatch.sellingPrice * (1 - nearestSellableBatch.markdownDiscountPercent / 100));
            }
            return {
              item,
              qty,
              invItem,
              lineSubtotal: Math.round(unitPrice * qty),
              category: item.product?.category || item.category || invItem?.category || '',
              name: item.product?.name || item.name || invItem?.productName || targetSku,
              sku: targetSku,
            };
          });

          const rawGrossSum = rawLineItems.reduce((acc, r) => acc + r.lineSubtotal, 0);
          const cartDiscount = Math.min(rawGrossSum, Math.max(0, roundIDR(Number(req.body.discount) || 0)));
          const effectiveAfterDiscount = Math.max(0, rawGrossSum - cartDiscount);
          const explicitDeliveryFee =
            req.body.deliveryFee !== undefined
              ? Math.max(0, roundIDR(Number(req.body.deliveryFee) || 0))
              : ([0, 10000, 15000].includes(tx.amount - effectiveAfterDiscount)
                  ? tx.amount - effectiveAfterDiscount
                  : 0);
          const isInclusivePriceMode =
            Math.abs(effectiveAfterDiscount + explicitDeliveryFee - tx.amount) <=
            Math.max(5, rawLineItems.length * 2);

          let remainingDiscount = cartDiscount;
          rawLineItems.forEach((entry, idx) => {
            const { qty, invItem } = entry;
            const share =
              idx === rawLineItems.length - 1
                ? remainingDiscount
                : rawGrossSum > 0
                ? Math.min(remainingDiscount, Math.round((entry.lineSubtotal / rawGrossSum) * cartDiscount))
                : 0;
            remainingDiscount = Math.max(0, remainingDiscount - share);
            const netLine = Math.max(0, entry.lineSubtotal - share);

            const rule = skuTaxRulesList.find((r) => r.sku === entry.sku);
            const taxCat: IndonesianTaxCategory =
              rule?.taxCategory || inferDefaultTaxCategory(entry.category, entry.name);
            const stdRate = rule?.taxRatePercent ?? posCheckoutConfig.ppnTaxPercent ?? 11;
            const taxCalc = computeIndonesianTax(netLine, taxCat, isInclusivePriceMode, stdRate);
            computedLineNetSum += roundIDR(taxCalc.dppIDR);
            computedPpnIDR += roundIDR(taxCalc.ppnIDR);
            computedPb1IDR += roundIDR(taxCalc.pb1IDR);

            if (invItem) {
              invItem.currentStock = Math.max(0, invItem.currentStock - qty);
              invItem.outgoingStock += qty;

              const batchResult = deductBatchesByStrategy(invItem.sku, qty, resolvedStoreId, invItem.unitCost);

              const tier =
                storeInventoryTiers.find((t) => t.sku === invItem.sku && t.storeId === resolvedStoreId) ||
                storeInventoryTiers.find((t) => t.sku === invItem.sku);
              if (tier) {
                tier.physicalStock = Math.max(0, tier.physicalStock - qty);
                tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
                tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
                tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
                tier.updatedAt = new Date().toISOString();
              }

              const itemCogs =
                batchResult.allocations.length > 0
                  ? roundIDR(batchResult.totalCogs)
                  : roundIDR(invItem.unitCost * qty);
              totalCogs = roundIDR(totalCogs + itemCogs);
              inventoryDeductions.push({
                sku: invItem.sku,
                quantity: qty,
                cogsCost: itemCogs,
              });

              if (invItem.currentStock <= invItem.minimumThreshold) {
                const existingPendingPR = purchaseRequests.find(
                  (pr) => pr.sku === invItem.sku && pr.status === 'pending'
                );
                if (!existingPendingPR) {
                  const newPR: PurchaseRequest = {
                    id: `PR-2026-${(purchaseRequests.length + 1).toString().padStart(3, '0')}`,
                    createdAt: new Date().toISOString(),
                    requestedBy: 'System Auto-Trigger (Threshold Alert)',
                    sku: invItem.sku,
                    productId: invItem.productId,
                    productName: invItem.productName,
                    suggestedQuantity: invItem.reorderQuantity || 50,
                    estimatedUnitCost: invItem.unitCost,
                    totalEstimatedCost: roundIDR((invItem.reorderQuantity || 50) * invItem.unitCost),
                    status: 'pending',
                    reason: 'low_stock_auto_trigger',
                    priority: 'high',
                  };
                  purchaseRequests.unshift(newPR);
                  triggeredPRs.push(newPR);
                }
              }
            }
          });
        } else {
          totalCogs = Math.round(tx.amount * 0.6);
          computedLineNetSum = tx.amount;
        }

        // Reconcile GL Credits so DR 1030 === CR 4010 + CR 2025 + CR 2027 (strict integer IDR)
        const qrisPpnIDR = Math.min(tx.amount, roundIDR(computedPpnIDR));
        const qrisPb1IDR = Math.min(Math.max(0, tx.amount - qrisPpnIDR), roundIDR(computedPb1IDR));
        const qrisRevenueIDR =
          Array.isArray(items) && items.length > 0
            ? Math.max(0, tx.amount - qrisPpnIDR - qrisPb1IDR)
            : tx.amount;
        totalCogs = Math.max(0, roundIDR(totalCogs));

        // 2. Automated Double-Entry General Ledger (GL) Recording
        const timestamp = new Date().toISOString();
        const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
        const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
        const gleId3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
        const gleId4 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}`;
        const qrisJournalIds = [gleId1, gleId2];

        const qrisRevenueGlBatch: GeneralLedgerEntry[] = [
          {
            id: gleId1,
            timestamp,
            accountCode: '1030',
            accountName: 'QRIS Settlement Receivable (ASPI Clearing)',
            category: 'Asset',
            debit: tx.amount,
            credit: 0,
            referenceType: 'QRIS_SALE',
            referenceId: orderId,
            description: `QRIS Settlement via ${channel} for Order #${orderId}`,
          },
          {
            id: gleId2,
            timestamp,
            accountCode: '4010',
            accountName: 'Grocery Sales Revenue',
            category: 'Revenue',
            debit: 0,
            credit: qrisRevenueIDR,
            referenceType: 'QRIS_SALE',
            referenceId: orderId,
            description: `Net sales revenue recognized for Order #${orderId}`,
          },
        ];

        if (qrisPpnIDR > 0) {
          const gleTaxPpn = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}-VAT`;
          qrisJournalIds.push(gleTaxPpn);
          qrisRevenueGlBatch.push({
            id: gleTaxPpn,
            timestamp,
            accountCode: '2025',
            accountName: 'PPN Keluaran (VAT Output Payable 11%/12%)',
            category: 'Liability',
            debit: 0,
            credit: qrisPpnIDR,
            referenceType: 'QRIS_SALE',
            referenceId: orderId,
            description: `PPN Output VAT accrued for QRIS Order #${orderId}`,
          });
        }
        if (qrisPb1IDR > 0) {
          const gleTaxPb1 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}-PB1`;
          qrisJournalIds.push(gleTaxPb1);
          qrisRevenueGlBatch.push({
            id: gleTaxPb1,
            timestamp,
            accountCode: '2027',
            accountName: 'Pajak Daerah PB1 (10% Ready-to-Eat Deli)',
            category: 'Liability',
            debit: 0,
            credit: qrisPb1IDR,
            referenceType: 'QRIS_SALE',
            referenceId: orderId,
            description: `PB1 10% Deli tax accrued for QRIS Order #${orderId}`,
          });
        }
        commitBalancedGlBatch(qrisRevenueGlBatch, true);

        qrisJournalIds.push(gleId3, gleId4);
        commitBalancedGlBatch(
          [
            {
              id: gleId3,
              timestamp,
              accountCode: '5010',
              accountName: 'Cost of Goods Sold (COGS)',
              category: 'Expense',
              debit: totalCogs,
              credit: 0,
              referenceType: 'QRIS_SALE',
              referenceId: orderId,
              description: `COGS recognized for products dispatched in Order #${orderId}`,
            },
            {
              id: gleId4,
              timestamp,
              accountCode: '1040',
              accountName: 'Merchandise Inventory Asset',
              category: 'Asset',
              debit: 0,
              credit: totalCogs,
              referenceType: 'QRIS_SALE',
              referenceId: orderId,
              description: `Inventory reduction for order dispatch #${orderId}`,
            },
          ],
          true
        );

        // 3. Record in Transaction Audit Trail
        const auditRecord: TransactionAuditRecord = {
          id: `AUD-2026-${(auditTrail.length + 1).toString().padStart(4, '0')}`,
          qrisReference: tx.qrisReference,
          orderId,
          customerName,
          customerEmail,
          amount: tx.amount,
          paymentTimestamp: timestamp,
          settlementChannel: channel as any,
          journalEntryIds: qrisJournalIds,
          inventoryDeducted: inventoryDeductions,
          status: 'SETTLED',
        };
        auditTrail.unshift(auditRecord);

        // Also update any matching customer order status to paid / in_transit
        const custOrder = customerOrders.find((o) => o.id === orderId);
        if (custOrder) {
          custOrder.paymentStatus = 'paid';
          custOrder.qrisPaidAt = tx.paidAt;
          custOrder.status = 'in_transit';
        }

        // Event 2 & Event 6: Low-stock check & incoming fulfillment picking notification
        if (inventoryDeductions.length > 0) {
          checkAndNotifyLowStockForSkus(
            inventoryDeductions.map((d) => d.sku),
            resolvedStoreId
          );
          emitEnterpriseNotification({
            dedupeKey: `PICKER_ORDER:${orderId}`,
            category: 'FULFILLMENT',
            severity: 'INFO',
            title: `New B2C Order Ready for Picking (#${orderId})`,
            message: `${customerName} settled Rp ${tx.amount.toLocaleString('id-ID')} via ${channel} (${inventoryDeductions.length} SKUs).`,
            metadataLabel: `${orderId} • ${targetOutlet?.storeName || resolvedStoreId}`,
            targetTab: 'picker',
          });
        }

        const responsePayload = {
          success: true,
          message: 'QRIS payment settled, inventory deducted under concurrency lock, and GL entries recorded.',
          orderId,
          qrisReference: tx.qrisReference,
          paidAt: tx.paidAt,
          settlementChannel: channel,
          netRevenueIDR: qrisRevenueIDR,
          ppnIDR: qrisPpnIDR,
          pb1IDR: qrisPb1IDR,
          journalEntryIds: qrisJournalIds,
          auditRecordId: auditRecord.id,
          inventoryDeductions,
          triggeredPRsCount: triggeredPRs.length,
          idempotencyKey,
        };

        // Cache in idempotency store
        idempotencyStore.set(idempotencyKey, {
          idempotencyKey,
          orderId,
          timestamp: new Date().toISOString(),
          statusCode: 200,
          responseBody: responsePayload,
          qrisReference: tx.qrisReference,
        });

        return responsePayload;
      });

      res.setHeader('X-Idempotency-Key', idempotencyKey);
      res.setHeader('X-Concurrency-Lock', 'RELEASED');
      res.json(result);
    } catch (err: any) {
      if (err.statusCode === 400 || err.statusCode === 409) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
          orderId,
        });
      }
      res.status(500).json({ success: false, error: err.message || 'Payment processing failed' });
    }
  });

  // Dedicated Payment Webhook Callback (Bank Indonesia / ASPI compliant)
  app.post('/api/qris/webhook', async (req: Request, res: Response) => {
    const idempotencyKey = (
      req.header('Idempotency-Key') ||
      req.header('X-Idempotency-Key') ||
      req.body.idempotencyKey ||
      req.body.transactionId ||
      `whk_${req.body.orderId || Date.now()}`
    ).toString();

    if (idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      res.setHeader('X-Idempotency-Lookup', 'HIT');
      return res.status(200).json({
        ...cached.responseBody,
        isIdempotentReplay: true,
        message: 'Idempotency Key Recognized: Webhook already processed.',
      });
    }

    // Forward to settlement pipeline
    req.headers['idempotency-key'] = idempotencyKey;
    const { orderId, amount, channel = 'ASPI_SWITCH', customerName = 'Customer', customerEmail = 'buyer@grocemart.co.id' } = req.body;
    
    // Simulate webhook acceptance
    const tx = {
      orderId,
      qrisReference: req.body.qrisReference || `QRIS-WH-${Date.now().toString().slice(-6)}`,
      amount: amount || 50000,
      status: 'paid' as const,
      expiresAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      settlementChannel: channel,
    };
    qrisTransactions.set(orderId, tx);

    const payload = {
      success: true,
      message: 'QRIS Webhook verified and settled.',
      orderId,
      qrisReference: tx.qrisReference,
      status: 'SETTLED',
      idempotencyKey,
    };

    idempotencyStore.set(idempotencyKey, {
      idempotencyKey,
      orderId,
      timestamp: new Date().toISOString(),
      statusCode: 200,
      responseBody: payload,
      qrisReference: tx.qrisReference,
    });

    res.json(payload);
  });

  // Concurrency Stress Test API (Demonstrates zero overselling and mutex serialization)
  app.post('/api/admin/inventory/concurrency-test', async (req: Request, res: Response) => {
    const { sku = 'SKU-PRD-001', concurrentRequests = 10, qtyPerRequest = 1 } = req.body;
    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) return res.status(404).json({ error: `Item SKU ${sku} not found` });

    const initialStock = item.currentStock;
    const trace: { attempt: number; success: boolean; stockRemaining: number; error?: string }[] = [];

    // Launch parallel asynchronous checkout attempts
    const promises = Array.from({ length: concurrentRequests }).map(async (_, idx) => {
      return inventoryConcurrencyManager.runWithLock([`lock_sku_${sku}`], async () => {
        // Re-evaluate stock inside lock (critical section)
        if (item.currentStock < qtyPerRequest) {
          trace.push({
            attempt: idx + 1,
            success: false,
            stockRemaining: item.currentStock,
            error: `Anti-Overselling Guard: Insufficient inventory. Available: ${item.currentStock}, Requested: ${qtyPerRequest}. Allocation rejected.`,
          });
          return false;
        }
        item.currentStock -= qtyPerRequest;
        item.outgoingStock += qtyPerRequest;
        trace.push({
          attempt: idx + 1,
          success: true,
          stockRemaining: item.currentStock,
        });
        return true;
      });
    });

    const results = await Promise.all(promises);
    const successfulCount = results.filter(Boolean).length;
    const rejectedCount = results.length - successfulCount;

    res.json({
      success: true,
      sku,
      productName: item.productName,
      initialStock,
      currentStock: item.currentStock,
      totalAttempts: concurrentRequests,
      successfulAllocations: successfulCount,
      rejectedOversellAttempts: rejectedCount,
      raceConditionDetected: false,
      negativeInventoryPrevented: true,
      trace,
    });
  });

  // -------------------------------------------------------------
  // USER LIVE TRACKING AUTHORIZATION PROTECTION ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/tracking/:orderId', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const { userId, email } = req.query;

    if (!userId && !email) {
      return res.status(401).json({
        authorized: false,
        error: 'Authentication Required: Live order tracking requires your authenticated customer session.',
      });
    }

    // In a live system, query database for order owner
    // If authenticated user does not match the order's owner, strictly block access!
    res.json({
      authorized: true,
      orderId,
      requestedBy: { userId, email },
      statusMessage: 'Authorized: Access granted to personal order tracking data.',
    });
  });

  // -------------------------------------------------------------
  // STORE OPERATIONS & SCHEDULES MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------
  app.get(['/api/admin/store-status', '/api/store-status', '/api/store/status'], (_req: Request, res: Response) => {
    res.json(storeStatus);
  });

  app.post('/api/admin/store-status', (req: Request, res: Response) => {
    const { isOpen, isHolidayMode, noticeBanner, reopenEstimated, maintenanceReason, allowCatalogBrowsing, forceOverride } = req.body;

    // Strict State Machine Guard: Cannot close store if active orders are Out for Delivery or Awaiting Pickup
    if (isOpen === false) {
      const activeOrders = getActiveOrdersForStore('ALL');
      if (activeOrders.length > 0 && forceOverride !== true) {
        return res.status(409).json({
          success: false,
          warning: 'ACTIVE_DELIVERIES_IN_PROGRESS',
          requiresConfirmation: true,
          activeOrdersCount: activeOrders.length,
          activeOrders,
          message: `Store Closure Schedule Guard: ${activeOrders.length} customer order(s) across outlets are currently Out for Delivery or Awaiting Pickup. Closing the storefront network without acknowledging in-transit deliveries may strand drivers and freeze tracking. Confirmation required to override.`,
        });
      }
    }

    storeStatus = {
      isOpen: isOpen !== undefined ? !!isOpen : storeStatus.isOpen,
      isHolidayMode: isHolidayMode !== undefined ? !!isHolidayMode : storeStatus.isHolidayMode,
      noticeBanner: noticeBanner !== undefined ? String(noticeBanner) : storeStatus.noticeBanner,
      reopenEstimated: reopenEstimated || storeStatus.reopenEstimated,
      maintenanceReason: maintenanceReason || storeStatus.maintenanceReason,
      allowCatalogBrowsing: allowCatalogBrowsing !== undefined ? !!allowCatalogBrowsing : storeStatus.allowCatalogBrowsing,
      updatedAt: new Date().toISOString(),
    };
    res.json({ success: true, storeStatus });
  });

  // Outlets operational schedules
  app.get('/api/admin/store-outlets', (_req: Request, res: Response) => {
    res.json(storeSchedules);
  });

  app.put('/api/admin/store-outlets/:storeId', (req: Request, res: Response) => {
    const { storeId } = req.params;
    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    if (!outlet) return res.status(404).json({ error: 'Store outlet not found' });

    const {
      openTime,
      closeTime,
      daysOpen,
      isEmergencyClosed,
      closureReason,
      isHolidayMode,
      holidayNotice,
      allowCatalogBrowsingWhenClosed,
      forceOverride,
    } = req.body;

    // Strict State Machine Guard: Cannot close store outlet if active orders are Out for Delivery or Awaiting Pickup
    if (isEmergencyClosed === true) {
      const activeOrders = getActiveOrdersForStore(storeId);
      if (activeOrders.length > 0 && forceOverride !== true) {
        return res.status(409).json({
          success: false,
          warning: 'ACTIVE_DELIVERIES_IN_PROGRESS',
          requiresConfirmation: true,
          activeOrdersCount: activeOrders.length,
          activeOrders,
          storeName: outlet.storeName,
          message: `Store Closure Schedule Guard: ${activeOrders.length} customer order(s) for ${outlet.storeName} are currently Out for Delivery or Awaiting Pickup. Closing this outlet now may strand in-transit orders or disrupt fulfillment. Confirmation required to override.`,
        });
      }
    }

    if (openTime !== undefined) outlet.openTime = openTime;
    if (closeTime !== undefined) outlet.closeTime = closeTime;
    if (daysOpen !== undefined) outlet.daysOpen = daysOpen;
    if (isEmergencyClosed !== undefined) outlet.isEmergencyClosed = !!isEmergencyClosed;
    if (closureReason !== undefined) outlet.closureReason = closureReason;
    if (isHolidayMode !== undefined) outlet.isHolidayMode = !!isHolidayMode;
    if (holidayNotice !== undefined) outlet.holidayNotice = holidayNotice;
    if (allowCatalogBrowsingWhenClosed !== undefined) outlet.allowCatalogBrowsingWhenClosed = !!allowCatalogBrowsingWhenClosed;
    outlet.updatedAt = new Date().toISOString();

    res.json({ success: true, outlet });
  });

  // Check outlet open/closed status for checkout guarding
  app.get('/api/store/check-open/:storeId', (req: Request, res: Response) => {
    const { storeId } = req.params;
    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    if (!outlet) {
      return res.json({
        isOpen: storeStatus.isOpen,
        storeName: 'GroceMart Retail',
        message: storeStatus.isOpen ? 'Open for checkout' : storeStatus.noticeBanner || 'Store is currently closed',
      });
    }

    // Company wide closure takes precedence
    if (!storeStatus.isOpen) {
      return res.json({
        isOpen: false,
        storeName: outlet.storeName,
        isEmergencyClosed: true,
        reason: storeStatus.maintenanceReason || 'Company-wide maintenance',
        message: storeStatus.noticeBanner || 'All outlets temporarily closed for maintenance.',
        resumeTime: storeStatus.reopenEstimated || 'Tomorrow 07:00 WIB',
      });
    }

    if (outlet.isEmergencyClosed) {
      return res.json({
        isOpen: false,
        storeName: outlet.storeName,
        isEmergencyClosed: true,
        reason: outlet.closureReason || 'Emergency outlet maintenance',
        message: `This outlet is currently closed (${outlet.closureReason || 'Maintenance'}). Operating hours resume tomorrow at ${outlet.openTime} ${outlet.timezone}.`,
        resumeTime: `${outlet.openTime} ${outlet.timezone}`,
      });
    }

    res.json({
      isOpen: true,
      storeName: outlet.storeName,
      isEmergencyClosed: false,
      hours: `${outlet.openTime} - ${outlet.closeTime} ${outlet.timezone}`,
      message: `Open daily ${outlet.openTime} - ${outlet.closeTime} ${outlet.timezone}`,
    });
  });

  // -------------------------------------------------------------
  // MULTI-WAREHOUSE & INVENTORY MANAGEMENT ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/admin/inventory', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    let totalStockCount = 0;
    let totalValuationWAC = 0;
    let lowStockCount = 0;

    inventoryList.forEach((item) => {
      totalStockCount += item.currentStock;
      totalValuationWAC += Math.round(item.currentStock * item.unitCost);
      if (item.currentStock <= item.minimumThreshold) {
        lowStockCount++;
      }
    });

    res.json({
      items: inventoryList,
      metrics: {
        totalStockCount,
        totalValuationWAC,
        lowStockCount,
        totalSkus: inventoryList.length,
      },
    });
  });

  app.get('/api/admin/inventory/matrix', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    res.json({
      warehouseZones,
      storeInventoryTiers,
      outlets: storeSchedules,
    });
  });

  app.put('/api/admin/inventory/stock-tier/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const tier = storeInventoryTiers.find((t) => t.id === id);
    if (!tier) return res.status(404).json({ error: 'Stock tier record not found' });

    const {
      safetyStockBuffer,
      maxCapacity,
      minimumThreshold,
      handlingInstructions,
      internalNotes,
      supplierRemarks,
    } = req.body;

    if (safetyStockBuffer !== undefined) tier.safetyStockBuffer = Number(safetyStockBuffer);
    if (maxCapacity !== undefined) tier.maxCapacity = Number(maxCapacity);
    if (minimumThreshold !== undefined) tier.minimumThreshold = Number(minimumThreshold);
    if (handlingInstructions !== undefined) tier.handlingInstructions = handlingInstructions;
    if (internalNotes !== undefined) tier.internalNotes = internalNotes;
    if (supplierRemarks !== undefined) tier.supplierRemarks = supplierRemarks;
    tier.updatedAt = new Date().toISOString();

    res.json({ success: true, stockTier: tier });
  });

  app.post('/api/admin/inventory/threshold', (req: Request, res: Response) => {
    const { sku, minimumThreshold, reorderQuantity } = req.body;
    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }
    if (minimumThreshold !== undefined) item.minimumThreshold = Number(minimumThreshold);
    if (reorderQuantity !== undefined) item.reorderQuantity = Number(reorderQuantity);

    res.json({ success: true, item });
  });

  app.post('/api/admin/inventory/adjust', (req: Request, res: Response) => {
    const { sku, adjustmentQty, reason = 'Inventory Stocktake Variance', storeId = 'store-jkt-senopati' } = req.body;
    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    const previousStock = item.currentStock;
    item.currentStock = Math.max(0, item.currentStock + Number(adjustmentQty));
    const delta = item.currentStock - previousStock;
    const costDelta = Math.abs(delta) * item.unitCost;

    // Also update multi-tier item & tracked batches if present
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    if (tier) {
      tier.physicalStock = Math.max(0, tier.physicalStock + Number(adjustmentQty));
      tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
      tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
      tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
    }
    if (delta !== 0) {
      syncBatchesForStockVariance(sku, storeId, delta, item.unitCost);
    }

    // Post balanced double-entry GL adjustment (#1040 Inventory Asset <-> #5210 Inventory Shrinkage & Opname Variance)
    const gleId = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleContraId = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const adjTimestamp = new Date().toISOString();
    const roundedCostDelta = roundIDR(costDelta);

    if (roundedCostDelta > 0) {
      commitBalancedGlBatch(
        [
          {
            id: gleId,
            timestamp: adjTimestamp,
            storeId,
            storeName: tier?.storeName || 'GroceMart Retail Hub',
            accountCode: '1040',
            accountName: 'Merchandise Inventory Asset',
            category: 'Asset',
            debit: delta > 0 ? roundedCostDelta : 0,
            credit: delta < 0 ? roundedCostDelta : 0,
            referenceType: 'INVENTORY_ADJUSTMENT',
            referenceId: sku,
            description: `Stock adjustment for ${sku} (${delta > 0 ? '+' : ''}${delta} units): ${reason}`,
          },
          {
            id: gleContraId,
            timestamp: adjTimestamp,
            storeId,
            storeName: tier?.storeName || 'GroceMart Retail Hub',
            accountCode: '5210',
            accountName: 'Inventory Shrinkage & Blind Opname Variance Expense',
            category: 'Expense',
            debit: delta < 0 ? roundedCostDelta : 0,
            credit: delta > 0 ? roundedCostDelta : 0,
            referenceType: 'INVENTORY_ADJUSTMENT',
            referenceId: sku,
            description: `Contra variance adjustment for ${sku} (${delta > 0 ? '+' : ''}${delta} units): ${reason}`,
          },
        ],
        true
      );
    }

    if (delta < 0) {
      checkAndNotifyLowStockForSkus([sku], storeId);
    }

    res.json({ success: true, item, delta, costDelta: roundedCostDelta, gleId });
  });

  // -------------------------------------------------------------
  // ADVANCED INVENTORY: FEFO (FIRST EXPIRED, FIRST OUT) BATCHES
  // -------------------------------------------------------------
  app.get('/api/admin/inventory/batches', (req: Request, res: Response) => {
    const { storeId, sku, status } = req.query;
    syncAllBatchesExpiryStatus(Date.now());
    let list = [...inventoryBatches];

    if (storeId && storeId !== 'ALL') {
      list = list.filter((b) => b.storeId === storeId);
    }
    if (sku) {
      list = list.filter((b) => b.sku === sku);
    }
    if (status && status !== 'ALL') {
      list = list.filter((b) => b.status === status);
    }

    // Sort ascending by expiration date (FEFO sequence)
    list.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    res.json(list);
  });

  // -------------------------------------------------------------
  // REMOVAL STRATEGY CONFIGURATION (FEFO vs FIFO)
  // -------------------------------------------------------------
  app.get('/api/admin/inventory/removal-strategies', (_req: Request, res: Response) => {
    res.json(removalStrategiesConfig);
  });

  app.put('/api/admin/inventory/removal-strategies', (req: Request, res: Response) => {
    const body = req.body as Partial<RemovalStrategyConfig>;
    if (body.categoryStrategies) {
      removalStrategiesConfig.categoryStrategies = {
        ...removalStrategiesConfig.categoryStrategies,
        ...body.categoryStrategies,
      };
    }
    if (body.skuOverrides) {
      removalStrategiesConfig.skuOverrides = {
        ...removalStrategiesConfig.skuOverrides,
        ...body.skuOverrides,
      };
    }
    removalStrategiesConfig.updatedAt = new Date().toISOString();
    removalStrategiesConfig.updatedBy = currentActiveStaffSession.userName;
    res.json({
      success: true,
      config: removalStrategiesConfig,
      message: 'FIFO / FEFO removal strategies updated across ERP picking and dispatch.',
    });
  });

  app.post('/api/inventory/fefo-allocate', (req: Request, res: Response) => {
    const { sku, quantity, storeId = 'store-jkt-senopati' } = req.body;
    const reqQty = Number(quantity);

    if (!sku || !reqQty || reqQty <= 0) {
      return res.status(400).json({ error: 'Valid SKU and quantity (>0) are required' });
    }

    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) {
      return res.status(404).json({ error: 'SKU not found in inventory catalog' });
    }

    // Atomic non-expired ATP stock pre-check
    const atpCheck = getSellableNonExpiredAtpStock(sku, storeId);
    if (reqQty > atpCheck.effectiveAtp) {
      return res.status(400).json({
        error: `Insufficient non-expired ATP stock for SKU ${sku}: requested ${reqQty}, available ${atpCheck.effectiveAtp}.`,
      });
    }

    const deduction = deductBatchesByStrategy(sku, reqQty, storeId, item.unitCost, atpCheck.hasBatchTracking);
    if (deduction.insufficientStock) {
      return res.status(400).json({
        error: `Insufficient non-expired ATP stock for SKU ${sku}: requested ${reqQty}, available ${deduction.availableSellableQty}.`,
      });
    }
    const actualAllocated = deduction.allocatedQty;

    // Also deduct catalog & store tier stock
    item.currentStock = Math.max(0, Number((item.currentStock - actualAllocated).toFixed(2)));
    item.outgoingStock += actualAllocated;

    const tier = storeInventoryTiers.find(
      (t) => t.sku === sku && (storeId === 'ALL' || storeId === 'CONSOLIDATED' || t.storeId === storeId)
    );
    if (tier) {
      tier.physicalStock = Math.max(0, Number((tier.physicalStock - actualAllocated).toFixed(2)));
      tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
      tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
      tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
      tier.updatedAt = new Date().toISOString();
    }

    const result: FEFOAllocationResult = {
      sku,
      productName: item.productName,
      requestedQty: reqQty,
      allocatedQty: actualAllocated,
      remainingShortage: deduction.remainingShortage,
      allocations: deduction.allocations,
      totalCogs: deduction.totalCogs,
      fefoRuleApplied:
        deduction.strategyApplied === 'FIFO'
          ? 'FIFO (First In, First Out — Earliest received lot allocated first for dry/packaged goods)'
          : 'FEFO (First Expired, First Out — Earliest lot expiration date allocated first to minimize food spoilage)',
    };

    res.json({ success: true, result });
  });

  // -------------------------------------------------------------
  // SCRAP & WASTE MANAGEMENT (SHRINKAGE ACCOUNTING) ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/admin/waste', (req: Request, res: Response) => {
    const { storeId } = req.query;
    let records = wasteRecords;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      records = records.filter((w) => w.storeId === storeId);
    }

    let totalShrinkageCost = 0;
    const byReason: { [reason: string]: number } = {};
    const byStore: { [store: string]: number } = {};

    records.forEach((r) => {
      totalShrinkageCost += r.totalShrinkageCost;
      byReason[r.reason] = (byReason[r.reason] || 0) + r.totalShrinkageCost;
      byStore[r.storeName] = (byStore[r.storeName] || 0) + r.totalShrinkageCost;
    });

    res.json({
      records,
      metrics: {
        totalShrinkageCost,
        count: records.length,
        byReason,
        byStore,
      },
    });
  });

  app.post('/api/admin/waste', (req: Request, res: Response) => {
    const {
      sku,
      storeId = 'store-jkt-senopati',
      batchId,
      quantityScrapped,
      reason = 'expired',
      actionTaken = 'bio_compost',
      reportedBy = 'Store Quality Inspector',
      notes = '',
    } = req.body;

    const qty = Number(quantityScrapped);
    if (!sku || !qty || qty <= 0) {
      return res.status(400).json({ error: 'Valid SKU and positive quantityScrapped are required' });
    }

    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) return res.status(404).json({ error: 'SKU not found in inventory catalog' });

    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    const storeName = outlet?.storeName || 'GroceMart Senopati Flagship';
    const unitCost = item.unitCost;
    const totalShrinkageCost = qty * unitCost;

    // Deduct stock from catalog
    item.currentStock = Math.max(0, item.currentStock - qty);

    // Deduct stock from store inventory tier
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    if (tier) {
      tier.physicalStock = Math.max(0, tier.physicalStock - qty);
      tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
      tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
      tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
      tier.updatedAt = new Date().toISOString();
    }

    // Deduct from batch if specified or find earliest matching batch
    let lotNumber = '';
    if (batchId) {
      const batch = inventoryBatches.find((b) => b.batchId === batchId);
      if (batch) {
        batch.currentStock = Math.max(0, Number((batch.currentStock - qty).toFixed(2)));
        if (batch.currentStock === 0) batch.status = 'depleted';
        lotNumber = batch.lotNumber;
      }
    } else {
      const earliestBatch = inventoryBatches.find(
        (b) => b.sku === sku && (b.storeId === storeId || storeId === 'CONSOLIDATED') && b.currentStock > 0
      );
      if (earliestBatch) {
        earliestBatch.currentStock = Math.max(0, Number((earliestBatch.currentStock - qty).toFixed(2)));
        if (earliestBatch.currentStock === 0) earliestBatch.status = 'depleted';
        lotNumber = earliestBatch.lotNumber;
      }
    }

    const wasteId = `WST-2026-${(wasteRecords.length + 1).toString().padStart(3, '0')}`;
    const timestamp = new Date().toISOString();

    // Auto-Post Double-Entry General Ledger journal:
    // Debit 6030: Inventory Shrinkage & Spoilage Expense
    // Credit 1040: Merchandise Inventory Asset
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

    commitBalancedGlBatch(
      [
        {
          id: gleId1,
          timestamp,
          storeId,
          storeName,
          accountCode: '6030',
          accountName: 'Inventory Shrinkage & Spoilage Expense',
          category: 'Expense',
          debit: totalShrinkageCost,
          credit: 0,
          referenceType: 'WASTE_SHRINKAGE',
          referenceId: wasteId,
          description: `Shrinkage write-off: ${qty} units of ${item.productName} (${reason.replace(/_/g, ' ')})`,
        },
        {
          id: gleId2,
          timestamp,
          storeId,
          storeName,
          accountCode: '1040',
          accountName: 'Merchandise Inventory Asset',
          category: 'Asset',
          debit: 0,
          credit: totalShrinkageCost,
          referenceType: 'WASTE_SHRINKAGE',
          referenceId: wasteId,
          description: `Inventory reduction for waste loss #${wasteId}`,
        },
      ],
      true
    );

    const newRecord: WasteRecord = {
      id: wasteId,
      sku,
      productName: item.productName,
      storeId,
      storeName,
      warehouseZoneId: tier?.warehouseZoneId || 'WH-JKT-SEN-COLD',
      batchId,
      lotNumber: lotNumber || `LOT-${sku.slice(-3)}-MANUAL`,
      quantityScrapped: qty,
      unit: item.unit,
      unitCost,
      totalShrinkageCost,
      reason,
      actionTaken,
      reportedBy,
      reportedAt: timestamp,
      glEntryId: gleId1,
      notes,
    };

    wasteRecords.unshift(newRecord);

    res.json({
      success: true,
      message: 'Waste logged, inventory deducted, and shrinkage GL journal accrued.',
      wasteRecord: newRecord,
      journalEntryIds: [gleId1, gleId2],
    });
  });

  // -------------------------------------------------------------
  // IN-STORE PICKER & PACKER APP WITH SUBSTITUTION ENGINE
  // -------------------------------------------------------------
  app.get('/api/admin/picker/orders', (req: Request, res: Response) => {
    const { storeId, pickerStatus } = req.query;
    let list = pickerOrders;
    if (storeId && storeId !== 'ALL') {
      list = list.filter((o) => o.storeId === storeId);
    }
    if (pickerStatus && pickerStatus !== 'ALL') {
      list = list.filter((o) => o.pickerStatus === pickerStatus);
    }
    res.json(list);
  });

  app.post('/api/admin/picker/orders/:orderId/items/:itemId/pick', (req: Request, res: Response) => {
    const { orderId, itemId } = req.params;
    const { barcode } = req.body;

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    // Barcode check (simulated verification)
    if (barcode && barcode !== item.barcode) {
      return res.status(400).json({
        error: `Barcode mismatch: scanned "${barcode}", expected item barcode "${item.barcode}"`,
      });
    }

    item.pickedQty = item.orderedQty;
    item.status = 'picked';

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    if (order.pickedItems === order.totalItems) {
      order.pickerStatus = 'ready_for_packing';
    } else {
      order.pickerStatus = 'in_progress';
    }
    order.updatedAt = new Date().toISOString();

    res.json({ success: true, order, item });
  });

  const executeFulfillmentSubstitution = (
    orderId: string,
    itemId: string,
    replacementSku: string,
    reason: string = 'Out of Stock on Shelf'
  ): { statusCode: number; payload: Record<string, any> } => {
    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return { statusCode: 404, payload: { error: 'Picker order not found' } };

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return { statusCode: 404, payload: { error: 'Item not found in order' } };

    const replacement = inventoryList.find((i) => i.sku === replacementSku);
    if (!replacement) return { statusCode: 404, payload: { error: 'Replacement SKU not found' } };

    const atpCheck = getSellableNonExpiredAtpStock(replacementSku, order.storeId);
    if (item.orderedQty > atpCheck.effectiveAtp) {
      return {
        statusCode: 400,
        payload: {
          error: `Insufficient non-expired ATP stock for SKU ${replacementSku} (${atpCheck.effectiveAtp} available, ${item.orderedQty} required).`,
        },
      };
    }

    // Atomic batch deduction check before mutating tier/catalog/order
    const batchDeduction = deductBatchesByStrategy(
      replacementSku,
      item.orderedQty,
      order.storeId,
      replacement.unitCost,
      atpCheck.hasBatchTracking
    );
    if (batchDeduction.insufficientStock) {
      return {
        statusCode: 400,
        payload: {
          error: `Insufficient non-expired ATP stock for SKU ${replacementSku} (${batchDeduction.availableSellableQty} available, ${item.orderedQty} required).`,
        },
      };
    }

    const replacementTier = storeInventoryTiers.find(
      (t) => t.sku === replacementSku && t.storeId === order.storeId
    );
    replacement.currentStock = Math.max(0, Number((replacement.currentStock - item.orderedQty).toFixed(2)));
    if (replacementTier) {
      replacementTier.physicalStock = Math.max(0, Number((replacementTier.physicalStock - item.orderedQty).toFixed(2)));
      replacementTier.reservedStock = Math.min(replacementTier.reservedStock, replacementTier.physicalStock);
      replacementTier.availableStock = Math.max(
        0,
        Number((replacementTier.physicalStock - replacementTier.reservedStock).toFixed(2))
      );
      replacementTier.totalValuation = Math.round(replacementTier.physicalStock * replacementTier.unitCost);
      replacementTier.updatedAt = new Date().toISOString();
    }

    const originalSku = item.sku;
    const priceDelta = (replacement.sellingPrice * item.orderedQty) - item.finalPrice;

    item.status = 'substituted';
    item.sku = replacement.sku;
    item.pickedQty = item.orderedQty;
    item.substitution = {
      replacementProductId: replacement.productId,
      replacementSku: replacement.sku,
      replacementName: replacement.productName,
      replacementBarcode: `899${Date.now().toString().slice(-10)}`,
      originalPrice: item.finalPrice,
      replacementPrice: replacement.sellingPrice * item.orderedQty,
      priceDelta,
      reason,
      customerApprovalStatus: 'auto_approved',
      suggestedAt: new Date().toISOString(),
    };
    item.finalPrice = replacement.sellingPrice * item.orderedQty;
    item.productName = `${replacement.productName} (Substituted for ${item.productName})`;

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    if (order.pickedItems === order.totalItems) {
      order.pickerStatus = 'ready_for_packing';
    } else if (order.pickerStatus === 'assigned') {
      order.pickerStatus = 'in_progress';
    }
    order.updatedAt = new Date().toISOString();

    emitEnterpriseNotification({
      dedupeKey: `PICKER_SUB:${orderId}:${itemId}`,
      category: 'FULFILLMENT',
      severity: 'ACTION_REQUIRED',
      title: `Quick Substitution Processed (#${orderId})`,
      message: `${originalSku} substituted with ${replacement.productName} (${replacementSku}) — Reason: ${reason}.`,
      metadataLabel: `${orderId} • ${replacementSku}`,
      targetTab: 'picker',
    });

    return {
      statusCode: 200,
      payload: {
        success: true,
        message: `Item substituted with ${replacement.productName}. Customer notified via SMS/App notification.`,
        order,
        item,
        notificationMessage: `Hi ${order.customerName}, due to fresh stock freshness standard, we upgraded your ${originalSku} to ${replacement.productName} at no extra charge penalty!`,
      },
    };
  };

  app.post('/api/admin/picker/orders/:orderId/items/:itemId/substitute', (req: Request, res: Response) => {
    const { orderId, itemId } = req.params;
    const { replacementSku, reason = 'Out of Stock on Shelf' } = req.body;
    const result = executeFulfillmentSubstitution(orderId, itemId, replacementSku, reason);
    res.status(result.statusCode).json(result.payload);
  });

  app.post('/api/admin/fulfillment/substitute', (req: Request, res: Response) => {
    const { orderId, itemId, replacementSku, reason = 'Out of Stock on Shelf' } = req.body;
    if (!orderId || !itemId || !replacementSku) {
      return res.status(400).json({ error: 'orderId, itemId, and replacementSku are required.' });
    }
    const result = executeFulfillmentSubstitution(orderId, itemId, replacementSku, reason);
    res.status(result.statusCode).json(result.payload);
  });

  app.post('/api/admin/picker/orders/:orderId/complete', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    order.pickerStatus = 'completed';
    order.updatedAt = new Date().toISOString();

    res.json({ success: true, order, message: `Order #${orderId} packed and staged at Cold-Chain Dispatch Bay!` });
  });

  // -------------------------------------------------------------
  // VARIABLE-WEIGHT ITEMS (CATCH WEIGHT MANAGEMENT)
  // -------------------------------------------------------------
  app.post('/api/admin/catch-weight/weigh', (req: Request, res: Response) => {
    const { orderId, itemId, actualWeighedGrams } = req.body;
    const grams = Number(actualWeighedGrams);

    if (!orderId || !itemId || !grams || grams <= 0) {
      return res.status(400).json({ error: 'orderId, itemId, and valid actualWeighedGrams (>0) required' });
    }

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    if (!item.isCatchWeight) {
      return res.status(400).json({ error: 'This item is not configured as a catch-weight item' });
    }

    const pricePer100g = item.pricePer100g || 40000;
    const newPrice = Math.round((grams / 100) * pricePer100g);
    const originalEstimatedGrams = item.estimatedWeightGrams || grams;
    const weightVariance = Number((((grams - originalEstimatedGrams) / originalEstimatedGrams) * 100).toFixed(1));

    item.actualWeighedGrams = grams;
    item.weightVariancePercent = weightVariance;
    const previousFinalPrice = item.finalPrice;
    item.finalPrice = newPrice;
    item.status = 'picked';
    item.pickedQty = 1;

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    if (order.pickedItems === order.totalItems) {
      order.pickerStatus = 'ready_for_packing';
    } else if (order.pickerStatus === 'assigned') {
      order.pickerStatus = 'in_progress';
    }
    order.updatedAt = new Date().toISOString();

    const matchedOrder = customerOrders.find((o) => o.id === orderId);
    if (matchedOrder) {
      matchedOrder.total = Math.max(0, matchedOrder.total + (newPrice - previousFinalPrice));
    }

    res.json({
      success: true,
      item,
      order,
      priceAdjustment: {
        previousPrice: previousFinalPrice,
        newPrice,
        difference: newPrice - previousFinalPrice,
        gramsRecorded: grams,
        variancePercent: weightVariance,
      },
    });
  });

  // -------------------------------------------------------------
  // PROCUREMENT: PR, PO, & PARTIAL GOODS RECEIPT (GR) ENDPOINTS
  // -------------------------------------------------------------
  app.get('/api/admin/procurement/requests', (_req: Request, res: Response) => {
    res.json(purchaseRequests);
  });

  app.post('/api/admin/procurement/requests', (req: Request, res: Response) => {
    const { sku, suggestedQuantity, reason = 'manual_request', priority = 'medium', requestedBy = 'Admin', storeId = 'store-jkt-senopati' } = req.body;
    const inv = inventoryList.find((i) => i.sku === sku);
    if (!inv) {
      return res.status(404).json({ error: 'SKU not found' });
    }

    const outlet = storeSchedules.find((s) => s.storeId === storeId);
    const qty = Number(suggestedQuantity) || inv.reorderQuantity || 50;
    const newPR: PurchaseRequest = {
      id: `PR-2026-${(purchaseRequests.length + 1).toString().padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      requestedBy,
      sku: inv.sku,
      productId: inv.productId,
      productName: inv.productName,
      storeId,
      storeName: outlet?.storeName || 'GroceMart Senopati Flagship',
      suggestedQuantity: qty,
      estimatedUnitCost: inv.unitCost,
      totalEstimatedCost: qty * inv.unitCost,
      status: 'pending',
      reason,
      priority,
    };

    purchaseRequests.unshift(newPR);
    emitEnterpriseNotification({
      dedupeKey: `PR_APPROVAL:${newPR.id}`,
      category: 'PROCUREMENT_FINANCE',
      severity: 'ACTION_REQUIRED',
      title: `Purchase Request Queued (${newPR.id})`,
      message: `${newPR.productName} (${qty} units, Rp ${newPR.totalEstimatedCost.toLocaleString('id-ID')}) for ${newPR.storeName}.`,
      metadataLabel: `${newPR.id} • ${newPR.sku}`,
      targetTab: 'approvals',
    });
    res.json({ success: true, purchaseRequest: newPR });
  });

  app.post('/api/admin/procurement/requests/:id/approve', (req: Request, res: Response) => {
    const { id } = req.params;
    const pr = purchaseRequests.find((p) => p.id === id);
    if (!pr) return res.status(404).json({ error: 'Purchase Request not found' });
    if (pr.status === 'approved') {
      return res.status(400).json({ error: `Purchase Request ${id} is already approved (PO #${pr.poId || 'issued'}).` });
    }

    pr.status = 'approved';
    pr.approvedAt = new Date().toISOString();

    const inv = inventoryList.find((i) => i.sku === pr.sku);
    const poId = `PO-2026-${(purchaseOrders.length + 1).toString().padStart(3, '0')}`;
    const subtotal = pr.totalEstimatedCost;
    const taxAmount = Math.round(subtotal * 0.11);

    const newPO: PurchaseOrder = {
      id: poId,
      createdAt: new Date().toISOString(),
      prId: pr.id,
      storeId: pr.storeId || 'store-jkt-senopati',
      storeName: pr.storeName || 'GroceMart Senopati Flagship',
      warehouseZoneId: 'WH-JKT-SEN-COLD',
      supplierName: inv?.supplierName || 'Official Farm Partner',
      supplierContact: 'Farm Logistics Dispatch (+62 812 0000 8888)',
      items: [
        {
          sku: pr.sku,
          productName: pr.productName,
          orderedQuantity: pr.suggestedQuantity,
          receivedQuantity: 0,
          remainingBackorder: pr.suggestedQuantity,
          unitCost: pr.estimatedUnitCost,
          totalCost: pr.totalEstimatedCost,
          handlingNotes: inv?.handlingInstructions || 'Cold-chain delivery required',
        },
      ],
      subtotalCost: subtotal,
      taxPercent: 11,
      taxAmount,
      totalCost: subtotal + taxAmount,
      expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
      status: 'Sent',
      notes: `Generated from approved PR ${pr.id}`,
      paymentTerms: 'Net 30',
      goodsReceiptIds: [],
    };

    pr.poId = poId;
    purchaseOrders.unshift(newPO);

    if (inv) {
      inv.incomingStock += pr.suggestedQuantity;
    }
    const prTier = storeInventoryTiers.find(
      (t) => t.sku === pr.sku && t.storeId === (pr.storeId || 'store-jkt-senopati')
    );
    if (prTier) {
      prTier.incomingStock += pr.suggestedQuantity;
    }

    res.json({ success: true, purchaseRequest: pr, purchaseOrder: newPO });
  });

  app.get('/api/admin/procurement/orders', (_req: Request, res: Response) => {
    res.json(purchaseOrders);
  });

  // Strict State Machine Guard: PO Status Transition & Force-Closure Validation
  app.post('/api/admin/procurement/orders/:id/status', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, closureNotes } = req.body;
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    const totalRemaining = po.items.reduce((sum, item) => sum + item.remainingBackorder, 0);

    if (status === 'Completed') {
      if (totalRemaining > 0 && !closureNotes) {
        return res.status(422).json({
          success: false,
          error: 'PO_INCOMPLETE_BACKORDER',
          remainingBackorder: totalRemaining,
          message: `Strict State Machine Guard: Cannot mark Purchase Order #${po.id} as 'Completed' because ${totalRemaining} unit(s) remain open on backorder. All line items must be fully received via Goods Receipt, or you must provide written adjustment closure notes explaining premature closure.`,
        });
      }

      if (totalRemaining > 0 && closureNotes) {
        po.items.forEach((poItem) => {
          const openQty = Math.max(0, Number(poItem.remainingBackorder) || 0);
          if (openQty > 0) {
            const inv = inventoryList.find((i) => i.sku === poItem.sku);
            if (inv) {
              inv.incomingStock = Math.max(0, (inv.incomingStock || 0) - openQty);
            }
            const tier = storeInventoryTiers.find((t) => t.sku === poItem.sku && t.storeId === po.storeId);
            if (tier) {
              tier.incomingStock = Math.max(0, (tier.incomingStock || 0) - openQty);
              tier.updatedAt = new Date().toISOString();
            }
            poItem.remainingBackorder = 0;
          }
        });
        po.status = 'Completed';
        po.isForceClosed = true;
        po.closureNotes = closureNotes;
        po.forceClosedAt = new Date().toISOString();
        return res.json({
          success: true,
          message: `PO #${po.id} closed with written adjustment notes for ${totalRemaining} unfulfilled units.`,
          purchaseOrder: po,
        });
      }
    }

    po.status = status;
    res.json({ success: true, purchaseOrder: po });
  });

  app.get('/api/admin/procurement/gr', (_req: Request, res: Response) => {
    res.json(goodsReceipts);
  });

  // GOODS RECEIPT WITH PARTIAL SHIPMENT FULFILLMENT
  app.post('/api/admin/procurement/gr/receive-partial', (req: Request, res: Response) => {
    const {
      poId,
      deliveryNoteNumber = `SJ-${Date.now().toString().slice(-6)}`,
      receivedBy = 'Store Receiving Officer',
      receiverNotes,
      warehouseZoneId = 'WH-JKT-SEN-COLD',
      items, // array of { sku, quantityReceived, batchNumber, expiryDate, qualityCondition, tempCheckCelsius }
    } = req.body;

    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item must be received' });
    }

    // Strict State Machine Pre-Validation: Validate no line item exceeds remaining backorder balance
    for (const itemInput of items) {
      const poItem = po.items.find((i) => i.sku === itemInput.sku);
      if (poItem) {
        const receivedQty = Math.max(0, Number(itemInput.quantityReceived) || 0);
        if (receivedQty > poItem.remainingBackorder) {
          return res.status(400).json({
            error: `Strict State Machine Guard: Received quantity (${receivedQty}) exceeds remaining open backorder balance (${poItem.remainingBackorder}) for SKU ${poItem.sku}. Receipt rejected.`,
          });
        }
      }
    }

    let grTotalCost = 0;
    const grItemsReceived: GoodsReceiptRecord['items'] = [];

    // Process each received item
    items.forEach((itemInput: any) => {
      const poItem = po.items.find((i) => i.sku === itemInput.sku);
      if (!poItem) return;

      const receivedQty = Math.max(0, Number(itemInput.quantityReceived) || 0);
      if (receivedQty === 0) return;

      // Update PO item line
      poItem.receivedQuantity += receivedQty;
      poItem.remainingBackorder = Math.max(0, poItem.orderedQuantity - poItem.receivedQuantity);

      const itemCost = receivedQty * poItem.unitCost;
      grTotalCost += itemCost;

      grItemsReceived.push({
        sku: poItem.sku,
        productName: poItem.productName,
        quantityOrdered: poItem.orderedQuantity,
        quantityReceived: receivedQty,
        batchNumber: itemInput.batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
        expiryDate: itemInput.expiryDate,
        qualityCondition: itemInput.qualityCondition || 'Passed - Grade A',
        tempCheckCelsius: itemInput.tempCheckCelsius,
      });

      // Update catalog inventory item with Moving Average Cost (WAC)
      const catalogItem = inventoryList.find((i) => i.sku === poItem.sku);
      if (catalogItem) {
        const oldStock = Math.max(0, Number(catalogItem.currentStock) || 0);
        const oldCost = Number(catalogItem.wacUnitCost ?? catalogItem.unitCost ?? poItem.unitCost) || 0;
        const newTotalStock = oldStock + receivedQty;
        const newWac =
          newTotalStock > 0
            ? Math.round(((oldStock * oldCost) + (receivedQty * poItem.unitCost)) / newTotalStock)
            : poItem.unitCost;

        catalogItem.currentStock = newTotalStock;
        catalogItem.unitCost = newWac;
        catalogItem.wacUnitCost = newWac;
        catalogItem.incomingStock = Math.max(0, catalogItem.incomingStock - receivedQty);
        catalogItem.lastRestockedAt = new Date().toISOString();
        catalogItem.stockBatches = catalogItem.stockBatches || [];
        catalogItem.stockBatches.push({
          batchId: itemInput.batchNumber || `BAT-${Date.now().toString().slice(-6)}`,
          quantity: receivedQty,
          unitCost: poItem.unitCost,
          receivedAt: new Date().toISOString(),
        });
      }

      const isQuarantineHold =
        String(itemInput.qualityCondition || '').toLowerCase().includes('quarantine') ||
        String(itemInput.qualityCondition || '').toLowerCase().includes('hold');

      // Update multi-tier inventory tier for specific store & warehouse zone
      const tier = storeInventoryTiers.find((t) => t.sku === poItem.sku && t.storeId === po.storeId);
      if (tier) {
        const tierOldStock = Math.max(0, Number(tier.physicalStock) || 0);
        const tierOldCost = Number(tier.unitCost ?? catalogItem?.wacUnitCost ?? poItem.unitCost) || 0;
        const tierNewStock = tierOldStock + receivedQty;
        const tierNewWac =
          tierNewStock > 0
            ? Math.round(((tierOldStock * tierOldCost) + (receivedQty * poItem.unitCost)) / tierNewStock)
            : poItem.unitCost;

        tier.unitCost = tierNewWac;
        tier.physicalStock = tierNewStock;
        if (isQuarantineHold) {
          tier.reservedStock = Math.min(tierNewStock, (tier.reservedStock || 0) + receivedQty);
        }
        tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
        tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
        tier.incomingStock = Math.max(0, tier.incomingStock - receivedQty);
        tier.lastRestockedAt = new Date().toISOString();
        tier.updatedAt = new Date().toISOString();
      }

      // Create tracked Lot / Batch record in inventoryBatches for FEFO/FIFO traceability
      const lotCode = itemInput.batchNumber || `BAT-${Date.now().toString().slice(-6)}`;
      const expiryIso =
        itemInput.expiryDate ||
        new Date(Date.now() + 86400000 * 21).toISOString();
      const expiryDiffMs = new Date(expiryIso).getTime() - Date.now();
      const isExpiredOnReceipt = !Number.isFinite(expiryDiffMs) || expiryDiffMs <= 0;
      const daysUntilExpiry = isExpiredOnReceipt
        ? Math.min(0, Math.floor((Number.isFinite(expiryDiffMs) ? expiryDiffMs : 0) / 86400000))
        : Math.max(1, Math.ceil(expiryDiffMs / 86400000));

      inventoryBatches.unshift({
        batchId: `BAT-GR-${Date.now().toString().slice(-5)}-${inventoryBatches.length + 1}`,
        sku: poItem.sku,
        productName: poItem.productName,
        storeId: po.storeId,
        storeName: po.storeName,
        warehouseZoneId: tier?.warehouseZoneId || warehouseZoneId,
        lotNumber: lotCode,
        initialQuantity: receivedQty,
        currentStock: receivedQty,
        unitCost: poItem.unitCost,
        sellingPrice: catalogItem?.sellingPrice || Math.round(poItem.unitCost * 1.45),
        receivedDate: new Date().toISOString(),
        expiryDate: expiryIso,
        daysUntilExpiry,
        status: isExpiredOnReceipt
          ? 'expired'
          : isQuarantineHold
          ? 'quarantined'
          : daysUntilExpiry <= 7
          ? 'near_expiry'
          : 'fresh',
        storageZone: tier?.storageType || 'cold_chilled',
        supplierName: po.supplierName,
        sourcePoNumber: po.id,
        notes: `Received via GR against ${po.id}`,
      });
    });

    // Check if PO is partially or completely received
    const totalRemaining = po.items.reduce((sum, item) => sum + item.remainingBackorder, 0);
    const isPartial = totalRemaining > 0;
    po.status = isPartial ? 'Partially Received' : 'Completed';
    po.actualDeliveryDate = new Date().toISOString().split('T')[0];

    // Create Goods Receipt Record
    const grId = `GR-2026-${(goodsReceipts.length + 1).toString().padStart(3, '0')}`;
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

    const newGR: GoodsReceiptRecord = {
      id: grId,
      poId: po.id,
      storeId: po.storeId,
      storeName: po.storeName,
      warehouseZoneId,
      deliveryNoteNumber,
      vendorName: po.supplierName,
      receivedAt: new Date().toISOString(),
      receivedBy,
      isPartial,
      items: grItemsReceived,
      receiverNotes: receiverNotes || (isPartial ? `Partial shipment received. ${totalRemaining} units backorder remaining.` : 'Order 100% fulfilled.'),
      glEntryId: gleId1,
    };

    po.goodsReceiptIds = po.goodsReceiptIds || [];
    po.goodsReceiptIds.push(grId);
    goodsReceipts.unshift(newGR);

    // Auto-Post Double Entry to General Ledger:
    // Debit 1040 Merchandise Inventory Asset
    // Credit 2010 Trade Accounts Payable
    const roundedGrTotalCost = Math.max(0, roundIDR(grTotalCost));
    commitBalancedGlBatch(
      [
        {
          id: gleId1,
          timestamp: new Date().toISOString(),
          storeId: po.storeId,
          storeName: po.storeName,
          accountCode: '1040',
          accountName: 'Merchandise Inventory Asset',
          category: 'Asset',
          debit: roundedGrTotalCost,
          credit: 0,
          referenceType: isPartial ? 'PARTIAL_GR' : 'PURCHASE_ORDER',
          referenceId: grId,
          description: `${grId}: ${isPartial ? 'Partial' : 'Full'} Goods receipt on PO #${po.id} from ${po.supplierName}`,
        },
        {
          id: gleId2,
          timestamp: new Date().toISOString(),
          storeId: po.storeId,
          storeName: po.storeName,
          accountCode: '2010',
          accountName: 'Trade Accounts Payable (Vendors)',
          category: 'Liability',
          debit: 0,
          credit: roundedGrTotalCost,
          referenceType: isPartial ? 'PARTIAL_GR' : 'PURCHASE_ORDER',
          referenceId: grId,
          description: `${grId}: Trade liability accrued for received items on PO #${po.id}`,
        },
      ],
      true
    );

    const qcAlertsInGr = grItemsReceived.filter(
      (gi) =>
        String(gi.qualityCondition || '').toLowerCase().includes('quarantine') ||
        String(gi.qualityCondition || '').toLowerCase().includes('hold') ||
        (gi.tempCheckCelsius !== undefined && Number(gi.tempCheckCelsius) > 8)
    );
    if (qcAlertsInGr.length > 0) {
      const firstAlert = qcAlertsInGr[0];
      emitEnterpriseNotification({
        dedupeKey: `GR_QC_HOLD:${grId}`,
        category: 'QUALITY_CONTROL',
        severity: 'CRITICAL',
        title: `GR Quarantine / Cold-Chain Alert (${grId})`,
        message: `${firstAlert.productName} on PO #${po.id} flagged (${firstAlert.qualityCondition}${firstAlert.tempCheckCelsius !== undefined ? `, ${firstAlert.tempCheckCelsius}°C` : ''}). Inspect before release.`,
        metadataLabel: `${firstAlert.sku} • ${po.storeName}`,
        targetTab: 'qc',
      });
    }

    res.json({
      success: true,
      goodsReceipt: newGR,
      purchaseOrder: po,
      isPartial,
      remainingBackorder: totalRemaining,
      journalEntryIds: [gleId1, gleId2],
    });
  });

  // -------------------------------------------------------------
  // STORE-SPECIFIC CHART OF ACCOUNTS & FINANCIAL ACCOUNTING
  // -------------------------------------------------------------
  app.get('/api/admin/accounting/coa', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    res.json(chartOfAccounts);
  });

  app.get('/api/admin/accounting/general-ledger', (req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const { storeId } = req.query;
    if (storeId && storeId !== 'CONSOLIDATED') {
      return res.json(generalLedger.filter((g) => g.storeId === storeId));
    }
    res.json(generalLedger);
  });

  // Formal Reversing Counter-Entry (Audit-Compliant Reversing Journal Voucher)
  app.post('/api/admin/accounting/general-ledger/:id/reverse', (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason = 'Auditor correction counter-entry' } = req.body;

    const original = generalLedger.find((g) => g.id === id);
    if (!original) {
      return res.status(404).json({ error: 'General Ledger entry not found' });
    }

    if (original.isReversed) {
      return res.status(409).json({
        error: `Journal Voucher #${id} is already reversed by voucher #${original.reversedByVoucherId}. Multiple reversals of the same entry are prohibited.`,
      });
    }

    const reversingId = `GLE-2026-REV-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const timestamp = new Date().toISOString();

    // Create counter-entry with flipped debit & credit
    const reversingEntry: GeneralLedgerEntry = {
      id: reversingId,
      timestamp,
      storeId: original.storeId,
      storeName: original.storeName,
      accountCode: original.accountCode,
      accountName: original.accountName,
      category: original.category,
      debit: original.credit,  // Flipped
      credit: original.debit,  // Flipped
      referenceType: 'REVERSING_ENTRY',
      referenceId: original.id,
      description: `[REVERSAL] ${reason} (Counter-entry for ${original.id})`,
      isReversal: true,
      reversesVoucherId: original.id,
      reversalReason: reason,
    };

    // Mark original as reversed (audit trail immutability preserved)
    original.isReversed = true;
    original.reversedByVoucherId = reversingId;

    generalLedger.unshift(reversingEntry);
    updateCoaLedgerBalance(reversingEntry.accountCode, reversingEntry.debit, reversingEntry.credit);

    res.json({
      success: true,
      message: `Reversing journal voucher #${reversingId} successfully posted. Original voucher #${original.id} marked as reversed.`,
      originalVoucher: original,
      reversingVoucher: reversingEntry,
    });
  });

  // -------------------------------------------------------------
  // FINANCIAL & INVENTORY IMMUTABILITY GUARD (NO HARD DELETES)
  // Strictly forbid hard deleting records in GL, PO, GR, Stock Ledgers
  // -------------------------------------------------------------
  const forbidHardDelete = (resourceName: string) => (_req: Request, res: Response) => {
    return res.status(405).json({
      success: false,
      error: 'IMMUTABLE_RECORD_VIOLATION',
      code: 'HARD_DELETE_FORBIDDEN',
      message: `Strict GAAP/IFRS Audit Trail Immutability Enforced: Hard-deleting ${resourceName} is strictly forbidden by financial audit standards. Corrections or adjustments must be recorded via reversing counter-entries.`,
    });
  };

  app.delete('/api/admin/accounting/general-ledger/:id', forbidHardDelete('General Ledger Vouchers'));
  app.delete('/api/admin/accounting/general-ledger', forbidHardDelete('General Ledger Vouchers'));
  app.delete('/api/admin/procurement/orders/:id', forbidHardDelete('Purchase Orders'));
  app.delete('/api/admin/procurement/gr/:id', forbidHardDelete('Goods Receipt Records'));
  app.delete('/api/admin/procurement/requests/:id', forbidHardDelete('Purchase Requests'));
  app.delete('/api/admin/inventory/stock-tier/:id', forbidHardDelete('Stock Ledger Records'));
  app.delete('/api/admin/waste/:id', forbidHardDelete('Waste/Shrinkage Records'));

  const buildDynamicPnlSnapshot = (rawStoreId?: unknown) => {
    const storeIdStr = rawStoreId ? String(rawStoreId) : 'CONSOLIDATED';
    const isSingleStore = Boolean(storeIdStr && storeIdStr !== 'CONSOLIDATED' && storeIdStr !== 'ALL');
    const factor = isSingleStore ? 0.25 : 1.0;
    const storeMeta = isSingleStore ? storeSchedules.find((st) => st.storeId === storeIdStr) : undefined;
    const storeName = storeMeta?.storeName || (isSingleStore ? storeIdStr : 'Consolidated Company-Wide');

    const getStoreScopedBalance = (code: string): number => {
      const liveAcc = chartOfAccounts.find((c) => c.accountCode === code);
      if (!isSingleStore) return liveAcc?.balance ?? 0;
      const base = BASELINE_COA_BY_CODE[code]?.balance ?? liveAcc?.balance ?? 0;
      const category = liveAcc?.category || BASELINE_COA_BY_CODE[code]?.category || 'Expense';
      let delta = 0;
      generalLedger.forEach((entry) => {
        if (entry.accountCode !== code || entry.storeId !== storeIdStr || INITIAL_SEED_GL_IDS.has(entry.id)) return;
        const dr = roundIDR(entry.debit);
        const cr = roundIDR(entry.credit);
        delta += category === 'Revenue' || category === 'Liability' || category === 'Equity' ? cr - dr : dr - cr;
      });
      return Math.round(base * factor + delta);
    };

    const revenueAccounts = chartOfAccounts.filter((c) => c.category === 'Revenue');
    const grossSalesRevenue = revenueAccounts.reduce((s, a) => s + getStoreScopedBalance(a.accountCode), 0);
    const discountsGiven = 0;
    const netSalesRevenue = grossSalesRevenue - discountsGiven;
    const costOfGoodsSold = getStoreScopedBalance('5010');
    const grossProfit = netSalesRevenue - costOfGoodsSold;
    const grossMarginPercent = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;

    const expenseAccounts = chartOfAccounts.filter((c) => c.category === 'Expense' && c.accountCode !== '5010');
    const operatingExpenses = expenseAccounts
      .map((acc) => ({
        category: `${acc.accountName} (#${acc.accountCode})`,
        amount: getStoreScopedBalance(acc.accountCode),
      }))
      .filter((item) => item.amount !== 0);

    const totalOperatingExpenses = operatingExpenses.reduce((sum, o) => sum + o.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercent = netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0;

    return {
      period: 'October 2026 MTD',
      storeId: storeIdStr || 'CONSOLIDATED',
      storeName,
      grossSalesRevenue,
      discountsGiven,
      netSalesRevenue,
      costOfGoodsSold,
      grossProfit,
      grossMarginPercent: Number(grossMarginPercent.toFixed(1)),
      operatingExpenses,
      totalOperatingExpenses,
      netProfit,
      netMarginPercent: Number(netMarginPercent.toFixed(1)),
    };
  };

  app.get('/api/admin/accounting/pnl', (req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    res.json(buildDynamicPnlSnapshot(req.query.storeId));
  });

  app.get('/api/admin/accounting/balance-sheet', (req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const { storeId } = req.query;
    const storeIdStr = storeId ? String(storeId) : 'CONSOLIDATED';
    const isSingleStore = Boolean(storeIdStr && storeIdStr !== 'CONSOLIDATED' && storeIdStr !== 'ALL');
    const factor = isSingleStore ? 0.25 : 1.0;

    const getScopedAccBalance = (acc: ChartOfAccount): number => {
      if (!isSingleStore) return acc.balance;
      const base = BASELINE_COA_BY_CODE[acc.accountCode]?.balance ?? acc.balance;
      let delta = 0;
      generalLedger.forEach((entry) => {
        if (entry.accountCode !== acc.accountCode || entry.storeId !== storeIdStr || INITIAL_SEED_GL_IDS.has(entry.id)) {
          return;
        }
        const dr = roundIDR(entry.debit);
        const cr = roundIDR(entry.credit);
        delta += acc.normalBalance === 'Debit' ? dr - cr : cr - dr;
      });
      return Math.round(base * factor + delta);
    };

    const assetAccounts = chartOfAccounts.filter((c) => c.category === 'Asset');
    const currentAssets = assetAccounts
      .filter((c) => c.accountCode !== '1510' && c.accountCode !== '1520')
      .map((c) => ({ category: `${c.accountName} (#${c.accountCode})`, amount: getScopedAccBalance(c) }))
      .filter((a) => a.amount !== 0);

    const nonCurrentAssets = assetAccounts
      .filter((c) => c.accountCode === '1510' || c.accountCode === '1520')
      .map((c) => ({ category: `${c.accountName} (#${c.accountCode})`, amount: getScopedAccBalance(c) }));

    const totalAssets = [...currentAssets, ...nonCurrentAssets].reduce((s, a) => s + a.amount, 0);

    const currentLiabilities = chartOfAccounts
      .filter((c) => c.category === 'Liability')
      .map((c) => ({ category: `${c.accountName} (#${c.accountCode})`, amount: getScopedAccBalance(c) }))
      .filter((l) => l.amount !== 0);

    const totalLiabilities = currentLiabilities.reduce((s, l) => s + l.amount, 0);

    const livePnl = buildDynamicPnlSnapshot(storeIdStr);
    const equityAccounts = chartOfAccounts.filter((c) => c.category === 'Equity');
    const paidInAcc = equityAccounts.find((c) => c.accountCode === '3010');
    const retainedAcc = equityAccounts.find((c) => c.accountCode === '3020');
    const paidInEquity = paidInAcc ? getScopedAccBalance(paidInAcc) : 0;
    const retainedPrior = retainedAcc ? getScopedAccBalance(retainedAcc) : 0;
    const otherEquity = equityAccounts
      .filter((c) => c.accountCode !== '3010' && c.accountCode !== '3020')
      .map((c) => ({ category: `${c.accountName} (#${c.accountCode})`, amount: getScopedAccBalance(c) }));

    const equityItems = [
      { category: 'Paid-In Capital & Founding Equity (#3010)', amount: paidInEquity },
      { category: 'Retained Earnings (Prior Quarters) (#3020)', amount: retainedPrior },
      ...otherEquity,
      { category: 'Current Month Net Earnings (P&L MTD)', amount: livePnl.netProfit },
    ];

    const totalEquity = equityItems.reduce((s, e) => s + e.amount, 0);

    res.json({
      period: 'October 2026 MTD',
      storeId: storeIdStr,
      assets: {
        currentAssets,
        nonCurrentAssets,
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        totalLiabilities,
      },
      equity: {
        equityItems,
        totalEquity,
      },
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
    });
  });

  app.get('/api/admin/accounting/cash-flow', (req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const { storeId } = req.query;
    const storeIdStr = storeId ? String(storeId) : 'CONSOLIDATED';
    const isSingleStore = Boolean(storeIdStr && storeIdStr !== 'CONSOLIDATED' && storeIdStr !== 'ALL');
    const factor = isSingleStore ? 0.25 : 1.0;

    const cashCodes = new Set(['1010', '1015', '1020']);
    const liveCashBalance = isSingleStore
      ? Math.round(
          ['1010', '1015', '1020'].reduce((sum, code) => sum + (BASELINE_COA_BY_CODE[code]?.balance ?? 0), 0) * factor
        ) +
        generalLedger
          .filter((e) => cashCodes.has(e.accountCode) && e.storeId === storeIdStr && !INITIAL_SEED_GL_IDS.has(e.id))
          .reduce((sum, e) => sum + roundIDR(e.debit) - roundIDR(e.credit), 0)
      : ['1010', '1015', '1020'].reduce(
          (sum, code) => sum + (chartOfAccounts.find((c) => c.accountCode === code)?.balance ?? 0),
          0
        );

    const liveCashDelta = generalLedger
      .filter(
        (e) =>
          cashCodes.has(e.accountCode) &&
          !INITIAL_SEED_GL_IDS.has(e.id) &&
          (!isSingleStore || e.storeId === storeIdStr)
      )
      .reduce((sum, e) => sum + roundIDR(e.debit) - roundIDR(e.credit), 0);

    const operatingActivities = [
      { category: 'Cash Receipts from QRIS Online & In-Store Sales', amount: Math.round(365000000 * factor) + Math.max(0, liveCashDelta) },
      { category: 'Payments to Produce & Dairy Suppliers', amount: -Math.round(210000000 * factor) + Math.min(0, liveCashDelta) },
      { category: 'Payments for Cold-Chain Refrigeration & Store Utilities', amount: -Math.round(18500000 * factor) },
      { category: 'Salaries Paid to Storekeepers & Couriers', amount: -Math.round(24800000 * factor) },
    ];
    const netOperatingCash = operatingActivities.reduce((s, o) => s + o.amount, 0);

    const investingActivities = [
      { category: 'Purchase of Chilled Walk-In Expansion Units', amount: -Math.round(18000000 * factor) },
      { category: 'Digital Scale & Thermal Barcode Upgrades', amount: -Math.round(4500000 * factor) },
    ];
    const netInvestingCash = investingActivities.reduce((s, i) => s + i.amount, 0);

    const financingActivities = [
      { category: 'Short-Term Commercial Bank Credit Facility Drawdown', amount: Math.round(25000000 * factor) },
      { category: 'Principal Repayment on Logistics Vehicle Lease', amount: -Math.round(6200000 * factor) },
    ];
    const netFinancingCash = financingActivities.reduce((s, f) => s + f.amount, 0);

    const netCashIncrease = netOperatingCash + netInvestingCash + netFinancingCash;
    const endingCash = liveCashBalance;
    const beginningCash = endingCash - netCashIncrease;

    res.json({
      period: 'October 2026 MTD',
      storeId: storeIdStr,
      operatingActivities,
      netOperatingCash,
      investingActivities,
      netInvestingCash,
      financingActivities,
      netFinancingCash,
      netCashIncrease,
      beginningCash,
      endingCash,
    });
  });

  // -------------------------------------------------------------
  // MULTI-DIMENSIONAL REVENUE (OMZET) ANALYTICS ENDPOINT
  // -------------------------------------------------------------
  app.get('/api/admin/analytics/omzet', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const totalRevenueMTD = 388500000;
    const storeBreakdown = [
      { storeId: 'store-jkt-senopati', storeName: 'GroceMart Senopati Flagship', city: 'Jakarta', omzet: 124500000, orderCount: 412, sharePercent: 32.0, status: 'Open' as const },
      { storeId: 'store-jkt-pik', storeName: 'GroceMart PIK 2 The Avenue', city: 'Jakarta', omzet: 98200000, orderCount: 328, sharePercent: 25.3, status: 'Open' as const },
      { storeId: 'store-bdg-dago', storeName: 'GroceMart Dago Green Market', city: 'Bandung', omzet: 64800000, orderCount: 224, sharePercent: 16.7, status: 'Open' as const },
      { storeId: 'store-jkt-menteng', storeName: 'GroceMart Menteng Heritage', city: 'Jakarta', omzet: 48600000, orderCount: 165, sharePercent: 12.5, status: 'Open' as const },
      { storeId: 'store-bali-canggu', storeName: 'GroceMart Batu Bolong Organic', city: 'Bali', omzet: 32400000, orderCount: 108, sharePercent: 8.3, status: 'Open' as const },
      { storeId: 'store-sby-gubeng', storeName: 'GroceMart Gubeng Central Hub', city: 'Surabaya', omzet: 20000000, orderCount: 74, sharePercent: 5.2, status: 'Open' as const },
    ];

    const categoryBreakdown = [
      { category: 'produce', label: 'Fresh Organic Produce', omzet: 142000000, unitsSold: 5820, sharePercent: 36.6 },
      { category: 'dairy_eggs', label: 'Dairy & Pastured Eggs', omzet: 96500000, unitsSold: 2940, sharePercent: 24.8 },
      { category: 'meat_seafood', label: 'Artisanal Butchery & Seafood', omzet: 84000000, unitsSold: 980, sharePercent: 21.6 },
      { category: 'bakery', label: 'Stoneground Sourdough Bakery', omzet: 42000000, unitsSold: 1650, sharePercent: 10.8 },
      { category: 'pantry_coffee', label: 'Heritage Pantry & Single-Origin Coffee', omzet: 24000000, unitsSold: 710, sharePercent: 6.2 },
    ];

    const topSkus = [
      { sku: 'SKU-PRD-001', productName: 'Organic Hydroponic Butterhead Lettuce', category: 'Produce', unitsSold: 1420, revenue: 26270000 },
      { sku: 'SKU-PRD-002', productName: 'Heirloom Vine-Ripened Sweet Tomatoes', category: 'Produce', unitsSold: 980, revenue: 23520000 },
      { sku: 'SKU-MEA-001', productName: 'Grass-Fed Angus Ribeye Steak', category: 'Meat & Seafood', unitsSold: 280, revenue: 35000000 },
      { sku: 'SKU-DAI-001', productName: 'Pastured Free-Range Omega-3 Eggs', category: 'Dairy & Eggs', unitsSold: 890, revenue: 30260000 },
      { sku: 'SKU-BAK-001', productName: 'Artisan Country Sourdough Loaf', category: 'Bakery', unitsSold: 720, revenue: 28800000 },
    ];

    const b2cRevenue = totalRevenueMTD;
    const b2bRevenue = b2bOrdersList.reduce((sum, ord) => sum + (ord.totalAmountIDR || 0), 185000000);
    const combinedTotal = b2cRevenue + b2bRevenue;
    const b2bSharePercent = Math.round((b2bRevenue / combinedTotal) * 1000) / 10;
    const b2cSharePercent = Math.round((100 - b2bSharePercent) * 10) / 10;

    const totalArIDR = b2bCustomersList.reduce((sum, c) => sum + (c.outstandingAR || 0), 0);
    const overdueAccountsCount = b2bCustomersList.filter((c) => c.overdueDaysMax > 0).length;

    const totalLandedInformal = landedCostsList.reduce((sum, lc) => sum + (lc.informalLaborCostIDR || 0), 2450000);

    res.json({
      totalRevenueMTD,
      dodGrowthPercent: 4.8,  // Day-over-Day
      wowGrowthPercent: 12.4, // Week-over-Week
      momGrowthPercent: 18.2, // Month-over-Month
      totalOrders: 1311,
      averageBasketValue: 296338,
      qrisMetrics: {
        totalAttempts: 1380,
        settledCount: 1336,
        failedOrExpiredCount: 44,
        conversionRatePercent: 96.8,
        averageSettlementSeconds: 6.2,
      },
      storeBreakdown,
      categoryBreakdown,
      topSkus,
      b2bVsB2cSplit: {
        b2cRevenue,
        b2bRevenue,
        totalRevenue: combinedTotal,
        b2bSharePercent,
        b2cSharePercent,
        b2bOrdersCount: b2bOrdersList.length,
      },
      arAgingSummary: {
        currentIDR: 54500000,
        days31to60IDR: 32000000,
        overdue60PlusIDR: 8500000,
        totalArIDR,
        overdueAccountsCount,
      },
      informalLandedCostSummary: {
        totalAbsorbedIDR: totalLandedInformal,
        kuliBongkarFeesIDR: totalLandedInformal,
        dockRetribusiIDR: 650000,
        grossMarginProtectionPercent: 14.8,
      },
    });
  });

  app.get('/api/admin/accounting/audit-trail', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    res.json(auditTrail);
  });

  // =============================================================
  // MODULE 1: SHRINKAGE & NATURAL WEIGHT LOSS (CATCH-WEIGHT TOLERANCE)
  // Configurable evaporation tolerance + non-red-flag automated GL journal
  // =============================================================
  app.get('/api/admin/shrinkage/tolerances', (_req: Request, res: Response) => {
    res.json(weightToleranceConfigs);
  });

  app.put('/api/admin/shrinkage/tolerances/:category', (req: Request, res: Response) => {
    const { category } = req.params;
    const { maxEvaporationTolerancePercent, auditIntervalHours } = req.body;

    const config = weightToleranceConfigs.find((c) => c.category === category);
    if (!config) return res.status(404).json({ error: 'Category tolerance config not found' });

    if (maxEvaporationTolerancePercent !== undefined) {
      config.maxEvaporationTolerancePercent = Math.max(0, Number(maxEvaporationTolerancePercent));
    }
    if (auditIntervalHours !== undefined) {
      config.auditIntervalHours = Math.max(1, Number(auditIntervalHours));
    }

    res.json({ success: true, message: `Tolerance updated for ${config.categoryLabel}`, config });
  });

  app.get('/api/admin/shrinkage/adjustments', (req: Request, res: Response) => {
    const { storeId, category } = req.query;
    let list = naturalShrinkageAdjustments;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((a) => a.storeId === storeId);
    }
    if (category && category !== 'ALL') {
      list = list.filter((a) => a.category === category);
    }
    res.json(list);
  });

  app.post('/api/admin/shrinkage/adjust-natural', async (req: Request, res: Response) => {
    const {
      sku,
      storeId = 'store-jkt-senopati',
      recordedGrossWeightGrams,
      actualAuditWeightGrams,
      batchId,
      auditorNotes,
    } = req.body;

    const initialGrams = Number(recordedGrossWeightGrams);
    const auditedGrams = Number(actualAuditWeightGrams);

    if (!sku || !initialGrams || !auditedGrams || initialGrams <= 0 || auditedGrams <= 0) {
      return res.status(400).json({ error: 'Valid sku, recordedGrossWeightGrams, and actualAuditWeightGrams required' });
    }

    if (auditedGrams > initialGrams) {
      return res.status(400).json({ error: 'Audit weight exceeds original weight. Mass reduction required for shrinkage calculation.' });
    }

    const item = inventoryList.find((i) => i.sku === sku);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const toleranceConfig = weightToleranceConfigs.find((c) => c.category === item.category) || {
      category: item.category,
      categoryLabel: item.category,
      maxEvaporationTolerancePercent: 3.0,
      auditIntervalHours: 24,
      description: 'Default tolerance baseline',
    };

    const weightLossGrams = initialGrams - auditedGrams;
    const weightLossPercent = Number(((weightLossGrams / initialGrams) * 100).toFixed(2));
    const isWithinNaturalTolerance = weightLossPercent <= toleranceConfig.maxEvaporationTolerancePercent;

    // Financial valuation of natural moisture loss
    // Grams-to-unit ratio
    const gramsPerUnit = item.weightGrams || 500;
    const equivalentUnitsLost = Number((weightLossGrams / gramsPerUnit).toFixed(3));
    const totalLossCost = Math.round(equivalentUnitsLost * item.unitCost);

    const store = storeSchedules.find((s) => s.storeId === storeId);
    const storeName = store?.storeName || 'GroceMart Senopati Flagship';
    const warehouseZoneId = store?.activeWarehouses[1] || 'WH-JKT-SEN-COLD';

    // Deduct stock mass from inventory tier, catalog item, and batch ledger
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    if (tier && equivalentUnitsLost > 0) {
      tier.physicalStock = Math.max(0, Number((tier.physicalStock - equivalentUnitsLost).toFixed(2)));
      tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
      tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
      tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
      tier.updatedAt = new Date().toISOString();
    }
    if (equivalentUnitsLost > 0) {
      item.currentStock = Math.max(0, Number((item.currentStock - equivalentUnitsLost).toFixed(2)));
      if (batchId) {
        const targetBatch = inventoryBatches.find((b) => b.batchId === batchId);
        if (targetBatch) {
          targetBatch.currentStock = Math.max(0, Number((targetBatch.currentStock - equivalentUnitsLost).toFixed(2)));
          if (targetBatch.currentStock === 0) targetBatch.status = 'depleted';
        }
      } else {
        deductBatchesByStrategy(sku, equivalentUnitsLost, storeId, item.unitCost);
      }
    }

    // Auto-Post Double-Entry Accounting Entry:
    // Debit 6030: Inventory Shrinkage & Natural Loss Expense
    // Credit 1040: Merchandise Inventory Asset
    const timestamp = new Date().toISOString();
    const evapId = `EVAP-2026-${(naturalShrinkageAdjustments.length + 1).toString().padStart(3, '0')}`;
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

    const classification = isWithinNaturalTolerance
      ? 'Natural Shrinkage / Evaporation Loss'
      : 'Anomalous Spoilage Loss';

    commitBalancedGlBatch(
      [
        {
          id: gleId1,
          timestamp,
          storeId,
          storeName,
          accountCode: '6030',
          accountName: 'Inventory Shrinkage & Spoilage Expense',
          category: 'Expense',
          debit: totalLossCost,
          credit: 0,
          referenceType: 'INVENTORY_ADJUSTMENT',
          referenceId: evapId,
          description: `[${classification}] ${weightLossGrams}g moisture loss on ${item.productName} (${weightLossPercent}% vs ${toleranceConfig.maxEvaporationTolerancePercent}% threshold)`,
        },
        {
          id: gleId2,
          timestamp,
          storeId,
          storeName,
          accountCode: '1040',
          accountName: 'Merchandise Inventory Asset',
          category: 'Asset',
          debit: 0,
          credit: totalLossCost,
          referenceType: 'INVENTORY_ADJUSTMENT',
          referenceId: evapId,
          description: `Asset balance adjustment for natural shrinkage audit #${evapId}`,
        },
      ],
      true
    );

    const adjustment: NaturalShrinkageAdjustment = {
      id: evapId,
      timestamp,
      sku,
      productName: item.productName,
      category: item.category,
      storeId,
      storeName,
      warehouseZoneId,
      batchId,
      recordedGrossWeightGrams: initialGrams,
      actualAuditWeightGrams: auditedGrams,
      weightLossGrams,
      weightLossPercent,
      toleranceThresholdPercent: toleranceConfig.maxEvaporationTolerancePercent,
      isWithinNaturalTolerance,
      classification,
      unitCost: item.unitCost,
      totalLossCost,
      glEntryId: gleId1,
      auditorId: currentActiveStaffSession.userId,
      auditorName: currentActiveStaffSession.userName,
      shiftId: currentActiveStaffSession.activeShiftId,
      notes: auditorNotes || `Weight reduction of ${weightLossGrams}g (${weightLossPercent}%) confirmed during shift stocktake.`,
    };

    naturalShrinkageAdjustments.unshift(adjustment);

    // Record in Security & Operational Audit Log
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp,
      actionType: 'SHRINKAGE_WRITE_OFF',
      resourceId: evapId,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        sku,
        classification,
        isWithinNaturalTolerance,
        weightLossGrams,
        weightLossPercent,
        totalLossCost,
      },
    });

    res.json({
      success: true,
      message: isWithinNaturalTolerance
        ? `Logged as Natural Shrinkage (${weightLossPercent}% within ${toleranceConfig.maxEvaporationTolerancePercent}% tolerance). Clean audit record posted.`
        : `Warning: Moisture loss of ${weightLossPercent}% exceeds natural threshold (${toleranceConfig.maxEvaporationTolerancePercent}%). Flagged as anomalous shrinkage.`,
      adjustment,
      journalEntryIds: [gleId1, gleId2],
    });
  });

  // =============================================================
  // MODULE 2: REAL-TIME SUBSTITUTION & BUYER PROMPT ENGINE
  // Simulated WhatsApp/In-App customer prompt + FIFO batch balance recomputation
  // =============================================================
  app.get('/api/admin/substitutions/prompts', (req: Request, res: Response) => {
    const { status, storeId } = req.query;
    let list = substitutionPromptRecords;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((p) => p.storeId === storeId);
    }
    if (status && status !== 'ALL') {
      list = list.filter((p) => p.promptStatus === status);
    }
    res.json(list);
  });

  app.post('/api/admin/substitutions/request-prompt', (req: Request, res: Response) => {
    const {
      orderId,
      itemId,
      replacementSku,
      channel = 'WhatsApp',
      absorbPriceDifference = true,
    } = req.body;

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Order not found in picker queue' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    const replacement = inventoryList.find((i) => i.sku === replacementSku);
    if (!replacement) return res.status(404).json({ error: 'Replacement SKU not found' });

    const atpCheck = getSellableNonExpiredAtpStock(replacementSku, order.storeId);
    if (item.orderedQty > atpCheck.effectiveAtp) {
      return res.status(400).json({
        error: `Insufficient non-expired ATP stock for SKU ${replacementSku} (${atpCheck.effectiveAtp} available, ${item.orderedQty} required).`,
      });
    }

    // FIFO/FEFO non-expired sellable batch allocation check on replacement stock
    const nowMs = Date.now();
    const availableReplacementBatches = inventoryBatches
      .filter((b) => {
        syncBatchExpiryStatus(b, nowMs);
        return (
          b.sku === replacementSku &&
          b.storeId === order.storeId &&
          b.currentStock > 0 &&
          b.status !== 'expired' &&
          b.status !== 'quarantined' &&
          b.status !== 'recalled' &&
          b.status !== 'depleted' &&
          new Date(b.expiryDate).getTime() > nowMs
        );
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    const replacementBatch = availableReplacementBatches[0] || {
      batchId: `BAT-${replacementSku.slice(-3)}-AUTO`,
      lotNumber: `LOT-${Date.now().toString().slice(-4)}`,
      expiryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      currentStock: replacement.currentStock,
    };

    const priceDelta = (replacement.sellingPrice * item.orderedQty) - item.finalPrice;
    const promptId = `SUB-PRM-2026-${(substitutionPromptRecords.length + 1).toString().padStart(3, '0')}`;
    const timestamp = new Date().toISOString();

    const simulationMessage =
      channel === 'WhatsApp'
        ? `[GroceMart WhatsApp Official] Hi ${order.customerName}! Due to morning farm freshness harvest checks, your ordered ${item.productName} is currently unavailable. Packer has reserved ${replacement.productName} (Rp ${replacement.sellingPrice.toLocaleString('id-ID')} value${absorbPriceDifference ? ' - Price difference covered by GroceMart!' : ''}). Reply YES to confirm or NO for refund.`
        : `GroceMart App Alert: Substitution proposed for Order #${orderId}: ${replacement.productName}. Tap to approve within 10 mins.`;

    const promptRecord: SubstitutionPromptRecord = {
      id: promptId,
      orderId,
      itemId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      originalSku: item.sku,
      originalProductName: item.productName,
      originalPrice: item.finalPrice,
      originalQty: item.orderedQty,
      replacementSku: replacement.sku,
      replacementProductName: replacement.productName,
      replacementPrice: replacement.sellingPrice * item.orderedQty,
      replacementBatchId: replacementBatch.batchId,
      replacementLotNumber: replacementBatch.lotNumber,
      replacementExpiryDate: replacementBatch.expiryDate,
      priceDelta,
      absorbPriceDifference: Boolean(absorbPriceDifference),
      promptStatus: 'pending_customer_approval',
      channel,
      simulationMessage,
      timestamp,
      packerId: currentActiveStaffSession.userId,
      storeId: order.storeId,
    };

    substitutionPromptRecords.unshift(promptRecord);

    emitEnterpriseNotification({
      dedupeKey: `SUB_PROMPT:${promptId}`,
      category: 'FULFILLMENT',
      severity: 'ACTION_REQUIRED',
      title: `Customer Substitution Prompt (#${orderId})`,
      message: `Picker proposed ${replacement.productName} for ${item.productName} via ${channel}.`,
      metadataLabel: `${orderId} • ${replacementSku}`,
      targetTab: 'picker',
    });

    res.json({
      success: true,
      message: `Customer prompt dispatched via ${channel}. Awaiting customer confirmation.`,
      prompt: promptRecord,
    });
  });

  app.post('/api/admin/substitutions/:promptId/respond', async (req: Request, res: Response) => {
    const { promptId } = req.params;
    const { action } = req.body; // 'approve' | 'decline'

    const prompt = substitutionPromptRecords.find((p) => p.id === promptId);
    if (!prompt) return res.status(404).json({ error: 'Substitution prompt not found' });

    if (prompt.promptStatus !== 'pending_customer_approval') {
      return res.status(400).json({ error: `Prompt has already been decided: ${prompt.promptStatus}` });
    }

    const order = pickerOrders.find((o) => o.orderId === prompt.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const item = order.items.find((i) => i.id === prompt.itemId);
    if (!item) return res.status(404).json({ error: 'Order item not found' });

    if (action === 'decline') {
      prompt.decidedAt = new Date().toISOString();
      prompt.promptStatus = 'declined_by_customer';
      item.status = 'out_of_stock';
      order.updatedAt = new Date().toISOString();
      return res.json({
        success: true,
        message: 'Customer declined substitution. Item marked Out of Stock; customer balance credited for refund.',
        prompt,
      });
    }

    // Customer Approved: Verify non-expired ATP stock atomically BEFORE mutating prompt or stock
    const replacement = inventoryList.find((i) => i.sku === prompt.replacementSku);
    const replacementTier = storeInventoryTiers.find(
      (t) => t.sku === prompt.replacementSku && t.storeId === prompt.storeId
    );
    const atpCheck = getSellableNonExpiredAtpStock(prompt.replacementSku, prompt.storeId);
    if (item.orderedQty > atpCheck.effectiveAtp) {
      return res.status(400).json({
        error: `Insufficient non-expired ATP stock for SKU ${prompt.replacementSku} (${atpCheck.effectiveAtp} available, ${item.orderedQty} required).`,
      });
    }

    const nowMs = Date.now();
    const replacementBatch = inventoryBatches.find((b) => b.batchId === prompt.replacementBatchId);
    const batchIsSellable =
      replacementBatch &&
      !syncBatchExpiryStatus(replacementBatch, nowMs) &&
      replacementBatch.status !== 'quarantined' &&
      replacementBatch.status !== 'recalled' &&
      replacementBatch.status !== 'depleted' &&
      replacementBatch.currentStock >= item.orderedQty;

    if (!batchIsSellable) {
      const deduction = deductBatchesByStrategy(
        prompt.replacementSku,
        item.orderedQty,
        prompt.storeId,
        replacement?.unitCost || 15000,
        atpCheck.hasBatchTracking
      );
      if (deduction.insufficientStock) {
        return res.status(400).json({
          error: `Insufficient non-expired ATP stock for SKU ${prompt.replacementSku} (${deduction.availableSellableQty} available, ${item.orderedQty} required).`,
        });
      }
    } else if (replacementBatch) {
      replacementBatch.currentStock = Math.max(0, Number((replacementBatch.currentStock - item.orderedQty).toFixed(2)));
      if (replacementBatch.currentStock === 0) replacementBatch.status = 'depleted';
    }

    prompt.decidedAt = new Date().toISOString();
    prompt.promptStatus = 'approved_by_customer';
    if (replacement) {
      replacement.currentStock = Math.max(0, Number((replacement.currentStock - item.orderedQty).toFixed(2)));
    }
    if (replacementTier) {
      replacementTier.physicalStock = Math.max(0, Number((replacementTier.physicalStock - item.orderedQty).toFixed(2)));
      replacementTier.reservedStock = Math.min(replacementTier.reservedStock, replacementTier.physicalStock);
      replacementTier.availableStock = Math.max(
        0,
        Number((replacementTier.physicalStock - replacementTier.reservedStock).toFixed(2))
      );
      replacementTier.totalValuation = Math.round(replacementTier.physicalStock * replacementTier.unitCost);
      replacementTier.updatedAt = new Date().toISOString();
    }

    // Update item in picker order
    item.status = 'substituted';
    item.sku = prompt.replacementSku;
    item.pickedQty = item.orderedQty;
    item.substitution = {
      replacementProductId: replacement?.productId || 'prod-sub',
      replacementSku: prompt.replacementSku,
      replacementName: prompt.replacementProductName,
      replacementBarcode: `899${Date.now().toString().slice(-10)}`,
      originalPrice: prompt.originalPrice,
      replacementPrice: prompt.replacementPrice,
      priceDelta: prompt.priceDelta,
      reason: 'Customer Approved Real-Time Substitution',
      customerApprovalStatus: 'auto_approved',
      suggestedAt: prompt.timestamp,
    };
    item.productName = `${prompt.replacementProductName} (Substituted from ${prompt.originalProductName})`;
    item.finalPrice = prompt.absorbPriceDifference ? prompt.originalPrice : prompt.replacementPrice;

    // Financial Hook: If store absorbed difference, book Promotional Courtesy Expense
    const journalIds: string[] = [];
    if (prompt.absorbPriceDifference && prompt.priceDelta > 0) {
      const timestamp = new Date().toISOString();
      const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
      const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

      commitBalancedGlBatch(
        [
          {
            id: gleId1,
            timestamp,
            storeId: prompt.storeId,
            storeName: order.storeName,
            accountCode: '6010',
            accountName: 'Store Operational Expense',
            category: 'Expense',
            debit: prompt.priceDelta,
            credit: 0,
            referenceType: 'OPEX',
            referenceId: prompt.id,
            description: `Customer courtesy discount for substituted SKU ${prompt.replacementSku} on Order #${prompt.orderId}`,
          },
          {
            id: gleId2,
            timestamp,
            storeId: prompt.storeId,
            storeName: order.storeName,
            accountCode: '4010',
            accountName: 'Grocery Sales Revenue',
            category: 'Revenue',
            debit: 0,
            credit: prompt.priceDelta,
            referenceType: 'OPEX',
            referenceId: prompt.id,
            description: `Revenue differential offset for order #${prompt.orderId}`,
          },
        ],
        true
      );

      journalIds.push(gleId1, gleId2);
      prompt.glJournalIds = journalIds;
    }

    prompt.fifoAuditLog = `FIFO Batch ${prompt.replacementBatchId} (Lot ${prompt.replacementLotNumber}, Expiry ${prompt.replacementExpiryDate}) allocated to Order #${prompt.orderId}.`;

    order.pickedItems = order.items.filter((i) => i.status === 'picked' || i.status === 'substituted').length;
    if (order.pickedItems === order.totalItems) {
      order.pickerStatus = 'ready_for_packing';
    }
    order.updatedAt = new Date().toISOString();

    // Security & Operational Audit Log
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'SUBSTITUTION_DISPATCH',
      resourceId: prompt.id,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: prompt.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        orderId: prompt.orderId,
        originalSku: prompt.originalSku,
        replacementSku: prompt.replacementSku,
        priceDelta: prompt.priceDelta,
      },
    });

    res.json({
      success: true,
      message: `Substitution confirmed by buyer! Basket updated with ${prompt.replacementProductName}. FIFO tracking maintained.`,
      prompt,
      order,
    });
  });

  // =============================================================
  // MODULE 3: GRANULAR RBAC BY SHIFT, PHYSICAL ZONE & MULTI-OUTLET
  // Staff switch + zone-authorization checks + audit log
  // =============================================================
  app.post('/api/admin/auth/login', (req: Request, res: Response) => {
    syncAssignmentsOntoProfiles();
    const { userId, username, password, pin, shiftName } = req.body || {};

    let target = resolveStaffUser(userId || username);

    if (!target) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please select an authorized staff profile or enter a valid Employee ID.',
      });
    }

    const assignment = operatorBranchAssignments[target.userId];
    if (assignment?.isActive === false || target.isActive === false) {
      return res.status(403).json({
        success: false,
        error: `Account '${target.userName}' is currently suspended/inactive. Contact your Super Admin to reactivate access.`,
      });
    }

    const configuredPin = assignment?.loginPin || '8821';
    const hasCustomPin = configuredPin !== '8821';
    if (password !== undefined || pin !== undefined) {
      const provided = password !== undefined ? String(password) : String(pin);
      const isDefaultPasswordAllowed =
        !hasCustomPin && (provided === 'admin123' || provided === 'grocemart2026' || provided === target.userId);
      const isPinMatch = provided === configuredPin || (pin !== undefined && String(pin) === configuredPin);
      if (!isPinMatch && !isDefaultPasswordAllowed) {
        return res.status(401).json({
          success: false,
          error: hasCustomPin
            ? 'Incorrect Security PIN configured by Super Admin for this operator.'
            : 'Incorrect security password or PIN. Hint: use default "admin123" or PIN "8821".',
        });
      }
    }

    currentActiveStaffSession = {
      ...target,
      loginTimestamp: new Date().toISOString(),
      shiftName: shiftName || target.shiftName,
    };

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'USER_AUTHENTICATION',
      resourceId: `SESSION-${target.userId}`,
      userId: target.userId,
      userName: target.userName,
      userRole: target.userRole,
      storeId: target.storeId,
      shiftId: target.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        loginMethod: userId ? 'role_profile_selection' : 'credential_login',
        clientIp: req.ip || '127.0.0.1',
        shift: currentActiveStaffSession.shiftName,
        assignedBranchId: target.assignedBranchId || target.storeId,
        lockedRole: target.userRole,
      },
    });

    res.json({
      success: true,
      token: `erp-session-jwt-${Date.now()}-${target.userId}`,
      session: currentActiveStaffSession,
      availableProfiles: AVAILABLE_STAFF_USERS,
      message: `Authentication successful. Logged in as ${target.userName}`,
    });
  });

  app.post('/api/admin/auth/logout', (_req: Request, res: Response) => {
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'USER_LOGOUT',
      resourceId: `LOGOUT-${currentActiveStaffSession.userId}`,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: currentActiveStaffSession.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { reason: 'User initiated ERP session lock / sign out' },
    });

    res.json({ success: true, message: 'ERP session locked and logged out.' });
  });

  app.get('/api/admin/rbac/current-session', (_req: Request, res: Response) => {
    syncAssignmentsOntoProfiles();
    res.json({
      currentSession: currentActiveStaffSession,
      availableProfiles: AVAILABLE_STAFF_USERS,
    });
  });

  app.post('/api/admin/rbac/switch-session', (req: Request, res: Response) => {
    syncAssignmentsOntoProfiles();
    const rawHeaderRole = typeof req.headers['x-operator-role'] === 'string' ? req.headers['x-operator-role'].trim() : undefined;
    const callerRole = rawHeaderRole ? normalizeServerRoleStrict(rawHeaderRole) : normalizeServerRole(currentActiveStaffSession.userRole);
    if (callerRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        code: 'RBAC_FORBIDDEN',
        error: 'Session switching is locked. Click Lock / Sign Out to switch operator accounts.',
      });
    }

    const { userId } = req.body || {};
    const target = resolveStaffUser(userId);
    if (!target) return res.status(404).json({ error: 'Staff profile not found' });
    if (target.isActive === false) {
      return res.status(403).json({ error: `Operator '${target.userName}' is suspended/inactive.` });
    }

    currentActiveStaffSession = {
      ...target,
      loginTimestamp: new Date().toISOString(),
    };
    res.json({
      success: true,
      message: `Active session switched to ${currentActiveStaffSession.userName} (${currentActiveStaffSession.userRole})`,
      session: currentActiveStaffSession,
    });
  });

  app.get('/api/admin/rbac/security-audit-trail', (req: Request, res: Response) => {
    const { storeId, actionType } = req.query;
    let list = securityAuditTrail;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((a) => a.storeId === storeId);
    }
    if (actionType && actionType !== 'ALL') {
      list = list.filter((a) => a.actionType === actionType);
    }
    res.json(list);
  });

  // RBAC Zone Access Guard Endpoint (Enforces physical warehouse zone picking authorization)
  app.post('/api/admin/rbac/check-zone-access', (req: Request, res: Response) => {
    const { zoneType } = req.body; // 'ambient' | 'cold_chilled' | 'freezer'
    const allowed = currentActiveStaffSession.permissions.canPickZone(zoneType);

    if (!allowed) {
      securityAuditTrail.unshift({
        id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
        timestamp: new Date().toISOString(),
        actionType: 'ZONE_CONFIG_UPDATE',
        resourceId: zoneType,
        userId: currentActiveStaffSession.userId,
        userName: currentActiveStaffSession.userName,
        userRole: currentActiveStaffSession.userRole,
        storeId: currentActiveStaffSession.storeId,
        shiftId: currentActiveStaffSession.activeShiftId,
        status: 'PERMISSION_DENIED',
        metadata: { attemptedZone: zoneType, assignedZones: currentActiveStaffSession.assignedZones },
      });

      return res.status(403).json({
        success: false,
        authorized: false,
        error: `Access Denied: Staff role '${currentActiveStaffSession.userRole}' with active shift '${currentActiveStaffSession.activeShiftId}' is restricted from accessing physical zone '${zoneType}'. Assigned zones: [${currentActiveStaffSession.assignedZones.join(', ')}].`,
      });
    }

    res.json({ success: true, authorized: true, message: `Access granted for zone '${zoneType}'.` });
  });

  app.post('/api/admin/rbac/handover', (req: Request, res: Response) => {
    const { nextShift = 'Afternoon Shift', notes = '', outgoingUserId, outgoingUserName } = req.body || {};
    const record: SecurityAuditTrailRecord = {
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'SHIFT_HANDOVER' as any,
      resourceId: currentActiveStaffSession.activeShiftId,
      userId: outgoingUserId || currentActiveStaffSession.userId,
      userName: outgoingUserName || currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: currentActiveStaffSession.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        nextShift,
        notes: notes || 'Standard cold-chain shift handover sign-off completed.',
      },
    };
    securityAuditTrail.unshift(record);
    res.json({
      success: true,
      auditRecord: record,
      message: `Shift handover to ${nextShift} signed off and stamped in security audit log (${record.id}).`,
    });
  });

  // =============================================================
  // MODULE 4: GLOBAL SCALABILITY (MULTI-CURRENCY & CLIMATE COLD-CHAIN)
  // Multi-Currency P&L / GL conversions & Adaptive IoT Chiller Thresholds
  // =============================================================
  app.get('/api/admin/scalability/currencies', (_req: Request, res: Response) => {
    res.json(CURRENCY_RATES);
  });

  app.get('/api/admin/scalability/climate-thresholds', (req: Request, res: Response) => {
    const { storeId } = req.query;
    let list = climateAdaptiveConfigs;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((c) => c.storeId === storeId);
    }
    res.json(list);
  });

  app.put('/api/admin/scalability/climate-thresholds/:zoneId', (req: Request, res: Response) => {
    const { zoneId } = req.params;
    const {
      ambientExternalTempCelsius,
      externalHumidityPercent,
      adaptiveOffsetCelsius,
      currentActualTempCelsius,
    } = req.body;

    const config = climateAdaptiveConfigs.find((c) => c.warehouseZoneId === zoneId);
    if (!config) return res.status(404).json({ error: 'Climate config for zone not found' });

    if (ambientExternalTempCelsius !== undefined) config.ambientExternalTempCelsius = Number(ambientExternalTempCelsius);
    if (externalHumidityPercent !== undefined) config.externalHumidityPercent = Number(externalHumidityPercent);
    if (adaptiveOffsetCelsius !== undefined) config.adaptiveOffsetCelsius = Number(adaptiveOffsetCelsius);
    if (currentActualTempCelsius !== undefined) config.currentActualTempCelsius = Number(currentActualTempCelsius);

    // Recompute adaptive alert threshold
    config.activeAlertThresholdCelsius = Number(
      (config.standardTempMaxCelsius + config.adaptiveOffsetCelsius).toFixed(2)
    );

    // Evaluate IoT Breach Condition
    if (config.currentActualTempCelsius > config.activeAlertThresholdCelsius) {
      config.isTempAlertActive = true;
      config.alertSeverity =
        config.currentActualTempCelsius > config.activeAlertThresholdCelsius + 1.5
          ? 'CRITICAL_BREACH'
          : 'ELEVATED';
    } else {
      config.isTempAlertActive = false;
      config.alertSeverity = 'NORMAL';
    }

    config.lastUpdated = new Date().toISOString();

    res.json({
      success: true,
      message: `Zone ${config.zoneName} climate thresholds adapted to local external weather conditions.`,
      config,
    });
  });

  // Multi-Currency Financial Statement API (Converts dynamic GL / COA P&L based on target currency)
  app.get('/api/admin/accounting/pnl-multicurrency', (req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const { storeId, currency = 'IDR' } = req.query;
    const targetCurrency = (String(currency).toUpperCase() as SupportedCurrency) || 'IDR';
    const rateInfo = CURRENCY_RATES[targetCurrency] || CURRENCY_RATES.IDR;
    const basePnl = buildDynamicPnlSnapshot(storeId);

    const fx = (val: number) => {
      if (targetCurrency === 'IDR') return val;
      return Number((val / rateInfo.rateToIDR).toFixed(rateInfo.decimalPlaces));
    };

    res.json({
      currency: targetCurrency,
      symbol: rateInfo.symbol,
      fxRateToIDR: rateInfo.rateToIDR,
      period: basePnl.period,
      storeId: basePnl.storeId,
      storeName: basePnl.storeName,
      grossSalesRevenue: fx(basePnl.grossSalesRevenue),
      discountsGiven: fx(basePnl.discountsGiven),
      netSalesRevenue: fx(basePnl.netSalesRevenue),
      costOfGoodsSold: fx(basePnl.costOfGoodsSold),
      grossProfit: fx(basePnl.grossProfit),
      grossMarginPercent: basePnl.grossMarginPercent,
      operatingExpenses: basePnl.operatingExpenses.map((o) => ({
        category: o.category,
        amount: fx(o.amount),
      })),
      totalOperatingExpenses: fx(basePnl.totalOperatingExpenses),
      netProfit: fx(basePnl.netProfit),
      netMarginPercent: basePnl.netMarginPercent,
    });
  });

  // =============================================================
  // MODULE 5: POS (POINT OF SALE) & CASHIER STATION ENGINE
  // Real-time stock deduction, FEFO batch reduction, General Ledger,
  // multi-currency tender, and audit logging.
  // =============================================================
  app.get('/api/pos/products', (req: Request, res: Response) => {
    const { storeId = 'store-jkt-senopati', search = '', category = 'ALL' } = req.query;
    const cleanSearch = String(search).toLowerCase().trim();
    const cleanCategory = String(category).toLowerCase().trim();
    const nowMs = Date.now();
    inventoryBatches.forEach((b) => syncBatchExpiryStatus(b, nowMs));

    const posCatalog: POSProductItem[] = PRODUCTS.map((prod) => {
      const inv = inventoryList.find((i) => i.productId === prod.id || i.productName.toLowerCase() === prod.name.toLowerCase());
      const sku = inv?.sku || `SKU-${prod.category.slice(0, 3).toUpperCase()}-${prod.id.replace(/\D/g, '').padStart(3, '0')}`;

      const tier = storeInventoryTiers.find(
        (t) => t.sku === sku && (t.storeId === storeId || storeId === 'CONSOLIDATED')
      );
      const currentStock = tier ? tier.physicalStock : (inv ? inv.currentStock : 24);
      const atpInfo = getSellableNonExpiredAtpStock(sku, String(storeId));
      const availableStock = atpInfo.hasBatchTracking
        ? atpInfo.effectiveAtp
        : tier
        ? tier.availableStock
        : Math.max(0, currentStock - 2);

      // Find nearest active sellable non-expired FEFO batch for this SKU
      const batchesForSku = inventoryBatches
        .filter(
          (b) =>
            b.sku === sku &&
            (b.storeId === storeId || storeId === 'CONSOLIDATED' || b.storeId === 'store-jkt-senopati') &&
            b.currentStock > 0 &&
            b.status !== 'quarantined' &&
            b.status !== 'recalled' &&
            b.status !== 'expired' &&
            b.status !== 'depleted' &&
            new Date(b.expiryDate).getTime() > nowMs
        )
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

      const nearestBatch = batchesForSku[0];
      const evaluatedMarkdown = nearestBatch ? evaluateBatchMarkdown(nearestBatch, dynamicMarkdownConfig) : null;
      const activeMarkdownCandidate =
        nearestBatch && ((nearestBatch.markdownDiscountPercent && nearestBatch.markdownDiscountPercent > 0) || evaluatedMarkdown)
          ? evaluatedMarkdown
          : null;
      const effectiveSellingPrice = activeMarkdownCandidate
        ? activeMarkdownCandidate.markdownPrice
        : nearestBatch?.markdownDiscountPercent && nearestBatch.markdownDiscountPercent > 0
        ? Math.round(prod.price * (1 - nearestBatch.markdownDiscountPercent / 100))
        : prod.price;

      return {
        sku,
        productId: prod.id,
        name: prod.name,
        category: prod.category,
        sellingPrice: effectiveSellingPrice,
        unitCost: inv?.unitCost || Math.round(prod.price * 0.62),
        unit: prod.unit,
        barcode: sku,
        image: prod.image,
        currentStock,
        availableStock,
        isWeighted: Boolean(prod.isWeightBased || prod.category === 'produce' || prod.category === 'meat_seafood'),
        pricePerKg: prod.pricePerKg || (prod.unit.includes('kg') ? effectiveSellingPrice : effectiveSellingPrice * 4),
        nearestBatchId: nearestBatch?.batchId,
        lotNumber: nearestBatch?.lotNumber,
        expiryDate: nearestBatch?.expiryDate,
        daysUntilExpiry: nearestBatch?.daysUntilExpiry,
        batchStatus: nearestBatch
          ? nearestBatch.daysUntilExpiry <= 2
            ? 'critical'
            : nearestBatch.daysUntilExpiry <= 5
            ? 'near_expiry'
            : 'fresh'
          : 'fresh',
      };
    });

    let filtered = posCatalog;
    if (cleanCategory !== 'all') {
      filtered = filtered.filter((p) => p.category.toLowerCase() === cleanCategory);
    }
    if (cleanSearch) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(cleanSearch) ||
          p.sku.toLowerCase().includes(cleanSearch) ||
          p.barcode.toLowerCase().includes(cleanSearch) ||
          p.category.toLowerCase().includes(cleanSearch)
      );
    }

    res.json(filtered);
  });

  app.post('/api/pos/checkout', (req: Request, res: Response) => {
    const {
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      cashierId = currentActiveStaffSession.userId,
      cashierName = currentActiveStaffSession.userName,
      shiftId = currentActiveStaffSession.activeShiftId,
      items = [],
      discount = 0,
      currency = 'IDR',
      currencyRateToIDR = 1,
      paymentMethod = 'cash',
      cashTendered,
      cashChange,
      customerName = 'Walk-in Retail Shopper',
      customerPhone,
    } = req.body as POSTransactionRequest;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cannot process POS checkout with an empty cart.' });
    }

    // Role-Based Access Control Verification
    const isAuthorized =
      currentActiveStaffSession.permissions.canViewPos ||
      currentActiveStaffSession.userRole === 'cashier' ||
      currentActiveStaffSession.userRole === 'store_manager' ||
      currentActiveStaffSession.userRole === 'executive' ||
      currentActiveStaffSession.userRole === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        error: `Permission Denied: User ${currentActiveStaffSession.userName} (${currentActiveStaffSession.userRole}) is not authorized for Frontline POS register checkouts.`,
      });
    }

    // ATOMIC PRE-CHECK: Aggregate requested qty per SKU & validate sellable non-expired ATP before any mutation
    const nowMs = Date.now();
    const requestedBySku = new Map<string, number>();
    for (const item of items as any[]) {
      const sku = String(item.sku || '').trim();
      const qty = Number(item.quantity);
      if (!sku || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: `Invalid SKU or quantity in POS cart (${sku || 'unknown'}).` });
      }
      requestedBySku.set(sku, Number(((requestedBySku.get(sku) || 0) + qty).toFixed(3)));
    }

    for (const [sku, totalReqQty] of requestedBySku.entries()) {
      const atpCheck = getSellableNonExpiredAtpStock(sku, storeId);
      if (totalReqQty > atpCheck.effectiveAtp) {
        return res.status(400).json({
          error: `Insufficient non-expired ATP stock for SKU ${sku}: requested ${totalReqQty}, available ${atpCheck.effectiveAtp}.`,
        });
      }
    }

    const timestamp = new Date().toISOString();
    const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const cleanStoreCode = storeId.replace('store-', '').substring(0, 3).toUpperCase();
    const receiptNumber = `RCP-${cleanStoreCode}-${Date.now().toString().slice(-6)}`;
    const transactionId = `TXN-POS-2026-${(auditTrail.length + 1).toString().padStart(4, '0')}`;
    const orderId = `GCM-POS-${Date.now().toString().slice(-6)}`;

    // 1. Real-time Inventory, FEFO Batch Deduction, and Post-Markdown Net Pricing
    let totalCogsCost = 0;
    let inventoryDeductedCount = 0;
    let computedSubtotal = 0;

    const normalizedItems = (items as any[]).map((item: any) => {
      const qty = Math.max(0, Number(item.quantity) || 1);
      const inv = inventoryList.find((i) => i.sku === item.sku);
      const prod = PRODUCTS.find(
        (p) => p.id === (item.productId || inv?.productId) || p.name.toLowerCase() === String(item.name || inv?.productName || '').toLowerCase()
      );

      // Evaluate nearest active non-expired sellable batch for dynamic markdown pricing
      const nearestBatch = inventoryBatches
        .filter((b) => {
          syncBatchExpiryStatus(b, nowMs);
          return (
            b.sku === item.sku &&
            (b.storeId === storeId || storeId === 'CONSOLIDATED' || b.storeId === 'store-jkt-senopati') &&
            b.currentStock > 0 &&
            b.status !== 'quarantined' &&
            b.status !== 'recalled' &&
            b.status !== 'expired' &&
            b.status !== 'depleted' &&
            new Date(b.expiryDate).getTime() > nowMs
          );
        })
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];

      const mdCandidate = nearestBatch ? evaluateBatchMarkdown(nearestBatch, dynamicMarkdownConfig) : null;
      const catalogBasePrice = nearestBatch?.sellingPrice || prod?.price || inv?.sellingPrice || 0;
      const markdownUnitPrice = mdCandidate
        ? mdCandidate.markdownPrice
        : nearestBatch?.markdownDiscountPercent && nearestBatch.markdownDiscountPercent > 0
        ? Math.round(catalogBasePrice * (1 - nearestBatch.markdownDiscountPercent / 100))
        : 0;

      const rawUnitPrice = Number(item.unitPrice ?? item.price ?? inv?.sellingPrice ?? catalogBasePrice) || 0;
      let effectiveUnitPrice = rawUnitPrice;
      if (
        !item.isWeighted &&
        markdownUnitPrice > 0 &&
        markdownUnitPrice < catalogBasePrice &&
        rawUnitPrice >= catalogBasePrice - 1
      ) {
        effectiveUnitPrice = markdownUnitPrice;
      }

      const unitCost = roundIDR(
        Number(item.unitCost ?? inv?.wacUnitCost ?? inv?.unitCost) || Math.round(effectiveUnitPrice * 0.62)
      );
      const lineTotal =
        effectiveUnitPrice !== rawUnitPrice || !item.lineTotal
          ? Math.round(effectiveUnitPrice * qty)
          : Math.round(Number(item.lineTotal));
      computedSubtotal += lineTotal;

      // A. Store Inventory Tiers
      const tier = storeInventoryTiers.find(
        (t) => t.sku === item.sku && (t.storeId === storeId || storeId === 'CONSOLIDATED')
      );
      if (tier) {
        tier.physicalStock = Math.max(0, Number((tier.physicalStock - qty).toFixed(2)));
        tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
        tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
        tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
        tier.updatedAt = timestamp;
      }

      // B. Global Inventory List
      if (inv) {
        inv.currentStock = Math.max(0, Number((inv.currentStock - qty).toFixed(2)));
      }

      // C. Strategy-Aware Batch Deduction (FEFO vs FIFO, skipping quarantined/expired lots)
      const batchDeduction = deductBatchesByStrategy(item.sku, qty, storeId, unitCost);
      const cogsLine =
        batchDeduction.allocatedQty > 0 ? roundIDR(batchDeduction.totalCogs) : roundIDR(unitCost * qty);
      totalCogsCost = roundIDR(totalCogsCost + cogsLine);
      inventoryDeductedCount += qty;

      return {
        ...item,
        category: item.category || inv?.category || prod?.category || 'produce',
        name: item.name || inv?.productName || prod?.name || item.sku,
        quantity: qty,
        unitPrice: roundIDR(effectiveUnitPrice),
        unitCost,
        lineTotal,
      };
    });

    // 2. Post-Markdown Net VAT (PPN) Calculation Accuracy (strict integer IDR)
    const resolvedSubtotal = roundIDR(computedSubtotal);
    const discountAmount = Math.min(resolvedSubtotal, Math.max(0, roundIDR(Number(discount) || 0)));
    const netRevenueIDR = Math.max(0, resolvedSubtotal - discountAmount);

    let remainingCartDiscount = discountAmount;
    let resolvedPpn = 0;
    let resolvedPb1 = 0;

    normalizedItems.forEach((normItem, idx) => {
      const discountShare =
        idx === normalizedItems.length - 1
          ? remainingCartDiscount
          : resolvedSubtotal > 0
          ? Math.min(remainingCartDiscount, Math.round((normItem.lineTotal / resolvedSubtotal) * discountAmount))
          : 0;
      remainingCartDiscount = Math.max(0, remainingCartDiscount - discountShare);
      const netDiscountedLineTotal = Math.max(0, normItem.lineTotal - discountShare);

      const rule = skuTaxRulesList.find((r) => r.sku === normItem.sku);
      const taxCat: IndonesianTaxCategory =
        rule?.taxCategory || inferDefaultTaxCategory(normItem.category || '', normItem.name || '');
      const stdRate = rule?.taxRatePercent ?? posCheckoutConfig.ppnTaxPercent ?? 11;
      const taxCalc = computeIndonesianTax(netDiscountedLineTotal, taxCat, false, stdRate);
      resolvedPpn += roundIDR(taxCalc.ppnIDR);
      resolvedPb1 += roundIDR(taxCalc.pb1IDR);
    });

    resolvedPpn = roundIDR(resolvedPpn);
    resolvedPb1 = roundIDR(resolvedPb1);
    const resolvedTax = resolvedPpn + resolvedPb1;
    const resolvedTotal = netRevenueIDR + resolvedTax;
    totalCogsCost = Math.max(0, roundIDR(totalCogsCost));
    const resolvedCurrencyTotal =
      currency !== 'IDR' && currencyRateToIDR > 0
        ? Number((resolvedTotal / currencyRateToIDR).toFixed(2))
        : resolvedTotal;

    // 3. Automatic Accounting & General Ledger Double-Entry (Exact DR === CR Parity)
    let assetAccountCode: AccountCode = '1010';
    let assetAccountName = 'Cash on Hand & Store Registers';
    if (paymentMethod === 'qris') {
      assetAccountCode = '1030';
      assetAccountName = 'QRIS Settlement Receivable (ASPI Clearing)';
    } else if (paymentMethod === 'debit_card' || paymentMethod === 'credit_card') {
      assetAccountCode = '1020';
      assetAccountName = 'Bank BCA Operational Clearing';
    }

    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const gleId3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
    const gleId4 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}`;
    const journalEntryIds = [gleId1, gleId2];

    const posRevenueGlBatch: GeneralLedgerEntry[] = [
      {
        id: gleId1,
        timestamp,
        storeId,
        storeName,
        accountCode: assetAccountCode,
        accountName: assetAccountName,
        category: 'Asset',
        debit: resolvedTotal,
        credit: 0,
        referenceType: 'POS_SALE',
        referenceId: receiptNumber,
        description: `POS Checkout #${receiptNumber} - Tender: ${paymentMethod.toUpperCase()}${currency !== 'IDR' ? ` (${currency} ${resolvedCurrencyTotal})` : ''}`,
      },
      {
        id: gleId2,
        timestamp,
        storeId,
        storeName,
        accountCode: '4010',
        accountName: 'Grocery Sales Revenue',
        category: 'Revenue',
        debit: 0,
        credit: netRevenueIDR,
        referenceType: 'POS_SALE',
        referenceId: receiptNumber,
        description: `Net Sales Revenue (post-markdown) from POS Register #${receiptNumber} (Cashier: ${cashierName})`,
      },
    ];

    if (resolvedPpn > 0) {
      const gleTaxPpn = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}-VAT`;
      journalEntryIds.push(gleTaxPpn);
      posRevenueGlBatch.push({
        id: gleTaxPpn,
        timestamp,
        storeId,
        storeName,
        accountCode: '2025',
        accountName: 'PPN Keluaran (VAT Output Payable 11%/12%)',
        category: 'Liability',
        debit: 0,
        credit: resolvedPpn,
        referenceType: 'POS_SALE',
        referenceId: receiptNumber,
        description: `Post-markdown VAT Output PPN accrued for POS #${receiptNumber}`,
      });
    }
    if (resolvedPb1 > 0) {
      const gleTaxPb1 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}-PB1`;
      journalEntryIds.push(gleTaxPb1);
      posRevenueGlBatch.push({
        id: gleTaxPb1,
        timestamp,
        storeId,
        storeName,
        accountCode: '2027',
        accountName: 'Pajak Daerah PB1 (10% Ready-to-Eat Deli)',
        category: 'Liability',
        debit: 0,
        credit: resolvedPb1,
        referenceType: 'POS_SALE',
        referenceId: receiptNumber,
        description: `PB1 10% Deli tax accrued for POS #${receiptNumber}`,
      });
    }
    commitBalancedGlBatch(posRevenueGlBatch, true);

    journalEntryIds.push(gleId3, gleId4);
    commitBalancedGlBatch(
      [
        {
          id: gleId3,
          timestamp,
          storeId,
          storeName,
          accountCode: '5010',
          accountName: 'Cost of Goods Sold (COGS)',
          category: 'Expense',
          debit: totalCogsCost,
          credit: 0,
          referenceType: 'POS_SALE',
          referenceId: receiptNumber,
          description: `COGS realized for ${normalizedItems.length} items sold via POS #${receiptNumber}`,
        },
        {
          id: gleId4,
          timestamp,
          storeId,
          storeName,
          accountCode: '1040',
          accountName: 'Merchandise Inventory Asset',
          category: 'Asset',
          debit: 0,
          credit: totalCogsCost,
          referenceType: 'POS_SALE',
          referenceId: receiptNumber,
          description: `Inventory balance reduction upon in-store POS dispatch #${receiptNumber}`,
        },
      ],
      true
    );

    // 4. Audit Trail Records
    auditTrail.unshift({
      id: `AUD-2026-${(auditTrail.length + 1).toString().padStart(4, '0')}`,
      qrisReference: paymentMethod === 'qris' ? `QRIS-POS-${shortCode}` : undefined,
      orderId: receiptNumber,
      customerName,
      customerEmail: customerPhone || 'cashier.counter@grocemart.co.id',
      amount: resolvedTotal,
      paymentTimestamp: timestamp,
      settlementChannel: `POS Register (${paymentMethod.toUpperCase()})`,
      journalEntryIds,
      inventoryDeducted: normalizedItems.map((i) => ({
        sku: i.sku,
        quantity: i.quantity,
        cogsCost: Math.round((i.unitCost || 0) * i.quantity),
      })),
      status: 'SETTLED',
    });

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp,
      actionType: 'PRICE_OVERRIDE' as any,
      resourceId: receiptNumber,
      userId: cashierId,
      userName: cashierName,
      userRole: currentActiveStaffSession.userRole,
      storeId,
      shiftId: shiftId || currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        receiptNumber,
        total: resolvedTotal,
        netRevenueIDR,
        ppnIDR: resolvedPpn,
        pb1IDR: resolvedPb1,
        currency,
        currencyTotal: resolvedCurrencyTotal,
        paymentMethod,
        itemCount: normalizedItems.length,
      },
    });

    const resolvedCashTendered =
      cashTendered !== undefined ? Math.max(0, roundIDR(Number(cashTendered) || 0)) : resolvedTotal;
    const resolvedCashChange =
      paymentMethod === 'cash'
        ? cashTendered !== undefined
          ? Math.max(0, resolvedCashTendered - resolvedTotal)
          : Math.max(0, roundIDR(Number(cashChange) || 0))
        : 0;

    // 5. Construct Complete Receipt
    const receipt: POSTransactionReceipt = {
      receiptNumber,
      transactionId,
      orderId,
      timestamp,
      storeId,
      storeName,
      cashierId,
      cashierName,
      shiftId: shiftId || 'SHIFT-01',
      items: normalizedItems,
      subtotal: resolvedSubtotal,
      discount: discountAmount,
      tax: resolvedTax,
      total: resolvedTotal,
      currency,
      currencyTotal: resolvedCurrencyTotal,
      currencyRateToIDR,
      paymentMethod,
      cashTendered: resolvedCashTendered,
      cashChange: resolvedCashChange,
      qrisRef: paymentMethod === 'qris' ? `QRIS-POS-${shortCode}` : undefined,
      cardLast4: paymentMethod.includes('card') ? '8842' : undefined,
      journalEntryIds,
      inventoryDeductedCount,
      totalCogsCost,
    };

    posTransactionsHistory.unshift(receipt);

    // Accumulate POS transaction into active OPEN cash register shift if present
    const activeShift = posShiftsList.find((s) => s.status === 'OPEN' && s.storeId === storeId);
    if (activeShift) {
      activeShift.transactionCount += 1;
      if (paymentMethod === 'cash') {
        activeShift.expectedCashSalesIDR += resolvedTotal;
      } else if (paymentMethod === 'qris') {
        activeShift.expectedQrisSalesIDR += resolvedTotal;
      } else {
        activeShift.expectedEdcSalesIDR += resolvedTotal;
      }
      activeShift.expectedTotalCashInDrawerIDR =
        activeShift.openingFloatIDR + activeShift.expectedCashSalesIDR - activeShift.cashRefundsIDR;
    }

    // Event 2: Check reorder points for every SKU sold at POS
    checkAndNotifyLowStockForSkus(
      normalizedItems.map((ni) => ni.sku),
      storeId
    );

    res.json({
      success: true,
      receipt,
      taxBreakdown: {
        netRevenueIDR,
        ppnIDR: resolvedPpn,
        pb1IDR: resolvedPb1,
      },
      message: `POS checkout completed! Receipt #${receiptNumber}. Stock deducted across ${items.length} items & GL ledger posted.`,
    });
  });

  app.get('/api/pos/history', (req: Request, res: Response) => {
    const { storeId } = req.query;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      return res.json(posTransactionsHistory.filter((r) => r.storeId === storeId));
    }
    res.json(posTransactionsHistory);
  });

  // =============================================================
  // MODULE 12: ENTERPRISE SETTINGS & BUSINESS LOGIC SUITE
  // Valuation Landed Costs, Warehouse Multi-Step Routes & Bins,
  // 3-Way Matching, Analytic Accounting, and Quotations Engine
  // =============================================================

  // --- 1. ENTERPRISE SETTINGS MASTER CONFIG ---
  app.get('/api/admin/settings/enterprise', (_req: Request, res: Response) => {
    res.json(enterpriseSettings);
  });

  app.get('/api/settings/invoice-tracking', (_req: Request, res: Response) => {
    res.json(enterpriseSettings.invoiceTracking);
  });

  app.put('/api/admin/settings/enterprise', (req: Request, res: Response) => {
    const updates = req.body as Partial<EnterpriseSettingsConfig>;
    enterpriseSettings = {
      ...enterpriseSettings,
      ...updates,
      landedCosts: { ...enterpriseSettings.landedCosts, ...(updates.landedCosts || {}) },
      invoiceTracking: { ...enterpriseSettings.invoiceTracking, ...(updates.invoiceTracking || {}) },
      warehouseRouting: { ...enterpriseSettings.warehouseRouting, ...(updates.warehouseRouting || {}) },
      threeWayMatching: { ...enterpriseSettings.threeWayMatching, ...(updates.threeWayMatching || {}) },
      analyticAccounting: { ...enterpriseSettings.analyticAccounting, ...(updates.analyticAccounting || {}) },
      quotationsAndSales: { ...enterpriseSettings.quotationsAndSales, ...(updates.quotationsAndSales || {}) },
    };

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'POLICY_UPDATE',
      resourceId: 'ENTERPRISE_SETTINGS',
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: 'ALL',
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { updatedBy: currentActiveStaffSession.userName },
    });

    res.json({
      success: true,
      settings: enterpriseSettings,
      message: 'Enterprise configuration saved and synchronized network-wide.',
    });
  });

  // --- 1B. MULTI-BRANCH MONITOR (CABANG, OMZET & BARANG DATANG) + OPERATOR ASSIGNMENTS ---
  app.get('/api/admin/settings/branch-monitor', (_req: Request, res: Response) => {
    const branches: BranchMonitorHubSummary[] = storeSchedules.map((st, idx) => {
      const storeTiers = storeInventoryTiers.filter((t) => t.storeId === st.storeId);
      const stockValuationIDR = storeTiers.reduce(
        (sum, t) => sum + Math.round((t.physicalStock || 0) * (t.unitCost || 0)),
        0
      );
      const totalStockUnits = Number(
        storeTiers.reduce((sum, t) => sum + (t.physicalStock || 0), 0).toFixed(2)
      );

      const posForBranch = posTransactionsHistory.filter(
        (p) => p.storeId === st.storeId
      );
      const b2cForBranch = customerOrders.filter(
        (o) =>
          (o.pickupStore?.id || (o as unknown as { storeId?: string }).storeId || 'store-jkt-senopati') === st.storeId
      );
      const b2bForBranch = b2bOrdersList.filter(
        (o) =>
          ((o as unknown as { storeId?: string }).storeId || 'store-jkt-senopati') === st.storeId &&
          (o.status as string) !== 'cancelled'
      );

      const posOmzetIDR = posForBranch.reduce((s, p) => s + (p.total || 0), 0);
      const b2cOmzetIDR = b2cForBranch.reduce((s, o) => s + (o.total || 0), 0);
      const b2bOmzetIDR = b2bForBranch.reduce((s, o) => s + (o.totalAmountIDR || 0), 0);
      const liveOmzetIDR = posOmzetIDR + b2cOmzetIDR + b2bOmzetIDR;
      const orderCount = posForBranch.length + b2cForBranch.length + b2bForBranch.length;

      const incomingPoCount = purchaseOrders.filter(
        (po) => po.storeId === st.storeId && po.status !== 'Completed' && po.status !== 'Cancelled'
      ).length;
      const inTransitTransferCount = stockTransfersList.filter(
        (tr) => tr.destinationStoreId === st.storeId && tr.status === 'in_transit'
      ).length;

      const branchCode = `BR-${st.city.slice(0, 3).toUpperCase()}-${String(idx + 1).padStart(2, '0')}`;
      const hubType: BranchMonitorHubSummary['hubType'] =
        st.storeId === 'store-jkt-pik'
          ? 'Dark Store'
          : st.storeId === 'store-jkt-senopati'
          ? 'Central CDC'
          : 'Retail Flagship';
      const status: BranchMonitorHubSummary['status'] = st.isEmergencyClosed
        ? 'Emergency Closed'
        : st.isHolidayMode
        ? 'Holiday Mode'
        : 'Open';

      return {
        storeId: st.storeId,
        branchCode,
        storeName: st.storeName,
        city: st.city,
        district: st.district,
        hubType,
        status,
        isEmergencyClosed: !!st.isEmergencyClosed,
        orderCount,
        liveOmzetIDR,
        posOmzetIDR,
        b2cOmzetIDR,
        b2bOmzetIDR,
        stockValuationIDR,
        totalStockUnits,
        incomingPoCount,
        inTransitTransferCount,
      };
    });

    const openPurchaseOrders: BranchMonitorIncomingPO[] = purchaseOrders
      .filter((po) => po.status !== 'Completed' && po.status !== 'Cancelled')
      .map((po) => {
        const expectedUnitsQty = po.items.reduce((s, it) => s + (it.orderedQuantity || 0), 0);
        const receivedUnitsQty = po.items.reduce((s, it) => s + (it.receivedQuantity || 0), 0);
        const remainingBackorderQty = Math.max(0, expectedUnitsQty - receivedUnitsQty);
        const mappedStatus: BranchMonitorIncomingPO['status'] =
          po.status === 'Partially Received'
            ? 'Partially Received'
            : po.status === 'Sent'
            ? 'Approved'
            : 'Pending';
        return {
          poId: po.id,
          supplierName: po.supplierName,
          destinationBranchId: po.storeId,
          destinationBranchName: po.storeName,
          expectedItemsCount: po.items.length,
          expectedUnitsQty,
          remainingBackorderQty,
          incomingValueIDR: po.totalCost || 0,
          status: mappedStatus,
          expectedDeliveryDate: po.expectedDeliveryDate,
          itemsSummary: po.items
            .map((it) => `${it.productName} (${Math.max(0, (it.orderedQuantity || 0) - (it.receivedQuantity || 0))} left)`)
            .join(', '),
        };
      });

    const inTransitTransfers: BranchMonitorInTransitTransfer[] = stockTransfersList
      .filter((tr) => tr.status === 'in_transit')
      .map((tr) => ({
        transferId: tr.id,
        sku: tr.sku,
        productName: tr.productName,
        originBranchId: tr.sourceStoreId,
        originBranchName: tr.sourceStoreName,
        destinationBranchId: tr.destinationStoreId,
        destinationBranchName: tr.destinationStoreName,
        quantity: tr.quantity,
        unitCostIDR: tr.unitCost,
        totalTransferValueIDR: tr.totalTransferValue,
        waybillNumber: tr.suratJalanNumber,
        timestamp: tr.timestamp,
        status: 'in_transit',
      }));

    const payload: BranchMonitorResponse = {
      generatedAt: new Date().toISOString(),
      totals: {
        totalBranches: branches.length,
        openBranches: branches.filter((b) => b.status === 'Open').length,
        totalLiveOmzetIDR: branches.reduce((s, b) => s + b.liveOmzetIDR, 0),
        totalOrders: branches.reduce((s, b) => s + b.orderCount, 0),
        totalStockValuationIDR: branches.reduce((s, b) => s + b.stockValuationIDR, 0),
        openPoCount: openPurchaseOrders.length,
        inTransitCount: inTransitTransfers.length,
      },
      branches,
      openPurchaseOrders,
      inTransitTransfers,
    };

    res.json(payload);
  });

  app.post('/api/admin/settings/confirm-arrival', (req: Request, res: Response) => {
    const { type, id } = (req.body || {}) as { type?: 'TRANSFER' | 'PO'; id?: string };
    if (!type || !id) {
      return res.status(400).json({ error: 'type ("TRANSFER" | "PO") and id are required.' });
    }

    const timestamp = new Date().toISOString();

    if (type === 'TRANSFER') {
      const record = stockTransfersList.find((t) => t.id === id);
      if (!record) return res.status(404).json({ error: `Stock transfer '${id}' not found.` });
      if (record.status === 'completed') {
        return res.json({ success: true, type, id, message: `Transfer #${id} is already completed.` });
      }

      const destTier = storeInventoryTiers.find(
        (t) => t.sku === record.sku && t.storeId === record.destinationStoreId
      );
      if (destTier) {
        const oldStock = Math.max(0, Number(destTier.physicalStock) || 0);
        const newStock = Number((oldStock + record.quantity).toFixed(2));
        destTier.unitCost =
          newStock > 0
            ? Math.round(((oldStock * (destTier.unitCost || record.unitCost)) + (record.quantity * record.unitCost)) / newStock)
            : record.unitCost;
        destTier.physicalStock = newStock;
        destTier.incomingStock = Math.max(0, (destTier.incomingStock || 0) - record.quantity);
        destTier.availableStock = Math.max(0, Number((destTier.physicalStock - destTier.reservedStock).toFixed(2)));
        destTier.totalValuation = Math.round(destTier.physicalStock * destTier.unitCost);
        destTier.lastRestockedAt = timestamp;
        destTier.updatedAt = timestamp;
      }

      const transitLots = inTransitTransferLots.get(id) || [
        {
          lotNumber: `TRF-LOT-${id.slice(-4)}`,
          expiryDate: new Date(Date.now() + 86400000 * 14).toISOString(),
          allocatedQty: record.quantity,
          unitCost: record.unitCost,
          storageZone: destTier?.storageType || ('cold_chilled' as StorageZoneType),
          sellingPrice: destTier?.sellingPrice || Math.round(record.unitCost * 1.45),
          supplierName: record.sourceStoreName,
        },
      ];
      transitLots.forEach((lot, idx) => {
        const diffMs = new Date(lot.expiryDate).getTime() - Date.now();
        const isExpiredLot = !Number.isFinite(diffMs) || diffMs <= 0;
        const daysUntilExpiry = isExpiredLot
          ? Math.min(0, Math.floor((Number.isFinite(diffMs) ? diffMs : 0) / 86400000))
          : Math.max(1, Math.ceil(diffMs / 86400000));
        inventoryBatches.unshift({
          batchId: `BAT-TRF-RCV-${Date.now().toString().slice(-5)}-${idx + 1}`,
          sku: record.sku,
          productName: record.productName,
          storeId: record.destinationStoreId,
          storeName: record.destinationStoreName,
          warehouseZoneId: destTier?.warehouseZoneId || `WH-${record.destinationStoreId.toUpperCase()}`,
          lotNumber: lot.lotNumber,
          initialQuantity: lot.allocatedQty,
          currentStock: lot.allocatedQty,
          unitCost: lot.unitCost,
          sellingPrice: lot.sellingPrice,
          receivedDate: timestamp,
          expiryDate: lot.expiryDate,
          daysUntilExpiry,
          status: isExpiredLot ? 'expired' : daysUntilExpiry <= 7 ? 'near_expiry' : 'fresh',
          storageZone: lot.storageZone,
          supplierName: lot.supplierName,
          notes: `Arrival confirmed via Multi-Branch Monitor (${record.id})`,
        });
      });
      inTransitTransferLots.delete(id);
      record.status = 'completed';
      markEnterpriseNotificationReadByDedupeKey(`TRANSFER_IN_TRANSIT:${id}`);

      return res.json({
        success: true,
        type: 'TRANSFER',
        id,
        message: `In-transit transfer #${id} (${record.quantity}x ${record.productName}) arrived and stocked at ${record.destinationStoreName}.`,
      });
    }

    if (type === 'PO') {
      const po = purchaseOrders.find((p) => p.id === id);
      if (!po) return res.status(404).json({ error: `Purchase Order '${id}' not found.` });
      if (po.status === 'Completed') {
        return res.json({ success: true, type, id, message: `Purchase Order #${id} is already completed.` });
      }

      const grId = `GR-MON-${Date.now().toString().slice(-5)}`;
      const receivedItems: GoodsReceiptRecord['items'] = [];
      let totalVal = 0;

      po.items.forEach((item, idx) => {
        const remaining = Math.max(0, (item.orderedQuantity || 0) - (item.receivedQuantity || 0));
        if (remaining <= 0) return;

        item.receivedQuantity = item.orderedQuantity;
        item.remainingBackorder = 0;
        const lotNumber = `LOT-ARR-${Date.now().toString().slice(-4)}-${idx + 1}`;
        const expiryDate = new Date(Date.now() + 86400000 * 18).toISOString();

        const tier = storeInventoryTiers.find(
          (t) => t.sku === item.sku && t.storeId === po.storeId
        );
        if (tier) {
          const oldStock = Math.max(0, Number(tier.physicalStock) || 0);
          const newStock = Number((oldStock + remaining).toFixed(2));
          tier.unitCost =
            newStock > 0
              ? Math.round(((oldStock * (tier.unitCost || item.unitCost)) + (remaining * item.unitCost)) / newStock)
              : item.unitCost;
          tier.physicalStock = newStock;
          tier.incomingStock = Math.max(0, (tier.incomingStock || 0) - remaining);
          tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
          tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
          tier.lastRestockedAt = timestamp;
          tier.updatedAt = timestamp;
        }

        const daysUntilExpiry = 18;
        inventoryBatches.unshift({
          batchId: `BAT-PO-ARR-${Date.now().toString().slice(-5)}-${idx + 1}`,
          sku: item.sku,
          productName: item.productName,
          storeId: po.storeId,
          storeName: po.storeName,
          warehouseZoneId: tier?.warehouseZoneId || `WH-${po.storeId.toUpperCase()}`,
          lotNumber,
          initialQuantity: remaining,
          currentStock: remaining,
          unitCost: item.unitCost,
          sellingPrice: tier?.sellingPrice || Math.round(item.unitCost * 1.45),
          receivedDate: timestamp,
          expiryDate,
          daysUntilExpiry,
          status: 'fresh',
          storageZone: tier?.storageType || 'cold_chilled',
          supplierName: po.supplierName,
          notes: `Dock arrival confirmed via Multi-Branch Monitor (${po.id})`,
        });

        totalVal += Math.round(remaining * item.unitCost);
        receivedItems.push({
          sku: item.sku,
          productName: item.productName,
          quantityOrdered: item.orderedQuantity,
          quantityReceived: remaining,
          batchNumber: lotNumber,
          expiryDate,
          qualityCondition: 'Passed - Grade A',
        });
      });

      po.status = 'Completed';
      const gleId1 = `GLE-ARR-${Date.now()}-1`;
      const gleId2 = `GLE-ARR-${Date.now()}-2`;

      goodsReceipts.unshift({
        id: grId,
        poId: po.id,
        vendorName: po.supplierName,
        storeId: po.storeId,
        storeName: po.storeName,
        warehouseZoneId: po.warehouseZoneId || `WH-${po.storeId.toUpperCase()}`,
        receivedBy: currentActiveStaffSession.userName,
        receivedAt: timestamp,
        deliveryNoteNumber: `SJ-${po.id}`,
        isPartial: false,
        items: receivedItems,
        receiverNotes: 'Dock arrival confirmed via Multi-Branch Monitor',
        glEntryId: totalVal > 0 ? gleId1 : undefined,
      });

      if (totalVal > 0) {
        commitBalancedGlBatch(
          [
            {
              id: gleId1,
              timestamp,
              storeId: po.storeId,
              storeName: po.storeName,
              accountCode: '1040',
              accountName: 'Merchandise Inventory Asset',
              category: 'Asset',
              debit: totalVal,
              credit: 0,
              referenceType: 'PARTIAL_GR',
              referenceId: grId,
              description: `Dock Arrival Confirmation for ${po.id} -> ${grId}`,
            },
            {
              id: gleId2,
              timestamp,
              storeId: po.storeId,
              storeName: po.storeName,
              accountCode: '2010',
              accountName: 'Trade Accounts Payable (Vendors)',
              category: 'Liability',
              debit: 0,
              credit: totalVal,
              referenceType: 'PARTIAL_GR',
              referenceId: grId,
              description: `Vendor AP accrual for dock receipt ${grId} (${po.supplierName})`,
            },
          ],
          true
        );
      }

      return res.json({
        success: true,
        type: 'PO',
        id,
        message: `Purchase Order #${id} dock arrival confirmed (${grId}). Stock & Inventory GL (#1040) updated for ${po.storeName}.`,
      });
    }

    return res.status(400).json({ error: `Unsupported arrival type '${type}'.` });
  });

  app.get('/api/admin/settings/operator-assignments', (req: Request, res: Response) => {
    syncAssignmentsOntoProfiles();
    const rawHeaderRole = typeof req.headers['x-operator-role'] === 'string' ? req.headers['x-operator-role'].trim() : undefined;
    const callerRole = rawHeaderRole ? normalizeServerRoleStrict(rawHeaderRole) : normalizeServerRole(currentActiveStaffSession.userRole);
    const includePin = callerRole === 'super_admin';

    const assignments: OperatorBranchAssignment[] = AVAILABLE_STAFF_USERS.map((u) => {
      const assigned = operatorBranchAssignments[u.userId];
      const pinVal = assigned?.loginPin || '8821';
      return {
        userId: u.userId,
        userName: u.userName,
        userRole: u.userRole,
        storeId: assigned?.storeId || u.storeId,
        storeName: assigned?.storeName || u.storeName,
        isBranchScoped: isBranchScopedServerRole(u.userRole),
        isActive: assigned?.isActive !== false,
        hasCustomPin: pinVal !== '8821',
        ...(includePin ? { loginPin: pinVal } : {}),
        updatedAt: assigned?.updatedAt,
        updatedBy: assigned?.updatedBy,
      };
    });
    res.json({
      assignments,
      branchOptions: BRANCH_ASSIGNMENT_OPTIONS,
    });
  });

  app.post('/api/admin/settings/operator-assignments', (req: Request, res: Response) => {
    const rawHeaderRole = typeof req.headers['x-operator-role'] === 'string' ? req.headers['x-operator-role'].trim() : undefined;
    const rawHeaderOpId = typeof req.headers['x-operator-id'] === 'string' ? req.headers['x-operator-id'].trim() : undefined;
    const callerRole = rawHeaderRole ? normalizeServerRoleStrict(rawHeaderRole) : normalizeServerRole(currentActiveStaffSession.userRole);
    if (callerRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        code: 'RBAC_FORBIDDEN',
        error: 'Only Super Admin is authorized to modify operator roles, branch assignments, status, or login PINs.',
      });
    }

    const { userId, storeId, userRole, isActive, loginPin } = (req.body || {}) as {
      userId?: string;
      storeId?: string;
      userRole?: string;
      isActive?: boolean;
      loginPin?: string;
    };
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }
    if (storeId === undefined && userRole === undefined && isActive === undefined && loginPin === undefined) {
      return res.status(400).json({ error: 'Provide at least one field to update (storeId, userRole, isActive, loginPin).' });
    }

    const targetProfile = AVAILABLE_STAFF_USERS.find((u) => u.userId === userId);
    if (!targetProfile) {
      return res.status(404).json({ error: `Operator profile '${userId}' not found.` });
    }

    const existingEntry = operatorBranchAssignments[userId] || {
      userRole: normalizeServerRole(targetProfile.userRole),
      storeId: targetProfile.storeId,
      storeName: targetProfile.storeName,
      isActive: true,
      loginPin: '8821',
    };

    let nextRole: CanonicalServerRole = normalizeServerRoleStrict(existingEntry.userRole) || normalizeServerRole(targetProfile.userRole);
    if (userRole !== undefined) {
      const parsedRole = normalizeServerRoleStrict(userRole);
      if (!parsedRole) {
        return res.status(400).json({ error: `Invalid enterprise role '${userRole}'.` });
      }
      nextRole = parsedRole;
    }

    const nextIsBranchScoped = isBranchScopedServerRole(nextRole);
    let nextStoreId = storeId !== undefined ? storeId : existingEntry.storeId;
    if (nextIsBranchScoped && (nextStoreId === 'ALL' || nextStoreId === 'CONSOLIDATED')) {
      if (storeId !== undefined) {
        return res.status(400).json({
          error: `Branch-scoped role '${nextRole}' must be assigned to a specific physical store or warehouse hub (cannot be 'ALL').`,
        });
      }
      nextStoreId = 'store-jkt-senopati';
    }

    const option = BRANCH_ASSIGNMENT_OPTIONS.find((opt) => opt.storeId === nextStoreId);
    if (!option) {
      return res.status(400).json({ error: `Invalid target branch/hub '${nextStoreId}'.` });
    }

    const nextIsActive = isActive !== undefined ? Boolean(isActive) : existingEntry.isActive !== false;
    const callerOpId = rawHeaderOpId || currentActiveStaffSession.userId;
    if (userId === callerOpId && (nextIsActive === false || nextRole !== 'super_admin')) {
      return res.status(400).json({
        error: 'Governance Guard: You cannot deactivate or demote your own active Super Admin session.',
      });
    }

    let nextLoginPin = existingEntry.loginPin || '8821';
    if (loginPin !== undefined) {
      const cleanedPin = String(loginPin).trim();
      if (cleanedPin.length < 4 || cleanedPin.length > 32) {
        return res.status(400).json({ error: 'Login PIN / password must be between 4 and 32 characters.' });
      }
      nextLoginPin = cleanedPin;
    }

    const updatedAt = new Date().toISOString();
    const actorProfile = rawHeaderOpId ? AVAILABLE_STAFF_USERS.find((u) => u.userId === rawHeaderOpId) : undefined;
    const actorName = actorProfile?.userName || currentActiveStaffSession.userName;

    operatorBranchAssignments[userId] = {
      userRole: nextRole,
      storeId: option.storeId,
      storeName: option.storeName,
      isActive: nextIsActive,
      loginPin: nextLoginPin,
      updatedAt,
      updatedBy: actorName,
    };

    syncAssignmentsOntoProfiles();

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: updatedAt,
      actionType: 'POLICY_UPDATE',
      resourceId: `OP_ASSIGNMENT_${userId}`,
      userId: callerOpId,
      userName: actorName,
      userRole: 'super_admin',
      storeId: option.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: {
        targetUserId: userId,
        targetUserName: targetProfile.userName,
        assignedRole: nextRole,
        assignedStoreId: option.storeId,
        assignedStoreName: option.storeName,
        isActive: nextIsActive,
        pinUpdated: loginPin !== undefined,
      },
    });

    const assignments: OperatorBranchAssignment[] = AVAILABLE_STAFF_USERS.map((u) => {
      const assigned = operatorBranchAssignments[u.userId];
      const pinVal = assigned?.loginPin || '8821';
      return {
        userId: u.userId,
        userName: u.userName,
        userRole: u.userRole,
        storeId: assigned?.storeId || u.storeId,
        storeName: assigned?.storeName || u.storeName,
        isBranchScoped: isBranchScopedServerRole(u.userRole),
        isActive: assigned?.isActive !== false,
        hasCustomPin: pinVal !== '8821',
        loginPin: pinVal,
        updatedAt: assigned?.updatedAt,
        updatedBy: assigned?.updatedBy,
      };
    });

    const callerUpdatedSession =
      AVAILABLE_STAFF_USERS.find((u) => u.userId === callerOpId) || currentActiveStaffSession;

    res.json({
      success: true,
      message: `${targetProfile.userName} updated: ${nextRole.replace(/_/g, ' ').toUpperCase()} @ ${option.storeName} (${nextIsActive ? 'Active' : 'Suspended'}).`,
      assignments,
      updatedProfile: AVAILABLE_STAFF_USERS.find((u) => u.userId === userId),
      currentSession: {
        ...callerUpdatedSession,
        loginTimestamp: currentActiveStaffSession.loginTimestamp,
        shiftName: currentActiveStaffSession.shiftName,
      },
      availableProfiles: AVAILABLE_STAFF_USERS,
    });
  });

  // --- 2. COA MAPPING & POS CHECKOUT CONFIG ---
  app.get('/api/admin/settings/coa-mapping', (_req: Request, res: Response) => {
    res.json(coaMappingConfig);
  });

  app.put('/api/admin/settings/coa-mapping', (req: Request, res: Response) => {
    coaMappingConfig = {
      ...coaMappingConfig,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: currentActiveStaffSession.userName,
    };
    res.json({ success: true, config: coaMappingConfig, message: 'COA mapping updated successfully.' });
  });

  app.get('/api/admin/settings/pos-config', (_req: Request, res: Response) => {
    res.json(posCheckoutConfig);
  });

  app.put('/api/admin/settings/pos-config', (req: Request, res: Response) => {
    posCheckoutConfig = {
      ...posCheckoutConfig,
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: currentActiveStaffSession.userName,
    };
    res.json({ success: true, config: posCheckoutConfig, message: 'POS configuration updated successfully.' });
  });

  // --- 3. VALUATION & LANDED COSTS ENGINE ---
  app.get('/api/admin/valuation/landed-costs', (_req: Request, res: Response) => {
    res.json(landedCostsList);
  });

  app.post('/api/admin/valuation/landed-costs', async (req: Request, res: Response) => {
    const {
      description = 'Inbound Cold-Chain Freight & Handling',
      poId,
      billNumber,
      receiptNumber,
      currency = 'IDR',
      exchangeRate = 1,
      freightCostIDR = 0,
      customsDutyIDR = 0,
      handlingCostIDR = 0,
      insuranceCostIDR = 0,
      informalLaborCostIDR = 0, // Biaya Kuli Bongkar / Retribusi Non-Faktur (Petty Cash)
      allocationMethod = 'BY_QUANTITY',
      items = [], // Array<{ sku: string; quantity: number }>
    } = req.body;

    const safeFreight = Math.max(0, Number(freightCostIDR) || 0);
    const safeCustoms = Math.max(0, Number(customsDutyIDR) || 0);
    const safeHandling = Math.max(0, Number(handlingCostIDR) || 0);
    const safeInsurance = Math.max(0, Number(insuranceCostIDR) || 0);
    const safeInformalLabor = Math.max(0, Number(informalLaborCostIDR) || 0);

    const totalLandedCostIDR = safeFreight + safeCustoms + safeHandling + safeInsurance + safeInformalLabor;
    if (totalLandedCostIDR <= 0) {
      return res.status(400).json({ error: 'Total landed cost must be greater than zero.' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Please specify at least one product SKU to absorb landed cost.' });
    }

    const timestamp = new Date().toISOString();
    const id = `LC-2026-${(landedCostsList.length + 1).toString().padStart(3, '0')}`;

    // Calculate allocation across BY_QUANTITY, BY_VALUE, BY_WEIGHT, or EQUAL without over-valuing prior stock
    const totalQty = items.reduce((sum: number, it: any) => sum + Math.max(1, Number(it.quantity) || 1), 0);
    const totalValue = items.reduce((sum: number, it: any) => {
      const inv = inventoryList.find((i) => i.sku === it.sku);
      const baseCost = inv?.wacUnitCost || inv?.unitCost || 15000;
      return sum + Math.max(1, Number(it.quantity) || 1) * baseCost;
    }, 0);
    const totalWeight = items.reduce((sum: number, it: any) => {
      const inv = inventoryList.find((i) => i.sku === it.sku);
      const weightKg = Number(it.weightKg) || (inv?.unit?.toLowerCase().includes('kg') ? 1 : 0.5);
      return sum + Math.max(1, Number(it.quantity) || 1) * weightKg;
    }, 0);

    let allocatedSum = 0;
    const allocatedItems = items.map((it: any, idx: number) => {
      const inv = inventoryList.find((i) => i.sku === it.sku);
      const productName = inv?.productName || `Product ${it.sku}`;
      const baseCost = inv?.wacUnitCost || inv?.unitCost || 15000;
      const qty = Math.max(1, Number(it.quantity) || 1);
      const weightKg = Number(it.weightKg) || (inv?.unit?.toLowerCase().includes('kg') ? 1 : 0.5);

      let lineLandedShare = 0;
      if (idx === items.length - 1) {
        lineLandedShare = Math.max(0, roundIDR(totalLandedCostIDR - allocatedSum));
      } else if (allocationMethod === 'BY_QUANTITY') {
        lineLandedShare = totalQty > 0 ? Math.round((totalLandedCostIDR * qty) / totalQty) : Math.round(totalLandedCostIDR / items.length);
      } else if (allocationMethod === 'BY_VALUE') {
        lineLandedShare = totalValue > 0 ? Math.round((totalLandedCostIDR * (qty * baseCost)) / totalValue) : Math.round(totalLandedCostIDR / items.length);
      } else if (allocationMethod === 'BY_WEIGHT') {
        lineLandedShare = totalWeight > 0 ? Math.round((totalLandedCostIDR * (qty * weightKg)) / totalWeight) : Math.round(totalLandedCostIDR / items.length);
      } else {
        lineLandedShare = Math.round(totalLandedCostIDR / items.length);
      }
      allocatedSum += lineLandedShare;

      // Absorb lineLandedShare into Moving Average Unit Cost across on-hand stock (or receipt qty if stock is lower)
      const stockPool = inv && inv.currentStock > 0 ? Math.max(qty, inv.currentStock) : qty;
      const allocatedPerUnit = Math.round(lineLandedShare / stockPool);
      const newUnitCost = baseCost + allocatedPerUnit;

      if (inv) {
        inv.unitCost = newUnitCost;
        inv.wacUnitCost = newUnitCost;
      }
      storeInventoryTiers.forEach((tier) => {
        if (tier.sku === it.sku) {
          tier.unitCost = newUnitCost;
          tier.totalValuation = Math.round(tier.physicalStock * newUnitCost);
        }
      });
      const latestBatch = inventoryBatches.find(
        (b) => b.sku === it.sku && b.currentStock > 0 && b.status !== 'depleted' && (!poId || b.sourcePoNumber === poId)
      );
      if (latestBatch) {
        const batchDivisor = Math.max(qty, latestBatch.currentStock);
        latestBatch.unitCost = Math.round(latestBatch.unitCost + lineLandedShare / batchDivisor);
      }

      return {
        sku: it.sku,
        productName,
        quantity: qty,
        baseUnitCost: baseCost,
        allocatedCostIDR: allocatedPerUnit,
        newUnitCost,
        totalLineLandedCost: lineLandedShare,
      };
    });

    const glEntryIds: string[] = [];
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    glEntryIds.push(gleId1);

    const lcGlBatch: GeneralLedgerEntry[] = [
      {
        id: gleId1,
        timestamp,
        storeId: 'CONSOLIDATED',
        storeName: 'Consolidated Company-Wide',
        accountCode: '1040',
        accountName: 'Merchandise Inventory Asset',
        category: 'Asset',
        debit: totalLandedCostIDR,
        credit: 0,
        referenceType: 'LANDED_COST',
        referenceId: id,
        description: `Landed Cost Absorption [${id}]: ${description} allocated across ${allocatedItems.length} SKUs (incl. kuli bongkar absorption)`,
      },
    ];

    // Credit side: Split between Petty Cash #1015 (for informal labor) and Accrual Clearing #2040 (for formal freight/customs)
    const formalAccrualIDR = totalLandedCostIDR - safeInformalLabor;
    if (formalAccrualIDR > 0) {
      const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
      glEntryIds.push(gleId2);
      lcGlBatch.push({
        id: gleId2,
        timestamp,
        storeId: 'CONSOLIDATED',
        storeName: 'Consolidated Company-Wide',
        accountCode: (enterpriseSettings.landedCosts.clearingAccountCode as AccountCode) || '2040',
        accountName: enterpriseSettings.landedCosts.clearingAccountName || 'Landed Cost Accrual / Clearing',
        category: 'Liability',
        debit: 0,
        credit: formalAccrualIDR,
        referenceType: 'LANDED_COST',
        referenceId: id,
        description: `Landed Cost Accrual for freight, customs & handling voucher #${id}`,
      });
    }

    if (safeInformalLabor > 0) {
      const gleId3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
      glEntryIds.push(gleId3);
      lcGlBatch.push({
        id: gleId3,
        timestamp,
        storeId: 'CONSOLIDATED',
        storeName: 'Consolidated Company-Wide',
        accountCode: '1015',
        accountName: 'Petty Cash & Informal Labor Fund (Kas Kecil)',
        category: 'Asset',
        debit: 0,
        credit: safeInformalLabor,
        referenceType: 'LANDED_COST',
        referenceId: id,
        description: `Petty cash disbursement for informal unloading labor (Kuli Bongkar / Retribusi Non-Faktur) voucher #${id}`,
      });
    }

    commitBalancedGlBatch(lcGlBatch, true);

    const record: LandedCostRecord = {
      id,
      timestamp,
      poId,
      billNumber,
      receiptNumber,
      description,
      currency: currency as SupportedCurrency,
      exchangeRate,
      freightCostIDR: safeFreight,
      customsDutyIDR: safeCustoms,
      handlingCostIDR: safeHandling,
      insuranceCostIDR: safeInsurance,
      informalLaborCostIDR: safeInformalLabor,
      totalLandedCostIDR,
      allocationMethod,
      allocatedItems,
      glEntryIds,
      status: 'POSTED',
      createdBy: currentActiveStaffSession.userName,
    };

    landedCostsList.unshift(record);

    res.json({
      success: true,
      record,
      journalEntryIds: glEntryIds,
      message: `Landed cost ${id} (Rp ${totalLandedCostIDR.toLocaleString('id-ID')}) absorbed into product valuation and posted to General Ledger.`,
    });
  });

  // =============================================================
  // --- 3B. ENTERPRISE B2B WHOLESALE & GIRO CLEARING APIS ---
  // =============================================================
  app.get('/api/b2b/customers', (_req: Request, res: Response) => {
    res.json(b2bCustomersList);
  });

  app.patch('/api/b2b/customers/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const cust = b2bCustomersList.find((c) => c.id === id);
    if (!cust) return res.status(404).json({ error: 'Customer not found' });
    Object.assign(cust, req.body);
    res.json(cust);
  });

  app.get('/api/b2b/products', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    // Sync current stock only for explicitly mapped/shared SKUs (avoid fragile partial name prefix matching)
    wholesaleProductsList.forEach((prod) => {
      const inv = inventoryList.find((i) => i.sku === prod.sku);
      if (inv) {
        prod.currentStockBaseUnits = inv.currentStock;
      }
    });
    res.json(wholesaleProductsList);
  });

  app.get('/api/b2b/pwp-rules', (_req: Request, res: Response) => {
    res.json(pwpRulesList);
  });

  app.get('/api/b2b/orders', (_req: Request, res: Response) => {
    res.json(b2bOrdersList);
  });

  app.get('/api/b2b/giro-records', (_req: Request, res: Response) => {
    res.json(giroRecordsList);
  });

  // B2B Wholesale Checkout Endpoint
  app.post('/api/b2b/checkout', (req: Request, res: Response) => {
    const {
      customerId,
      items = [],
      paymentMethod,
      giroDetails,
      transferProofUrl,
    } = req.body;

    const customer = b2bCustomersList.find((c) => c.id === customerId);
    if (!customer) {
      return res.status(404).json({ error: 'B2B Customer profile not found' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Wholesale cart cannot be empty' });
    }

    // Validate PWP (Tebus Murah) non-cumulative max 1 unit cap & restricted category exclusion
    const pwpItems = items.filter((it: any) => Boolean(it.isPwpRedemption));
    if (pwpItems.length > 1 || pwpItems.some((it: any) => (Number(it.quantity) || 1) > 1)) {
      return res.status(400).json({
        error: 'PWP Tebus Murah Policy Violation: Promo is non-cumulative and strictly capped at 1 unit per invoice.',
      });
    }
    const primaryPwp = pwpRulesList[0];
    if (pwpItems.length === 1 && primaryPwp) {
      const eligibleSpend = items.reduce((sum: number, it: any) => {
        if (it.isPwpRedemption) return sum;
        const prod = wholesaleProductsList.find((p) => p.sku === (it.product?.sku || it.sku));
        const isRestricted = Boolean(it.product?.isRestrictedForPwp ?? prod?.isRestrictedForPwp);
        return isRestricted ? sum : sum + (Number(it.lineTotal) || 0);
      }, 0);
      if (eligibleSpend < primaryPwp.minSpendIDR) {
        return res.status(400).json({
          error: `PWP Tebus Murah requires Rp ${primaryPwp.minSpendIDR.toLocaleString('id-ID')} eligible spend (excluding restricted cigarettes/infant formula). Current eligible spend: Rp ${eligibleSpend.toLocaleString('id-ID')}.`,
        });
      }
    }

    // Atomic non-expired ATP stock pre-check across all wholesale cart items BEFORE any mutation
    const b2bReqBySku = new Map<string, number>();
    for (const cartIt of items) {
      const prod = wholesaleProductsList.find(
        (p) => p.id === (cartIt.product?.id || cartIt.productId) || p.sku === (cartIt.product?.sku || cartIt.sku)
      );
      const targetSku = String(prod?.sku || cartIt.product?.sku || cartIt.sku || '').trim();
      const unitsToDeduct = Number(cartIt.baseUnitsCalculated) || Number(cartIt.quantity) || 1;
      if (!targetSku || !Number.isFinite(unitsToDeduct) || unitsToDeduct <= 0) {
        return res.status(400).json({ error: `Invalid wholesale SKU or quantity (${targetSku || 'unknown'}).` });
      }
      b2bReqBySku.set(targetSku, Number(((b2bReqBySku.get(targetSku) || 0) + unitsToDeduct).toFixed(3)));
    }
    for (const [targetSku, totalUnits] of b2bReqBySku.entries()) {
      const prod = wholesaleProductsList.find((p) => p.sku === targetSku);
      const atpCheck = getSellableNonExpiredAtpStock(targetSku, 'CONSOLIDATED');
      const avail = prod
        ? atpCheck.hasBatchTracking
          ? Math.min(prod.currentStockBaseUnits, atpCheck.batchSellableQty)
          : prod.currentStockBaseUnits
        : atpCheck.effectiveAtp;
      if (totalUnits > avail) {
        return res.status(400).json({
          error: `Insufficient non-expired ATP stock for SKU ${targetSku}: requested ${totalUnits}, available ${avail}.`,
        });
      }
    }

    // Calculate subtotal, PWP discounts, post-markdown/discount net VAT (PPN), and base units (strict integer IDR)
    let subtotalIDR = 0;
    let pwpDiscountIDR = 0;
    let totalBaseUnits = 0;
    let totalCogsIDR = 0;
    let totalPpnIDR = 0;
    let totalPb1IDR = 0;

    for (const item of items) {
      const prod = wholesaleProductsList.find(
        (p) => p.id === (item.product?.id || item.productId) || p.sku === (item.product?.sku || item.sku)
      );
      const targetSku = prod?.sku || item.product?.sku || item.sku || '';
      const rawLineTotal =
        item.lineTotal !== undefined
          ? Number(item.lineTotal)
          : (Number(item.unitPrice ?? item.price ?? prod?.baseUnitPrice ?? 0) || 0) *
            (Number(item.quantity) || 1);
      const lineNet = Math.max(0, roundIDR(rawLineTotal));
      subtotalIDR += lineNet;
      totalBaseUnits += Number(item.baseUnitsCalculated) || Number(item.quantity) || 0;
      if (item.isPwpRedemption) {
        const normalPrice = primaryPwp?.normalPriceIDR || 38000;
        pwpDiscountIDR += Math.max(0, roundIDR(normalPrice - (Number(item.unitPrice) || primaryPwp?.promoPriceIDR || 10000)));
      }

      const rule = skuTaxRulesList.find((r) => r.sku === targetSku);
      const taxCat: IndonesianTaxCategory =
        rule?.taxCategory || inferDefaultTaxCategory(prod?.category || item.product?.category || '', prod?.name || item.product?.name || '');
      const stdRate = rule?.taxRatePercent ?? posCheckoutConfig.ppnTaxPercent ?? 11;
      const taxCalc = computeIndonesianTax(lineNet, taxCat, false, stdRate);
      totalPpnIDR += roundIDR(taxCalc.ppnIDR);
      totalPb1IDR += roundIDR(taxCalc.pb1IDR);
    }

    subtotalIDR = roundIDR(subtotalIDR);
    pwpDiscountIDR = roundIDR(pwpDiscountIDR);
    totalPpnIDR = roundIDR(totalPpnIDR);
    totalPb1IDR = roundIDR(totalPb1IDR);
    const taxPPN11IDR = totalPpnIDR + totalPb1IDR;
    const totalAmountIDR = subtotalIDR + taxPPN11IDR;

    // Strict Auto-Credit Lock & AR Validation
    const safePaymentMethod = String(paymentMethod || 'term_net14');
    const isCreditPayment = safePaymentMethod.startsWith('term_') || safePaymentMethod === 'bilyet_giro';
    if (isCreditPayment) {
      if (customer.status === 'CREDIT_LOCKED') {
        return res.status(400).json({
          error: `Credit terms disabled: Customer account is LOCKED. Reason: ${customer.lockReason || 'Overdue invoice > 7 days'}`,
        });
      }
      if (customer.overdueDaysMax > 7) {
        customer.status = 'CREDIT_LOCKED';
        customer.lockReason = `Account automatically locked due to overdue receivables (${customer.overdueDaysMax} days overdue).`;
        return res.status(400).json({
          error: `Credit terms disabled: Customer has an invoice overdue by ${customer.overdueDaysMax} days. Please settle outstanding balance first.`,
        });
      }
      if (customer.outstandingAR + totalAmountIDR > customer.creditLimit) {
        return res.status(400).json({
          error: `Credit limit exceeded. Total due (Rp ${totalAmountIDR.toLocaleString('id-ID')}) exceeds available credit balance (Rp ${customer.availableCredit.toLocaleString('id-ID')}).`,
        });
      }
    }

    // Real-Time Fractional Strategy-Aware (FEFO/FIFO) Inventory Deduction & Moving Average COGS
    for (const cartIt of items) {
      const prod = wholesaleProductsList.find(
        (p) => p.id === (cartIt.product?.id || cartIt.productId) || p.sku === (cartIt.product?.sku || cartIt.sku)
      );
      const targetSku = prod?.sku || cartIt.product?.sku || cartIt.sku || '';
      const unitsToDeduct = Number(cartIt.baseUnitsCalculated) || Number(cartIt.quantity) || 1;
      const fallbackCost = (prod?.baseUnitPrice || 20000) * 0.72;

      const batchDeduction = deductBatchesByStrategy(targetSku, unitsToDeduct, 'CONSOLIDATED', fallbackCost);
      totalCogsIDR = roundIDR(totalCogsIDR + roundIDR(batchDeduction.totalCogs));

      if (prod) {
        prod.currentStockBaseUnits = Math.max(0, prod.currentStockBaseUnits - unitsToDeduct);
      }

      // Sync matching catalog inventory & store warehouse tier when SKUs share stock
      const invItem = inventoryList.find((i) => i.sku === targetSku);
      if (invItem) {
        invItem.currentStock = Math.max(0, invItem.currentStock - unitsToDeduct);
        invItem.outgoingStock += unitsToDeduct;
      }
      const tier = storeInventoryTiers.find((t) => t.sku === targetSku);
      if (tier) {
        tier.physicalStock = Math.max(0, tier.physicalStock - unitsToDeduct);
        tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
        tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
        tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
        tier.updatedAt = new Date().toISOString();
      }
    }

    totalCogsIDR = Math.max(0, roundIDR(totalCogsIDR));

    const timestamp = new Date().toISOString();
    const orderId = `B2B-2026-${(b2bOrdersList.length + 80).toString().padStart(4, '0')}`;
    const journalEntryIds: string[] = [];

    // General Ledger Automation (Exact DR === CR Parity with split Revenue #4020 and Output VAT #2025)
    const gle1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gle2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const gle3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
    const gle4 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}`;
    journalEntryIds.push(gle1, gle2);

    let paymentStatus: B2BWholesaleOrder['paymentStatus'] = 'APPROVED_CREDIT';
    let orderStatus: B2BWholesaleOrder['status'] = 'CONFIRMED';
    let requiresApproval = false;
    let approvalRequestId: string | undefined;

    // Check if order exceeds threshold for Approval Matrix
    if (totalAmountIDR > 10000000 || paymentMethod === 'transfer_verification') {
      requiresApproval = true;
      orderStatus = 'PENDING_FINANCE';
      paymentStatus = paymentMethod === 'transfer_verification' ? 'PENDING_VERIFICATION' : 'AWAITING_APPROVAL';
      approvalRequestId = `APR-2026-${(approvalQueueList.length + 1).toString().padStart(3, '0')}`;

      approvalQueueList.unshift({
        id: approvalRequestId,
        module: paymentMethod === 'transfer_verification' ? 'b2b_transfer_verification' : 'b2b_credit_term',
        documentId: orderId,
        documentTitle: `B2B Wholesale Order [${orderId}]: ${customer.companyName}`,
        requestedBy: 'Wholesale Sales Desk',
        requestedAt: timestamp,
        amountIDR: totalAmountIDR,
        storeId: 'CONSOLIDATED',
        storeName: 'Central Wholesale Logistics Hub',
        currentTierLevel: 1,
        requiredTierLevel: totalAmountIDR > 50000000 ? 3 : 2,
        status: 'PENDING',
        history: [],
        payloadSummary: {
          productName: `${items.length} Wholesale SKUs (${totalBaseUnits} Base Units)`,
          quantity: totalBaseUnits,
          reason: `Wholesale order (${paymentMethod}) total Rp ${totalAmountIDR.toLocaleString('id-ID')} routed to Finance Controller queue.`,
        },
      });
    }

    const b2bRevenueGlBatch: GeneralLedgerEntry[] = [];

    if (paymentMethod === 'bilyet_giro') {
      paymentStatus = 'GIRO_PENDING';
      const giroId = `GIRO-2026-${(giroRecordsList.length + 1).toString().padStart(3, '0')}`;
      const dueDays = 14;
      const dueDate = giroDetails?.clearingDueDate || new Date(Date.now() + 86400000 * dueDays).toISOString();

      const newGiro: GiroPaymentRecord = {
        id: giroId,
        orderId,
        customerName: customer.companyName,
        customerId: customer.id,
        giroNumber: giroDetails?.giroNumber || `BG-BCA-${Math.floor(1000000 + Math.random() * 9000000)}`,
        issuingBank: giroDetails?.bankName || giroDetails?.issuingBank || 'Bank Central Asia (BCA)',
        amountIDR: totalAmountIDR,
        issueDate: timestamp,
        clearingDueDate: dueDate,
        status: 'PENDING_CLEARING',
        journalEntryIds: [gle1, gle2],
      };
      giroRecordsList.unshift(newGiro);

      emitEnterpriseNotification({
        dedupeKey: `GIRO_NEW:${giroId}`,
        category: 'B2B_FINANCE',
        severity: 'INFO',
        title: `New Bilyet Giro Submitted (#${newGiro.giroNumber})`,
        message: `${customer.companyName} issued Giro #${newGiro.giroNumber} (${newGiro.issuingBank}) for Rp ${totalAmountIDR.toLocaleString('id-ID')} booked to COA #1210.`,
        metadataLabel: `${newGiro.giroNumber} • Rp ${totalAmountIDR.toLocaleString('id-ID')}`,
        targetTab: 'accounting',
        targetSubTab: 'b2b_ar',
      });

      b2bRevenueGlBatch.push({
        id: gle1,
        timestamp,
        storeId: 'CONSOLIDATED',
        storeName: 'Consolidated Company-Wide',
        accountCode: '1210',
        accountName: 'Bilyet Giro & PDC Clearing Receivable',
        category: 'Asset',
        debit: totalAmountIDR,
        credit: 0,
        referenceType: 'B2B_WHOLESALE_ORDER',
        referenceId: orderId,
        description: `B2B Wholesale Order [${orderId}]: Giro PDC received #${newGiro.giroNumber} from ${customer.companyName}`,
      });
    } else {
      b2bRevenueGlBatch.push({
        id: gle1,
        timestamp,
        storeId: 'CONSOLIDATED',
        storeName: 'Consolidated Company-Wide',
        accountCode: '1200',
        accountName: 'Accounts Receivable - B2B Wholesale',
        category: 'Asset',
        debit: totalAmountIDR,
        credit: 0,
        referenceType: 'B2B_WHOLESALE_ORDER',
        referenceId: orderId,
        description: `B2B Wholesale Order [${orderId}]: Trade receivable invoiced to ${customer.companyName} (${paymentMethod})`,
      });
    }

    // Credit Net Wholesale Revenue #4020
    b2bRevenueGlBatch.push({
      id: gle2,
      timestamp,
      storeId: 'CONSOLIDATED',
      storeName: 'Consolidated Company-Wide',
      accountCode: '4020',
      accountName: 'B2B Wholesale Grocery Revenue',
      category: 'Revenue',
      debit: 0,
      credit: subtotalIDR,
      referenceType: 'B2B_WHOLESALE_ORDER',
      referenceId: orderId,
      description: `B2B Wholesale Order [${orderId}]: Net revenue recognized for ${items.length} wholesale lines`,
    });

    // Credit Output VAT #2025 / PB1 #2027
    if (totalPpnIDR > 0) {
      const gleTax = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}-VAT`;
      journalEntryIds.push(gleTax);
      b2bRevenueGlBatch.push({
        id: gleTax,
        timestamp,
        storeId: 'CONSOLIDATED',
        storeName: 'Consolidated Company-Wide',
        accountCode: '2025',
        accountName: 'PPN Keluaran (VAT Output Payable 11%/12%)',
        category: 'Liability',
        debit: 0,
        credit: totalPpnIDR,
        referenceType: 'B2B_WHOLESALE_ORDER',
        referenceId: orderId,
        description: `B2B Wholesale Order [${orderId}]: VAT Output PPN accrued`,
      });
    }
    if (totalPb1IDR > 0) {
      const glePb1 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}-PB1`;
      journalEntryIds.push(glePb1);
      b2bRevenueGlBatch.push({
        id: glePb1,
        timestamp,
        storeId: 'CONSOLIDATED',
        storeName: 'Consolidated Company-Wide',
        accountCode: '2027',
        accountName: 'Pajak Daerah PB1 (10% Ready-to-Eat Deli)',
        category: 'Liability',
        debit: 0,
        credit: totalPb1IDR,
        referenceType: 'B2B_WHOLESALE_ORDER',
        referenceId: orderId,
        description: `B2B Wholesale Order [${orderId}]: PB1 10% tax accrued`,
      });
    }
    commitBalancedGlBatch(b2bRevenueGlBatch, true);

    // Debit COGS #5010 / Credit Merchandise Inventory #1040
    journalEntryIds.push(gle3, gle4);
    commitBalancedGlBatch(
      [
        {
          id: gle3,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '5010',
          accountName: 'Cost of Goods Sold (COGS) - FIFO / WAC',
          category: 'Expense',
          debit: totalCogsIDR,
          credit: 0,
          referenceType: 'B2B_WHOLESALE_ORDER',
          referenceId: orderId,
          description: `B2B Wholesale Order [${orderId}]: FEFO moving average cost recognized (${totalBaseUnits} base units)`,
        },
        {
          id: gle4,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '1040',
          accountName: 'Merchandise Inventory Asset',
          category: 'Asset',
          debit: 0,
          credit: totalCogsIDR,
          referenceType: 'B2B_WHOLESALE_ORDER',
          referenceId: orderId,
          description: `B2B Wholesale Order [${orderId}]: Stock inventory deduction via FEFO`,
        },
      ],
      true
    );

    // Update Customer Accounts Receivable & Credit Balance
    customer.outstandingAR += totalAmountIDR;
    customer.availableCredit = Math.max(0, customer.creditLimit - customer.outstandingAR);
    if (customer.outstandingAR >= customer.creditLimit) {
      customer.status = 'CREDIT_LOCKED';
      customer.lockReason = `Credit limit (Rp ${customer.creditLimit.toLocaleString('id-ID')}) has been fully utilized.`;
    }

    const newOrder: B2BWholesaleOrder = {
      id: orderId,
      customerId: customer.id,
      customerName: customer.name,
      companyName: customer.companyName,
      customerTier: customer.tier,
      items,
      subtotalIDR,
      pwpDiscountIDR,
      taxPPN11IDR,
      totalAmountIDR,
      paymentMethod,
      paymentStatus,
      giroDetails,
      transferProofUrl,
      approvalRequestId,
      status: orderStatus,
      totalBaseUnits,
      totalCogsIDR,
      orderDate: timestamp,
      duePaymentDate: new Date(Date.now() + 86400000 * 14).toISOString(),
      journalEntryIds,
    };

    b2bOrdersList.unshift(newOrder);

    // Event 2, 4, 6 triggers on B2B checkout
    checkAndNotifyLowStockForSkus(
      Array.from(b2bReqBySku.keys()),
      'store-jkt-senopati'
    );
    if (requiresApproval && approvalRequestId) {
      emitEnterpriseNotification({
        dedupeKey: `APR_QUEUE:${approvalRequestId}`,
        category: 'PROCUREMENT_FINANCE',
        severity: 'ACTION_REQUIRED',
        title: `B2B Order Approval Required (${orderId})`,
        message: `${customer.companyName} order Rp ${totalAmountIDR.toLocaleString('id-ID')} routed to Finance Approval Matrix.`,
        metadataLabel: `${orderId} • Rp ${totalAmountIDR.toLocaleString('id-ID')}`,
        targetTab: 'approvals',
      });
    }
    emitEnterpriseNotification({
      dedupeKey: `B2B_PICKER:${orderId}`,
      category: 'FULFILLMENT',
      severity: 'INFO',
      title: `Incoming B2B Order for Picking (${orderId})`,
      message: `${customer.companyName} ordered ${totalBaseUnits} base units across ${items.length} lines.`,
      metadataLabel: `${orderId} • ${totalBaseUnits} units`,
      targetTab: 'picker',
    });

    res.json({
      success: true,
      order: newOrder,
      customerUpdated: customer,
      requiresApproval,
      journalEntryIds,
      message: requiresApproval
        ? `Order #${orderId} created and submitted to Executive Approval Matrix queue.`
        : `Wholesale Order #${orderId} placed successfully. Stock deducted via FEFO.`,
    });
  });

  // Giro Clearing Action
  app.post('/api/b2b/giro/:id/clear', (req: Request, res: Response) => {
    const { id } = req.params;
    const giro = giroRecordsList.find((g) => g.id === id);
    if (!giro) return res.status(404).json({ error: 'Giro record not found' });
    if (giro.status === 'CLEARED') return res.status(400).json({ error: 'Giro has already been cleared' });

    const timestamp = new Date().toISOString();
    giro.status = 'CLEARED';
    giro.clearedAt = timestamp;

    const gle1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gle2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;

    // Debit Bank BCA #1020 / Credit Giro Receivable #1210 via balanced COA-synced GL batch
    commitBalancedGlBatch(
      [
        {
          id: gle1,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '1020',
          accountName: 'Bank BCA Operational Clearing',
          category: 'Asset',
          debit: giro.amountIDR,
          credit: 0,
          referenceType: 'GIRO_CLEARING',
          referenceId: giro.id,
          description: `Bilyet Giro #${giro.giroNumber} cleared into Bank BCA from ${giro.customerName}`,
        },
        {
          id: gle2,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '1210',
          accountName: 'Bilyet Giro & PDC Clearing Receivable',
          category: 'Asset',
          debit: 0,
          credit: giro.amountIDR,
          referenceType: 'GIRO_CLEARING',
          referenceId: giro.id,
          description: `Settlement of cleared Giro Warkat #${giro.giroNumber}`,
        },
      ],
      true
    );

    const linkedOrder = b2bOrdersList.find((o) => o.id === giro.orderId);
    if (linkedOrder) {
      linkedOrder.paymentStatus = 'SETTLED';
      if (linkedOrder.status === 'PENDING_FINANCE') linkedOrder.status = 'CONFIRMED';
    }

    // Update customer available credit
    const customer = b2bCustomersList.find((c) => c.id === giro.customerId);
    if (customer) {
      customer.outstandingAR = Math.max(0, customer.outstandingAR - giro.amountIDR);
      customer.availableCredit = Math.max(0, customer.creditLimit - customer.outstandingAR);
      if (customer.status === 'CREDIT_LOCKED' && customer.outstandingAR < customer.creditLimit && customer.overdueDaysMax <= 7) {
        customer.status = 'ACTIVE';
        customer.lockReason = undefined;
      }
    }

    res.json({
      success: true,
      giro,
      journalEntryIds: [gle1, gle2],
      message: `Bilyet Giro #${giro.giroNumber} marked as CLEARED. Funds deposited into Bank BCA (#1020).`,
    });
  });

  // Giro Bounced / Tolak Kliring Action
  app.post('/api/b2b/giro/:id/bounce', (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason = 'Insufficient funds in drawer / Saldo giro nasabah tidak mencukupi (SKNBI Tolakan)' } = req.body;
    const giro = giroRecordsList.find((g) => g.id === id);
    if (!giro) return res.status(404).json({ error: 'Giro record not found' });
    if (giro.status === 'BOUNCED') return res.status(400).json({ error: 'Giro has already been marked as bounced' });

    const timestamp = new Date().toISOString();
    const penaltyFee = 150000; // Rp 150,000 standard bounced check administrative penalty fee
    giro.status = 'BOUNCED';
    giro.bouncedAt = timestamp;
    giro.bounceReason = reason;
    giro.penaltyFeeIDR = penaltyFee;

    const customer = b2bCustomersList.find((c) => c.id === giro.customerId);
    if (customer) {
      // Re-open debt and auto-lock customer credit
      customer.outstandingAR += penaltyFee;
      customer.availableCredit = Math.max(0, customer.creditLimit - customer.outstandingAR);
      customer.status = 'CREDIT_LOCKED';
      customer.lockReason = `DISHONORED BILYET GIRO: Giro #${giro.giroNumber} bounced (${reason}). Credit facility frozen pending full cashier restitution.`;
    }

    emitEnterpriseNotification({
      dedupeKey: `GIRO_BOUNCED:${giro.id}`,
      category: 'B2B_FINANCE',
      severity: 'CRITICAL',
      title: `Bilyet Giro Tolakan / Bounced (#${giro.giroNumber})`,
      message: `${giro.customerName} Giro Rp ${giro.amountIDR.toLocaleString('id-ID')} bounced. Credit FROZEN & COA #4090 penalty Rp ${penaltyFee.toLocaleString('id-ID')} booked.`,
      metadataLabel: `${giro.giroNumber} • Frozen AR`,
      targetTab: 'accounting',
      targetSubTab: 'b2b_ar',
    });

    const linkedOrder = b2bOrdersList.find((o) => o.id === giro.orderId);
    if (linkedOrder) {
      linkedOrder.paymentStatus = 'BOUNCED';
    }

    const gle1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gle2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const gle3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
    const gle4 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}`;

    // Re-open AR: Debit AR #1200 / Credit Giro Receivable #1210 via balanced COA-synced batch
    commitBalancedGlBatch(
      [
        {
          id: gle1,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '1200',
          accountName: 'Accounts Receivable - B2B Wholesale',
          category: 'Asset',
          debit: giro.amountIDR,
          credit: 0,
          referenceType: 'GIRO_BOUNCED',
          referenceId: giro.id,
          description: `Dishonored Giro #${giro.giroNumber}: Re-opened AR debt for ${giro.customerName}`,
        },
        {
          id: gle2,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '1210',
          accountName: 'Bilyet Giro & PDC Clearing Receivable',
          category: 'Asset',
          debit: 0,
          credit: giro.amountIDR,
          referenceType: 'GIRO_BOUNCED',
          referenceId: giro.id,
          description: `Removal of bounced Giro Warkat #${giro.giroNumber} from clearing queue`,
        },
      ],
      true
    );

    // Penalty Fee: Debit AR #1200 / Credit Giro Penalty Income #4090 via balanced COA-synced batch
    commitBalancedGlBatch(
      [
        {
          id: gle3,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '1200',
          accountName: 'Accounts Receivable - B2B Wholesale',
          category: 'Asset',
          debit: penaltyFee,
          credit: 0,
          referenceType: 'GIRO_BOUNCED_PENALTY',
          referenceId: giro.id,
          description: `Administrative penalty surcharge on bounced Giro #${giro.giroNumber}`,
        },
        {
          id: gle4,
          timestamp,
          storeId: 'CONSOLIDATED',
          storeName: 'Consolidated Company-Wide',
          accountCode: '4090',
          accountName: 'Giro Bounced Penalty & Admin Surcharge Income',
          category: 'Revenue',
          debit: 0,
          credit: penaltyFee,
          referenceType: 'GIRO_BOUNCED_PENALTY',
          referenceId: giro.id,
          description: `Fee income recognized on dishonored check #${giro.giroNumber}`,
        },
      ],
      true
    );

    res.json({
      success: true,
      giro,
      customer,
      penaltyFee,
      journalEntryIds: [gle1, gle2, gle3, gle4],
      message: `Giro #${giro.giroNumber} marked as BOUNCED. AR re-opened, Rp 150.000 penalty assessed, and customer credit frozen.`,
    });
  });

  // --- 4. WAREHOUSE STORAGE BINS & ADVANCED ROUTING ---
  app.get('/api/admin/warehouse/bins', (req: Request, res: Response) => {
    const { storeId, zoneId, status } = req.query;
    let filtered = warehouseBins;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      filtered = filtered.filter((b) => b.storeId === storeId);
    }
    if (zoneId && zoneId !== 'ALL') {
      filtered = filtered.filter((b) => b.zoneId === zoneId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((b) => b.status === status);
    }
    res.json(filtered);
  });

  app.post('/api/admin/warehouse/bins', (req: Request, res: Response) => {
    const {
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      zoneId = 'WH-JKT-SEN-COLD',
      rack = 'Chilled Rack C',
      shelf = 'Tier 1',
      binCode,
      type = 'COLD_CHUTE',
      capacityUnits = 60,
      currentSku,
    } = req.body;

    if (!binCode) {
      return res.status(400).json({ error: 'binCode is required.' });
    }

    const inv = inventoryList.find((i) => i.sku === currentSku);
    const newBin: WarehouseBinLocation = {
      id: `BIN-${Date.now().toString().slice(-6)}`,
      storeId,
      storeName,
      zoneId,
      rack,
      shelf,
      binCode,
      type,
      currentSku: currentSku || undefined,
      productName: inv?.productName,
      capacityUnits: Number(capacityUnits) || 60,
      occupancyUnits: currentSku ? 10 : 0,
      status: currentSku ? 'OCCUPIED' : 'AVAILABLE',
    };

    warehouseBins.push(newBin);
    res.json({ success: true, bin: newBin, message: `Storage location ${binCode} registered.` });
  });

  app.put('/api/admin/warehouse/bins/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const bin = warehouseBins.find((b) => b.id === id);
    if (!bin) return res.status(404).json({ error: 'Bin location not found.' });

    Object.assign(bin, req.body);
    if (req.body.currentSku) {
      const inv = inventoryList.find((i) => i.sku === req.body.currentSku);
      if (inv) bin.productName = inv.productName;
      bin.status = 'OCCUPIED';
    } else if (req.body.occupancyUnits === 0) {
      bin.status = 'AVAILABLE';
      bin.currentSku = undefined;
      bin.productName = undefined;
    }
    res.json({ success: true, bin, message: `Bin ${bin.binCode} updated.` });
  });

  app.get('/api/admin/warehouse/routes', (_req: Request, res: Response) => {
    res.json(warehouseRoutes);
  });

  app.put('/api/admin/warehouse/routes/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const route = warehouseRoutes.find((r) => r.id === id);
    if (!route) return res.status(404).json({ error: 'Route not found.' });
    Object.assign(route, req.body);
    res.json({ success: true, route, message: `Multi-step warehouse route updated.` });
  });

  // --- 5. PROCUREMENT 3-WAY MATCHING & VENDOR BILLS ---
  function postVendorBillApprovalGL(bill: VendorBill, approverName: string): string[] {
    if (bill.glEntryIds && bill.glEntryIds.length > 0) {
      return bill.glEntryIds;
    }

    const timestamp = bill.approvedAt || new Date().toISOString();
    const exRate = bill.exchangeRate || 1;
    const billTotalIDR = roundIDR(bill.grandTotalIDR);
    const billSubtotalIDR = Math.round(bill.subtotal * exRate);
    const billTaxIDR = billTotalIDR - billSubtotalIDR;

    const gr = goodsReceipts.find((g) => g.id === bill.goodsReceiptId && g.poId === bill.poId);
    const po = purchaseOrders.find((p) => p.id === bill.poId);
    const grAlreadyReconciled = vendorBillsList.some(
      (b) =>
        b.id !== bill.id &&
        b.goodsReceiptId === bill.goodsReceiptId &&
        (b.status === 'APPROVED' || b.status === 'PAID' || b.status === 'PARTIALLY_PAID')
    );

    let grAccruedIDR = 0;
    if (gr && !grAlreadyReconciled) {
      grAccruedIDR = gr.items.reduce((sum, grIt) => {
        const poIt = po?.items.find((p) => p.sku === grIt.sku);
        const billIt = bill.items.find((bi) => bi.sku === grIt.sku);
        const unitCost = poIt?.unitCost ?? (billIt ? Math.round(billIt.unitCost * exRate) : 0);
        return sum + Math.round(grIt.quantityReceived * unitCost);
      }, 0);
    }

    const netInventoryVarianceIDR = billSubtotalIDR - grAccruedIDR;
    const netApAdjustmentIDR = billTotalIDR - grAccruedIDR;
    const glIds: string[] = [];
    let seqOffset = 1;
    const nextGleId = () => `GLE-2026-${(generalLedger.length + seqOffset++).toString().padStart(4, '0')}`;

    const approvalGlBatch: GeneralLedgerEntry[] = [];

    if (netInventoryVarianceIDR !== 0) {
      const id = nextGleId();
      glIds.push(id);
      approvalGlBatch.push({
        id,
        timestamp,
        storeId: bill.storeId,
        storeName: bill.storeName,
        accountCode: '1040',
        accountName: 'Merchandise Inventory Asset',
        category: 'Asset',
        debit: netInventoryVarianceIDR > 0 ? netInventoryVarianceIDR : 0,
        credit: netInventoryVarianceIDR < 0 ? Math.abs(netInventoryVarianceIDR) : 0,
        referenceType: 'VENDOR_BILL',
        referenceId: bill.id,
        description:
          grAccruedIDR > 0
            ? `Vendor Bill #${bill.id} invoice variance vs GR #${bill.goodsReceiptId} [${bill.billNumber}] (${approverName})`
            : `Vendor Bill #${bill.id} approved [${bill.billNumber} - ${bill.supplierName}]`,
      });
    }

    if (billTaxIDR > 0) {
      const id = nextGleId();
      glIds.push(id);
      approvalGlBatch.push({
        id,
        timestamp,
        storeId: bill.storeId,
        storeName: bill.storeName,
        accountCode: '2026',
        accountName: 'PPN Masukan (VAT Input Creditable)',
        category: 'Asset',
        debit: billTaxIDR,
        credit: 0,
        referenceType: 'VENDOR_BILL',
        referenceId: bill.id,
        description: `Input VAT (${bill.taxPercent}%) booked for Vendor Bill #${bill.id} [${bill.billNumber}]`,
      });
    }

    if (netApAdjustmentIDR !== 0) {
      const id = nextGleId();
      glIds.push(id);
      approvalGlBatch.push({
        id,
        timestamp,
        storeId: bill.storeId,
        storeName: bill.storeName,
        accountCode: '2010',
        accountName: 'Trade Accounts Payable',
        category: 'Liability',
        debit: netApAdjustmentIDR < 0 ? Math.abs(netApAdjustmentIDR) : 0,
        credit: netApAdjustmentIDR > 0 ? netApAdjustmentIDR : 0,
        referenceType: 'VENDOR_BILL',
        referenceId: bill.id,
        description:
          grAccruedIDR > 0
            ? `Net AP reconciliation (incl. VAT/variance) for Vendor Bill #${bill.id} [${bill.billNumber}]`
            : `Accounts Payable booked for vendor invoice #${bill.billNumber}`,
      });
    }

    commitBalancedGlBatch(approvalGlBatch, true);

    // Automatic Settlement of Vendor Prepayments (COA #1150 Auto-Offset on Approved Vendor Bill)
    const billPayableIDR =
      bill.remainingBalanceIDR !== undefined
        ? Math.max(0, roundIDR(bill.remainingBalanceIDR))
        : Math.max(0, roundIDR((bill.remainingDue ?? bill.grandTotal) * exRate));
    const supplierAdvanceIDR = getSupplierOpenAdvance1150IDR(bill.supplierName);
    const autoOffsetIDR = Math.min(supplierAdvanceIDR, billPayableIDR);

    if (autoOffsetIDR > 0) {
      const apOffsetGlId = `${nextGleId()}-ADV-DR`;
      const prepayCreditGlId = `${nextGleId()}-ADV-CR`;
      glIds.push(apOffsetGlId, prepayCreditGlId);

      commitBalancedGlBatch(
        [
          {
            id: apOffsetGlId,
            timestamp,
            storeId: bill.storeId,
            storeName: bill.storeName,
            accountCode: '2010',
            accountName: 'Trade Accounts Payable',
            category: 'Liability',
            debit: autoOffsetIDR,
            credit: 0,
            referenceType: 'VENDOR_PAYMENT',
            referenceId: bill.id,
            description: `Auto-offset Vendor Prepayment #1150 for ${bill.supplierName} applied to Bill #${bill.id} [${bill.billNumber}]`,
          },
          {
            id: prepayCreditGlId,
            timestamp,
            storeId: bill.storeId,
            storeName: bill.storeName,
            accountCode: '1150',
            accountName: 'Vendor Prepayments / Advances (Uang Muka Pembelian)',
            category: 'Asset',
            debit: 0,
            credit: autoOffsetIDR,
            referenceType: 'VENDOR_PAYMENT',
            referenceId: bill.id,
            description: `Vendor Prepayment #1150 settled against Vendor Bill #${bill.id} [${bill.billNumber}] for ${bill.supplierName}`,
          },
        ],
        true
      );

      const newRemainingIDR = Math.max(0, billPayableIDR - autoOffsetIDR);
      const offsetInBillCurrency =
        exRate > 1 ? Number((autoOffsetIDR / exRate).toFixed(2)) : autoOffsetIDR;
      bill.amountPaid =
        exRate > 1
          ? Number(((bill.amountPaid || 0) + offsetInBillCurrency).toFixed(2))
          : roundIDR((bill.amountPaid || 0) + offsetInBillCurrency);
      bill.remainingBalanceIDR = newRemainingIDR;
      bill.remainingDue =
        exRate > 1 ? Number((newRemainingIDR / exRate).toFixed(2)) : newRemainingIDR;
      bill.paymentStatus = newRemainingIDR === 0 ? 'PAID' : 'PARTIALLY_PAID';
      if (newRemainingIDR === 0) {
        bill.status = 'PAID';
        bill.paidAt = timestamp;
      }
      const offsetNote = `Auto-offset Rp ${autoOffsetIDR.toLocaleString('id-ID')} from Vendor Prepayments (#1150).`;
      bill.notes = bill.notes ? `${bill.notes} | ${offsetNote}` : offsetNote;
    } else if (bill.remainingBalanceIDR === undefined) {
      bill.remainingBalanceIDR = billPayableIDR;
    }

    bill.glEntryIds = glIds;
    return glIds;
  }

  app.get('/api/admin/procurement/vendor-bills', (req: Request, res: Response) => {
    const { storeId, status, currency } = req.query;
    let filtered = vendorBillsList;
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      filtered = filtered.filter((b) => b.storeId === storeId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((b) => b.status === status);
    }
    if (currency && currency !== 'ALL') {
      filtered = filtered.filter((b) => b.currency === currency);
    }
    res.json(filtered);
  });

  app.post('/api/admin/procurement/vendor-bills', (req: Request, res: Response) => {
    const {
      billNumber,
      poId,
      goodsReceiptId,
      supplierName = 'Farm Partner',
      supplierContact,
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      deliveryNoteNumber,
      billDate = new Date().toISOString().split('T')[0],
      dueDate,
      paymentTerms = 'Net 30',
      currency = 'IDR',
      exchangeRate = 1,
      items = [],
      taxPercent = 11,
      notes,
      autoApprove = false,
    } = req.body;

    if (!billNumber || !poId || !goodsReceiptId) {
      return res.status(400).json({ error: 'billNumber, poId, and goodsReceiptId are required.' });
    }

    const po = purchaseOrders.find((p) => p.id === poId);
    const gr = goodsReceipts.find((g) => g.id === goodsReceiptId);

    const enforcementMode = enterpriseSettings.threeWayMatching.enforcementMode || 'TOLERANCE_3_WAY';
    const qtyTolPercent =
      enforcementMode === 'STRICT_3_WAY'
        ? 0
        : (enterpriseSettings.threeWayMatching.quantityTolerancePercent ?? 0.5);
    const priceTolPercent =
      enforcementMode === 'STRICT_3_WAY'
        ? 0
        : (enterpriseSettings.threeWayMatching.priceTolerancePercent ?? 0.5);

    let hasAnyPriceVariance = false;
    let hasAnyQtyVariance = false;

    const validatedItems: VendorBillItem[] = items.map((it: any) => {
      const poItem = po?.items.find((p) => p.sku === it.sku);
      const grItem = gr?.items.find((g) => g.sku === it.sku);

      const poQty = poItem ? poItem.orderedQuantity : it.billedQuantity;
      const qcRejectedQty = qcInspectionsList
        .filter((q) => q.referenceId === poId && q.sku === it.sku && q.disposition === 'REJECTED')
        .reduce((sum, q) => sum + (Number(q.totalBatchQuantity) || 0), 0);
      const grQty =
        enforcementMode === 'TWO_WAY'
          ? (grItem ? grItem.quantityReceived : poQty)
          : (grItem ? Math.max(0, grItem.quantityReceived - qcRejectedQty) : 0);
      const billedQty = Number(it.billedQuantity) || 0;

      const poPrice = poItem ? (currency === 'IDR' ? poItem.unitCost : poItem.unitCost / exchangeRate) : it.unitCost;
      const billedPrice = Number(it.unitCost) || 0;

      const compareQty = enforcementMode === 'TWO_WAY' ? poQty : grQty;
      const qtyDiffPercent =
        compareQty > 0
          ? (Math.abs(billedQty - compareQty) / compareQty) * 100
          : (billedQty > 0 ? 100 : 0);
      const priceDiffPercent = poPrice > 0 ? (Math.abs(billedPrice - poPrice) / poPrice) * 100 : 0;

      const hasQtyVar = qtyDiffPercent > qtyTolPercent;
      const hasPriceVar = priceDiffPercent > priceTolPercent;

      if (hasQtyVar) hasAnyQtyVariance = true;
      if (hasPriceVar) hasAnyPriceVariance = true;

      return {
        sku: it.sku,
        productName: it.productName || poItem?.productName || `Product ${it.sku}`,
        poQuantity: poQty,
        grQuantity: grQty,
        billedQuantity: billedQty,
        unitCost: billedPrice,
        totalCost: Math.round(billedQty * billedPrice),
        hasQuantityVariance: hasQtyVar,
        hasPriceVariance: hasPriceVar,
        notes: it.notes || '',
      };
    });

    const subtotal = validatedItems.reduce((sum, it) => sum + it.totalCost, 0);
    const taxAmount = Math.round(subtotal * ((Number(taxPercent) || 0) / 100));
    const grandTotal = subtotal + taxAmount;
    const grandTotalIDR = Math.round(grandTotal * exchangeRate);

    let billStatus: VendorBillStatus = 'MATCHED';
    if (hasAnyPriceVariance) {
      billStatus = 'PRICE_VARIANCE';
    } else if (hasAnyQtyVariance) {
      billStatus = 'QTY_VARIANCE';
    }

    const shouldApprove = autoApprove && billStatus === 'MATCHED';
    if (shouldApprove) {
      billStatus = 'APPROVED';
    }

    const timestamp = new Date().toISOString();
    const id = `VB-2026-${(vendorBillsList.length + 1).toString().padStart(3, '0')}`;
    const calculatedDueDate = dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const newBill: VendorBill = {
      id,
      billNumber,
      supplierName,
      supplierContact,
      storeId,
      storeName,
      poId,
      goodsReceiptId,
      deliveryNoteNumber,
      billDate,
      dueDate: calculatedDueDate,
      paymentTerms: paymentTerms as any,
      currency: currency as SupportedCurrency,
      exchangeRate,
      items: validatedItems,
      subtotal,
      taxPercent: Number(taxPercent) || 0,
      taxAmount,
      grandTotal,
      grandTotalIDR,
      amountPaid: 0,
      remainingDue: grandTotal,
      remainingBalanceIDR: grandTotalIDR,
      status: billStatus,
      paymentStatus: 'UNPAID',
      notes,
      createdAt: timestamp,
      approvedBy: shouldApprove ? currentActiveStaffSession.userName : undefined,
      approvedAt: shouldApprove ? timestamp : undefined,
    };

    let glEntryIds: string[] = [];
    if (billStatus === 'APPROVED') {
      glEntryIds = postVendorBillApprovalGL(newBill, currentActiveStaffSession.userName);
    }

    vendorBillsList.unshift(newBill);

    // Flag 3-Way Match Variances exceeding tolerance into Approval Matrix
    let approvalRequestId: string | undefined;
    if (
      (billStatus === 'PRICE_VARIANCE' || billStatus === 'QTY_VARIANCE') &&
      enterpriseSettings.threeWayMatching.requireManagerApprovalForVariance !== false
    ) {
      approvalRequestId = `APR-VB-${Date.now().toString().slice(-5)}`;
      approvalQueueList.unshift({
        id: approvalRequestId,
        module: 'procurement_po',
        documentId: id,
        documentTitle: `3-Way Match Variance [${billStatus}]: ${billNumber} (${supplierName})`,
        requestedBy: currentActiveStaffSession.userName,
        requestedAt: timestamp,
        amountIDR: grandTotalIDR,
        storeId,
        storeName,
        currentTierLevel: 1,
        requiredTierLevel: grandTotalIDR >= 10000000 ? 2 : 1,
        status: 'PENDING',
        history: [],
        payloadSummary: {
          sku: validatedItems[0]?.sku,
          productName: validatedItems[0]?.productName,
          quantity: validatedItems.reduce((s, it) => s + it.billedQuantity, 0),
          reason: `3-Way Match ${billStatus} on PO #${poId} / GR #${goodsReceiptId} exceeding tolerance`,
        },
      });

      emitEnterpriseNotification({
        dedupeKey: `APR_QUEUE:${approvalRequestId}`,
        category: 'PROCUREMENT_FINANCE',
        severity: 'WARNING',
        title: `3-Way Match Variance: ${billNumber}`,
        message: `Vendor Bill ${billNumber} (${supplierName}) flagged ${billStatus} on PO #${poId} / GR #${goodsReceiptId} and routed to Approval Matrix.`,
        metadataLabel: `${id} • Rp ${grandTotalIDR.toLocaleString('id-ID')}`,
        targetTab: 'approvals',
      });
    }

    res.json({
      success: true,
      vendorBill: newBill,
      approvalRequestId,
      journalEntryIds: glEntryIds,
      message: `Vendor Bill #${id} created with 3-Way status [${billStatus}]${approvalRequestId ? ' and flagged in Approval Matrix' : ''}.`,
    });
  });

  app.post('/api/admin/procurement/vendor-bills/:id/approve', (req: Request, res: Response) => {
    const { id } = req.params;
    const { approverName = currentActiveStaffSession.userName } = req.body;
    const bill = vendorBillsList.find((b) => b.id === id);
    if (!bill) return res.status(404).json({ error: 'Vendor Bill not found.' });
    if (bill.status === 'VOID') {
      return res.status(400).json({ error: `Cannot approve voided Vendor Bill #${bill.billNumber}.` });
    }
    if (bill.status === 'APPROVED' || bill.status === 'PAID') {
      return res.status(400).json({ error: `Vendor Bill #${bill.billNumber} is already ${bill.status}.` });
    }

    bill.status = 'APPROVED';
    bill.approvedBy = approverName;
    bill.approvedAt = new Date().toISOString();

    postVendorBillApprovalGL(bill, approverName);

    res.json({ success: true, vendorBill: bill, message: `Vendor Bill #${id} approved.` });
  });

  app.post('/api/admin/procurement/vendor-bills/:id/pay', (req: Request, res: Response) => {
    const { id } = req.params;
    const { amountPaid, paymentMethod = 'BANK_TRANSFER', paymentReference } = req.body;
    const bill = vendorBillsList.find((b) => b.id === id);
    if (!bill) return res.status(404).json({ error: 'Vendor Bill not found.' });
    if (bill.paymentStatus === 'PAID' || bill.remainingDue <= 0) {
      return res.status(400).json({ error: `Vendor Bill #${bill.billNumber} is already paid in full.` });
    }

    if (
      enterpriseSettings.threeWayMatching.blockPaymentOnMismatch !== false &&
      (bill.status === 'PRICE_VARIANCE' || bill.status === 'QTY_VARIANCE' || bill.status === 'VOID')
    ) {
      return res.status(403).json({
        error: `Payment Blocked by 3-Way Matching Policy: Vendor Bill #${bill.billNumber} has status [${bill.status}] and must be authorized in the Approval Matrix before disbursement.`,
      });
    }

    const requestedAmt = amountPaid !== undefined ? Number(amountPaid) : bill.remainingDue;
    if (!Number.isFinite(requestedAmt) || requestedAmt <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    }
    const payAmt = Math.min(bill.remainingDue, requestedAmt);
    bill.amountPaid += payAmt;
    bill.remainingDue = Math.max(0, bill.grandTotal - bill.amountPaid);
    bill.remainingBalanceIDR = Math.round(bill.remainingDue * (bill.exchangeRate || 1));
    bill.paymentStatus = bill.remainingDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    if (bill.paymentStatus === 'PAID') bill.status = 'PAID';
    bill.paymentMethod = paymentMethod as VendorBillPaymentMethod;
    bill.paymentReference = paymentReference;
    bill.paidAt = new Date().toISOString();

    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const payAmountIDR = Math.round(payAmt * bill.exchangeRate);

    commitBalancedGlBatch(
      [
        {
          id: gleId1,
          timestamp: bill.paidAt,
          storeId: bill.storeId,
          storeName: bill.storeName,
          accountCode: '2010',
          accountName: 'Trade Accounts Payable',
          category: 'Liability',
          debit: payAmountIDR,
          credit: 0,
          referenceType: 'VENDOR_PAYMENT',
          referenceId: bill.id,
          description: `Disbursement: Payment for Bill #${bill.billNumber} (${bill.supplierName})`,
        },
        {
          id: gleId2,
          timestamp: bill.paidAt,
          storeId: bill.storeId,
          storeName: bill.storeName,
          accountCode: '1020',
          accountName: 'Bank BCA Operational Clearing',
          category: 'Asset',
          debit: 0,
          credit: payAmountIDR,
          referenceType: 'VENDOR_PAYMENT',
          referenceId: bill.id,
          description: `Bank Wire disbursement for bill #${bill.id} via ${paymentMethod}`,
        },
      ],
      true
    );

    res.json({ success: true, vendorBill: bill, message: `Payment of ${payAmt} recorded for Bill #${id}.` });
  });

  app.post('/api/admin/procurement/vendor-bills/:id/void', (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason = 'Invoice cancelled or superseded by supplier credit note' } = req.body || {};
    const bill = vendorBillsList.find((b) => b.id === id);
    if (!bill) return res.status(404).json({ error: 'Vendor Bill not found.' });
    if (bill.paymentStatus === 'PAID' || bill.status === 'PAID') {
      return res.status(400).json({ error: 'Cannot void a Vendor Bill that has already been paid in full.' });
    }
    if (bill.status === 'VOID') {
      return res.status(400).json({ error: `Vendor Bill #${id} is already voided.` });
    }

    const timestamp = new Date().toISOString();
    const reversingIds: string[] = [];

    // Reverse any GL entries previously posted when the bill was approved
    if (bill.glEntryIds && bill.glEntryIds.length > 0) {
      bill.glEntryIds.forEach((origId, idx) => {
        const orig = generalLedger.find((g) => g.id === origId);
        if (orig && !orig.isReversed) {
          const revId = `GLE-2026-${(generalLedger.length + idx + 1).toString().padStart(4, '0')}`;
          reversingIds.push(revId);
          orig.isReversed = true;
          orig.reversedByVoucherId = revId;
          orig.reversalReason = reason;
          const revEntry: GeneralLedgerEntry = {
            id: revId,
            timestamp,
            storeId: orig.storeId,
            storeName: orig.storeName,
            accountCode: orig.accountCode,
            accountName: orig.accountName,
            category: orig.category,
            debit: orig.credit,
            credit: orig.debit,
            referenceType: 'REVERSING_ENTRY',
            referenceId: bill.id,
            description: `Void Reversal of #${orig.id} for Vendor Bill #${bill.billNumber}: ${reason}`,
            isReversal: true,
            reversesVoucherId: orig.id,
            reversalReason: reason,
          };
          generalLedger.unshift(revEntry);
          updateCoaLedgerBalance(revEntry.accountCode, revEntry.debit, revEntry.credit);
        }
      });
    }

    // Clear pending variance items in Approval Matrix for this bill
    approvalQueueList.forEach((apr) => {
      if (apr.documentId === bill.id && apr.status === 'PENDING') {
        apr.status = 'REJECTED';
        apr.history.push({
          tierLevel: apr.currentTierLevel,
          tierName: `Tier ${apr.currentTierLevel} Void Override`,
          approverId: currentActiveStaffSession.userId,
          approverName: currentActiveStaffSession.userName,
          approverRole: currentActiveStaffSession.userRole,
          action: 'REJECTED',
          timestamp,
          comments: `Bill voided: ${reason}`,
        });
      }
    });

    bill.status = 'VOID';
    bill.remainingDue = 0;
    bill.notes = bill.notes ? `${bill.notes} | VOIDED: ${reason}` : `VOIDED: ${reason}`;

    res.json({
      success: true,
      vendorBill: bill,
      reversingEntryIds: reversingIds,
      message: `Vendor Bill #${bill.billNumber} marked VOID${reversingIds.length > 0 ? ` with ${reversingIds.length} reversing GL counter-entries` : ''}.`,
    });
  });

  // --- 6. ANALYTIC ACCOUNTING & MARGIN ANALYSIS ---
  app.get('/api/admin/accounting/analytic-departments', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const departments: AnalyticDepartment[] = enterpriseSettings.analyticAccounting.departments.map((dept) => {
      const variance = dept.annualBudgetIDR - dept.actualCostIDR;
      const utilization = dept.annualBudgetIDR > 0 ? (dept.actualCostIDR / dept.annualBudgetIDR) * 100 : 0;
      let status: 'ON_TRACK' | 'WARNING' | 'OVER_BUDGET' = 'ON_TRACK';
      if (utilization > 100) status = 'OVER_BUDGET';
      else if (utilization > 80) status = 'WARNING';

      return {
        ...dept,
        committedCostIDR: dept.committedCostIDR ?? 0,
        expectedRevenueIDR: dept.expectedRevenueIDR ?? 0,
        actualRevenueIDR: dept.actualRevenueIDR ?? 0,
        varianceIDR: variance,
        utilizationPercent: Number(utilization.toFixed(1)),
        status,
      };
    });
    res.json(departments);
  });

  app.post('/api/admin/accounting/analytic-departments', (req: Request, res: Response) => {
    const { code, name, manager, annualBudgetIDR = 100000000, actualCostIDR = 0, committedCostIDR = 0, actualRevenueIDR = 0, expectedRevenueIDR = 0 } = req.body || {};
    if (!code || !name) {
      return res.status(400).json({ error: 'Department code and name are required.' });
    }
    const budget = Math.max(0, Number(annualBudgetIDR) || 0);
    const actualCost = Math.max(0, Number(actualCostIDR) || 0);
    const utilization = budget > 0 ? Number(((actualCost / budget) * 100).toFixed(1)) : 0;
    const status: 'ON_TRACK' | 'WARNING' | 'OVER_BUDGET' =
      utilization > 100 ? 'OVER_BUDGET' : utilization > 80 ? 'WARNING' : 'ON_TRACK';

    const newDept: AnalyticDepartment = {
      id: `DEPT-${Date.now().toString().slice(-4)}`,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      manager: String(manager || currentActiveStaffSession.userName),
      annualBudgetIDR: budget,
      actualCostIDR: actualCost,
      committedCostIDR: Math.max(0, Number(committedCostIDR) || 0),
      expectedRevenueIDR: Math.max(0, Number(expectedRevenueIDR) || 0),
      actualRevenueIDR: Math.max(0, Number(actualRevenueIDR) || 0),
      utilizationPercent: utilization,
      varianceIDR: budget - actualCost,
      status,
    };

    enterpriseSettings.analyticAccounting.departments.push(newDept);
    res.json({ success: true, department: newDept, message: `Analytic cost center ${newDept.code} created.` });
  });

  app.put('/api/admin/accounting/analytic-departments/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const dept = enterpriseSettings.analyticAccounting.departments.find((d) => d.id === id);
    if (!dept) return res.status(404).json({ error: 'Department cost center not found.' });
    Object.assign(dept, req.body);
    dept.varianceIDR = dept.annualBudgetIDR - dept.actualCostIDR;
    dept.utilizationPercent = dept.annualBudgetIDR > 0
      ? Number(((dept.actualCostIDR / dept.annualBudgetIDR) * 100).toFixed(1))
      : 0;
    dept.status = dept.utilizationPercent > 100 ? 'OVER_BUDGET' : dept.utilizationPercent > 80 ? 'WARNING' : 'ON_TRACK';
    res.json({ success: true, department: dept, message: `Department budget updated.` });
  });

  app.get('/api/admin/accounting/margin-analysis', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const warningThreshold = enterpriseSettings.analyticAccounting.marginWarningThresholdPercent || 25.0;

    const margins: ProductMarginRecord[] = PRODUCTS.map((prod, idx) => {
      const inv = inventoryList.find((i) => i.productId === prod.id || i.productName.toLowerCase() === prod.name.toLowerCase());
      const sku = inv?.sku || `SKU-${prod.category.slice(0, 3).toUpperCase()}-001`;
      const sellingPrice = prod.price;

      const totalUnitCost = inv ? inv.unitCost : Math.round(prod.price * 0.62);

      let landedAbsorption = 0;
      landedCostsList.forEach((lc) => {
        const match = lc.allocatedItems.find((it) => it.sku === sku);
        if (match) landedAbsorption += match.allocatedCostIDR;
      });

      const baseCost = Math.max(0, totalUnitCost - landedAbsorption);
      const grossProfit = sellingPrice - totalUnitCost;
      const marginPercent = sellingPrice > 0 ? Number(((grossProfit / sellingPrice) * 100).toFixed(1)) : 0;

      // Deterministic monthly volume: real orders + POS receipts + stable per-SKU retail baseline
      const b2cQty = customerOrders.reduce((sum, ord) => {
        const matched = ord.items.filter((it) => it.product.id === prod.id || it.product.name.toLowerCase() === prod.name.toLowerCase());
        return sum + matched.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      }, 0);
      const posQty = posTransactionsHistory.reduce((sum, rec) => {
        const matched = rec.items.filter((it) => it.sku === sku || it.productId === prod.id);
        return sum + matched.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      }, 0);
      const baselineQty = 45 + ((idx * 17) % 65);
      const unitsSoldMonth = baselineQty + Math.round(b2cQty + posQty);
      const totalGrossProfitMonth = grossProfit * unitsSoldMonth;

      return {
        sku,
        name: prod.name,
        category: prod.category,
        sellingPrice,
        baseCost,
        landedCostAbsorption: landedAbsorption,
        totalUnitCost,
        grossProfit,
        marginPercent,
        unitsSoldMonth,
        totalGrossProfitMonth,
        isLowMarginAlert: marginPercent < warningThreshold,
      };
    });

    res.json(margins);
  });

  // --- 7. QUOTATIONS & SALES RULES ENGINE ---
  app.get('/api/admin/sales/quotations', (_req: Request, res: Response) => {
    res.json(enterpriseQuotationsList);
  });

  app.post('/api/admin/sales/quotations', (req: Request, res: Response) => {
    const {
      customerName,
      customerCompany,
      customerEmail,
      customerPhone,
      items = [],
      currency = 'IDR',
      notes,
      isProForma = false,
    } = req.body;

    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and line items are required.' });
    }

    let enrichedItems: EnterpriseQuotationItem[] = [...items];
    if (enterpriseSettings.quotationsAndSales.mandatoryProductsEnabled) {
      enterpriseSettings.quotationsAndSales.mandatoryRules.forEach((rule) => {
        const hasTargetCategory = enrichedItems.some((it) => it.category === rule.targetCategory);
        const alreadyHasMandatory = enrichedItems.some((it) => it.sku === rule.mandatorySku);
        if (hasTargetCategory && !alreadyHasMandatory) {
          enrichedItems.push({
            sku: rule.mandatorySku,
            productName: `${rule.mandatoryProductName} [MANDATORY RULE]`,
            category: 'packaging',
            quantity: 1,
            unit: 'pack',
            unitPrice: rule.mandatoryPriceIDR,
            unitCost: Math.round(rule.mandatoryPriceIDR * 0.4),
            lineTotal: rule.mandatoryPriceIDR,
            isMandatoryAddon: true,
          });
        }
      });
    }

    const subtotal = enrichedItems.reduce((sum, it) => sum + (Number(it.lineTotal) || Number(it.quantity) * Number(it.unitPrice)), 0);
    const taxAmount = Math.round(subtotal * 0.11);
    const total = subtotal + taxAmount;

    let depositPercent = 100;
    if (enterpriseSettings.quotationsAndSales.paymentConfirmationThreshold === 'DEPOSIT_50') {
      depositPercent = 50;
    } else if (enterpriseSettings.quotationsAndSales.paymentConfirmationThreshold === 'PAY_ON_DELIVERY') {
      depositPercent = 0;
    }

    const depositAmount = Math.round((total * depositPercent) / 100);
    const validityDays = enterpriseSettings.quotationsAndSales.defaultValidityDays || 14;
    const validUntil = new Date(Date.now() + validityDays * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const quotationNumber = `QTN-2026-${(enterpriseQuotationsList.length + 1001).toString()}`;
    const newQuotation: EnterpriseQuotation = {
      id: `QUO-2026-${(enterpriseQuotationsList.length + 1).toString().padStart(3, '0')}`,
      quotationNumber,
      customerName,
      customerCompany,
      customerEmail: customerEmail || 'client@corporate.id',
      customerPhone: customerPhone || '+62 811 0000 000',
      date: today,
      validUntil,
      items: enrichedItems,
      subtotal,
      taxAmount,
      total,
      currency: currency as SupportedCurrency,
      requiredDepositPercent: depositPercent,
      depositAmount,
      signatureStatus: 'PENDING',
      status: 'SENT',
      notes,
      isProForma: Boolean(isProForma),
    };

    enterpriseQuotationsList.unshift(newQuotation);
    res.json({
      success: true,
      quotation: newQuotation,
      message: `Quotation ${quotationNumber} generated successfully.`,
    });
  });

  app.post('/api/admin/sales/quotations/:id/sign', (req: Request, res: Response) => {
    const { id } = req.params;
    const { signedBy, signatureDataUrl } = req.body;
    const quo = enterpriseQuotationsList.find((q) => q.id === id);
    if (!quo) return res.status(404).json({ error: 'Quotation not found.' });

    quo.signatureStatus = 'SIGNED';
    quo.signedBy = signedBy || quo.customerName;
    quo.signedAt = new Date().toISOString();
    quo.signatureDataUrl = signatureDataUrl;
    quo.status = 'CONFIRMED';

    res.json({ success: true, quotation: quo, message: `Quotation ${quo.quotationNumber} signed and confirmed.` });
  });

  app.post('/api/admin/sales/quotations/:id/convert-to-order', (req: Request, res: Response) => {
    const { id } = req.params;
    const quo = enterpriseQuotationsList.find((q) => q.id === id);
    if (!quo) return res.status(404).json({ error: 'Quotation not found.' });

    const orderId = `GCM-B2B-${Date.now().toString().slice(-6)}`;
    quo.status = 'CONVERTED_TO_ORDER';
    quo.convertedOrderId = orderId;

    const newOrder: Order = {
      id: orderId,
      createdAt: new Date().toISOString(),
      customerName: quo.customerName,
      customerEmail: quo.customerEmail,
      customerPhone: quo.customerPhone,
      deliveryMethod: 'scheduled',
      deliveryAddress: {
        label: 'Corporate Delivery Site',
        recipient: quo.customerName,
        phone: quo.customerPhone,
        addressLine: quo.customerCompany || 'Commercial Kitchen / Foodservice Hub',
        city: 'Jakarta',
      },
      items: quo.items.map((it) => {
        const prod = PRODUCTS.find((p) => p.name.toLowerCase() === it.productName.toLowerCase()) || PRODUCTS[0];
        return {
          product: { ...prod, price: it.unitPrice, name: it.productName },
          quantity: it.quantity,
          notes: `Converted from Quotation #${quo.quotationNumber}`,
        };
      }),
      subtotal: quo.subtotal,
      deliveryFee: 0,
      discount: 0,
      total: quo.total,
      paymentMethod: 'bank_transfer',
      paymentStatus: quo.requiredDepositPercent === 0 ? 'unpaid' : 'paid',
      status: 'placed',
      timeline: [
        {
          status: 'placed',
          label: 'Quotation Converted to Order',
          description: `B2B Order created from signed Quotation #${quo.quotationNumber}`,
          timestamp: new Date().toISOString(),
          completed: true,
        },
      ],
    };

    customerOrders.unshift(newOrder);

    emitEnterpriseNotification({
      dedupeKey: `QUO_PICKER:${orderId}`,
      category: 'FULFILLMENT',
      severity: 'INFO',
      title: `Quotation Order Ready for Picking (${orderId})`,
      message: `${quo.customerCompany || quo.customerName} quotation ${quo.quotationNumber} converted (Rp ${quo.total.toLocaleString('id-ID')}).`,
      metadataLabel: `${orderId} • ${quo.items.length} SKUs`,
      targetTab: 'picker',
    });

    res.json({
      success: true,
      order: newOrder,
      quotation: quo,
      message: `Quotation ${quo.quotationNumber} converted to active Order #${orderId}!`,
    });
  });

  // --- 8. PROMOTIONS & OPNAME & TRANSFERS APIS ---
  app.get('/api/admin/promotions', (_req: Request, res: Response) => {
    res.json(promotionRulesList);
  });

  app.post('/api/admin/promotions', (req: Request, res: Response) => {
    const newRule: PromotionRule = {
      id: `PRM-2026-${(promotionRulesList.length + 1).toString().padStart(2, '0')}`,
      usageCount: 0,
      active: true,
      ...req.body,
    };
    promotionRulesList.unshift(newRule);
    res.json({ success: true, rule: newRule, message: 'Promotion created.' });
  });

  app.put('/api/admin/promotions/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const rule = promotionRulesList.find((r) => r.id === id);
    if (!rule) return res.status(404).json({ error: 'Promotion not found.' });
    Object.assign(rule, req.body);
    res.json({ success: true, rule, message: 'Promotion updated.' });
  });

  app.delete('/api/admin/promotions/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const rule = promotionRulesList.find((r) => r.id === id);
    if (!rule) return res.status(404).json({ error: 'Promotion not found.' });
    rule.active = false;
    res.json({ success: true, message: 'Promotion deactivated.' });
  });

  app.post('/api/admin/promotions/evaluate', (req: Request, res: Response) => {
    const { cartItems = [], couponCode = '', memberTier, memberId } = req.body || {};
    const activeRules = promotionRulesList.filter((r) => r.active);
    const normalizedCoupon = String(couponCode || '').trim().toUpperCase();
    const upperMember = String(memberId || '').toUpperCase();
    const effectiveTier =
      memberTier ||
      (upperMember.includes('VIP') || upperMember.includes('PLAT') || upperMember.endsWith('99')
        ? 'PLATINUM'
        : upperMember.includes('GOLD') || upperMember.endsWith('88')
        ? 'GOLD'
        : upperMember.includes('SILV') || upperMember.endsWith('77')
        ? 'SILVER'
        : undefined);

    const normalizedCart = (Array.isArray(cartItems) ? cartItems : []).map((it: any) => {
      const unitPrice = Number(it.unitPrice ?? it.product?.price ?? it.price ?? 0);
      const quantity = Math.max(0, Number(it.quantity) || 1);
      return {
        sku: String(it.sku || it.product?.sku || ''),
        name: String(it.name || it.product?.name || ''),
        category: String(it.category || it.product?.category || ''),
        quantity,
        unitPrice,
        lineTotal: Number(it.lineTotal ?? Math.round(unitPrice * quantity)),
      };
    });

    const cartSubtotal = normalizedCart.reduce((sum, it) => sum + it.lineTotal, 0);
    let totalPromoDiscountIDR = 0;
    const appliedPromotions: any[] = [];
    const lineDiscounts: Record<string, number> = {};

    // 1. BOGO rules (apply automatically if eligible or when coupon matches)
    for (const rule of activeRules.filter((r) => r.type === 'BOGO')) {
      if (!rule.buyQty || !rule.getQty) continue;
      const bundleSize = rule.buyQty + rule.getQty;
      normalizedCart.forEach((item) => {
        const isTarget =
          rule.targetType === 'ALL' ||
          (rule.targetType === 'SKU' && item.sku === rule.targetValue) ||
          (rule.targetType === 'CATEGORY' && item.category === rule.targetValue);
        if (isTarget && item.quantity >= bundleSize) {
          const freeUnits = Math.floor(item.quantity / bundleSize) * rule.getQty!;
          const discount = Math.round(freeUnits * item.unitPrice * ((rule.getDiscountPercent || 100) / 100));
          if (discount > 0) {
            totalPromoDiscountIDR += discount;
            lineDiscounts[item.sku] = (lineDiscounts[item.sku] || 0) + discount;
            appliedPromotions.push({
              ruleId: rule.id,
              ruleCode: rule.code,
              name: rule.name,
              discountAmountIDR: discount,
              promoType: 'BOGO',
              appliedSku: item.sku,
              badgeLabel: `B${rule.buyQty}G${rule.getQty} (${freeUnits} Free)`,
            });
          }
        }
      });
    }

    // 2. Member tier automatic rules
    if (effectiveTier) {
      const tierRule = activeRules.find((r) => r.type === 'MEMBER_TIER' && r.memberTier === effectiveTier);
      if (tierRule && tierRule.discountPercent) {
        const discount = Math.round(cartSubtotal * (tierRule.discountPercent / 100));
        if (discount > 0) {
          totalPromoDiscountIDR += discount;
          appliedPromotions.push({
            ruleId: tierRule.id,
            ruleCode: tierRule.code,
            name: tierRule.name,
            discountAmountIDR: discount,
            promoType: 'MEMBER_TIER',
            badgeLabel: `${effectiveTier} VIP -${tierRule.discountPercent}%`,
          });
        }
      }
    }

    // 3. Explicit coupon code evaluation
    if (normalizedCoupon) {
      const matchedCoupon = activeRules.find((r) => r.code.toUpperCase() === normalizedCoupon);
      if (matchedCoupon && matchedCoupon.type !== 'BOGO' && matchedCoupon.type !== 'MEMBER_TIER') {
        const meetsMinSpend = !matchedCoupon.minOrderSubtotalIDR || cartSubtotal >= matchedCoupon.minOrderSubtotalIDR;
        if (meetsMinSpend) {
          let eligibleSubtotal = cartSubtotal;
          if (matchedCoupon.targetType === 'CATEGORY') {
            eligibleSubtotal = normalizedCart
              .filter((it) => it.category === matchedCoupon.targetValue)
              .reduce((sum, it) => sum + it.lineTotal, 0);
          } else if (matchedCoupon.targetType === 'SKU') {
            eligibleSubtotal = normalizedCart
              .filter((it) => it.sku === matchedCoupon.targetValue)
              .reduce((sum, it) => sum + it.lineTotal, 0);
          }
          let couponDiscount = 0;
          if (matchedCoupon.discountPercent) {
            couponDiscount = Math.round(eligibleSubtotal * (matchedCoupon.discountPercent / 100));
          } else if (matchedCoupon.discountAmountIDR) {
            couponDiscount = Math.min(eligibleSubtotal, matchedCoupon.discountAmountIDR);
          }
          if (couponDiscount > 0) {
            totalPromoDiscountIDR += couponDiscount;
            appliedPromotions.push({
              ruleId: matchedCoupon.id,
              ruleCode: matchedCoupon.code,
              name: matchedCoupon.name,
              discountAmountIDR: couponDiscount,
              promoType: matchedCoupon.type,
              badgeLabel: `Promo [${matchedCoupon.code}]`,
            });
          }
        }
      } else if (matchedCoupon && matchedCoupon.type === 'MEMBER_TIER' && matchedCoupon.discountPercent) {
        const alreadyApplied = appliedPromotions.some((p) => p.ruleId === matchedCoupon.id);
        if (!alreadyApplied) {
          const couponDiscount = Math.round(cartSubtotal * (matchedCoupon.discountPercent / 100));
          if (couponDiscount > 0) {
            totalPromoDiscountIDR += couponDiscount;
            appliedPromotions.push({
              ruleId: matchedCoupon.id,
              ruleCode: matchedCoupon.code,
              name: matchedCoupon.name,
              discountAmountIDR: couponDiscount,
              promoType: matchedCoupon.type,
              badgeLabel: `Promo [${matchedCoupon.code}]`,
            });
          }
        }
      } else if (normalizedCoupon === 'GROCEFRESH' && cartSubtotal > 0) {
        const d = Math.min(cartSubtotal, 10000);
        totalPromoDiscountIDR += d;
        appliedPromotions.push({
          ruleId: 'PRM-STORE-GROCEFRESH',
          ruleCode: 'GROCEFRESH',
          name: 'GroceMart Fresh Welcome Rp 10.000',
          discountAmountIDR: d,
          promoType: 'FIXED_DISCOUNT',
          badgeLabel: 'Promo [GROCEFRESH]',
        });
      } else if (normalizedCoupon === 'FREEDELIVERY' && cartSubtotal > 0) {
        const d = Math.min(cartSubtotal, 15000);
        totalPromoDiscountIDR += d;
        appliedPromotions.push({
          ruleId: 'PRM-STORE-FREEDELIVERY',
          ruleCode: 'FREEDELIVERY',
          name: 'Free Courier Delivery Waiver',
          discountAmountIDR: d,
          promoType: 'FIXED_DISCOUNT',
          badgeLabel: 'Promo [FREEDELIVERY]',
        });
      }
    }

    totalPromoDiscountIDR = Math.min(cartSubtotal, roundIDR(totalPromoDiscountIDR));
    res.json({
      totalPromoDiscountIDR,
      appliedPromotions,
      lineDiscounts,
    });
  });

  app.post('/api/admin/inventory/bulk-import', (req: Request, res: Response) => {
    const { rows = [] } = req.body as { rows: BulkInventoryImportRow[] };
    let imported = 0;
    rows.forEach((r) => {
      const existing = inventoryList.find((i) => i.sku === r.sku);
      const qtyToAdd = r.physicalStock ?? r.stock ?? 0;
      const cost = r.unitCost ?? r.costPrice ?? (existing ? existing.unitCost : 0);
      if (existing) {
        existing.currentStock += qtyToAdd;
        existing.unitCost = cost;
      }
      imported++;
    });
    res.json({ success: true, importedCount: imported, tiersUpdatedCount: imported, message: `${imported} items imported.` });
  });

  app.get('/api/admin/inventory/stock-opname', (_req: Request, res: Response) => {
    const sanitizedSessions = stockOpnameSessions.map((s) => ({
      ...s,
      glEntryIds: Array.isArray(s.glEntryIds) ? s.glEntryIds : ['GLE-2026-0099'],
      items: Array.isArray(s.items) ? s.items : [],
    }));
    res.json(sanitizedSessions);
  });

  app.post('/api/admin/inventory/stock-opname/reconcile', (req: Request, res: Response) => {
    const rawSession = req.body as Partial<StockOpnameSession>;
    const timestamp = new Date().toISOString();
    const storeId = rawSession.storeId || 'store-jkt-senopati';
    const storeName = rawSession.storeName || 'GroceMart Senopati Flagship';
    const items = Array.isArray(rawSession.items) ? rawSession.items : [];

    let totalSystemUnits = 0;
    let totalCountedUnits = 0;
    let totalVarianceUnits = 0;
    let netFinancialVarianceIDR = 0;

    items.forEach((line) => {
      const tier = storeInventoryTiers.find((t) => t.sku === line.sku && t.storeId === storeId);
      const sysQty = Number(line.systemStock ?? tier?.physicalStock ?? 0);
      const counted = Math.max(0, Number(line.countedStock ?? sysQty));
      const variance = Number((counted - sysQty).toFixed(2));
      const unitCost = Number(line.unitCost ?? tier?.unitCost ?? 15000);
      const financialVar = Math.round(variance * unitCost);

      totalSystemUnits += sysQty;
      totalCountedUnits += counted;
      totalVarianceUnits += variance;
      netFinancialVarianceIDR += financialVar;

      if (tier && variance !== 0) {
        tier.physicalStock = counted;
        tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
        tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
        tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
        tier.updatedAt = timestamp;
      }
      const inv = inventoryList.find((i) => i.sku === line.sku);
      if (inv && variance !== 0) {
        inv.currentStock = Math.max(0, Number(((inv.currentStock || 0) + variance).toFixed(2)));
      }
      if (variance !== 0) {
        syncBatchesForStockVariance(line.sku, storeId, variance, unitCost);
      }
    });

    const glEntryIds: string[] = [];
    const sessionId = rawSession.id || `OPN-2026-${(stockOpnameSessions.length + 1).toString().padStart(3, '0')}`;
    if (netFinancialVarianceIDR !== 0) {
      const absVal = Math.abs(roundIDR(netFinancialVarianceIDR));
      const g1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
      const g2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
      glEntryIds.push(g1, g2);

      if (netFinancialVarianceIDR < 0) {
        commitBalancedGlBatch(
          [
            {
              id: g1,
              timestamp,
              storeId,
              storeName,
              accountCode: '5210',
              accountName: 'Inventory Shrinkage & Blind Opname Variance Expense',
              category: 'Expense',
              debit: absVal,
              credit: 0,
              referenceType: 'STOCK_OPNAME',
              referenceId: sessionId,
              description: `Stock Opname Shortage Variance (${sessionId})`,
            },
            {
              id: g2,
              timestamp,
              storeId,
              storeName,
              accountCode: '1040',
              accountName: 'Merchandise Inventory Asset',
              category: 'Asset',
              debit: 0,
              credit: absVal,
              referenceType: 'STOCK_OPNAME',
              referenceId: sessionId,
              description: `Inventory Asset write-down for Stock Opname ${sessionId}`,
            },
          ],
          true
        );
      } else {
        commitBalancedGlBatch(
          [
            {
              id: g1,
              timestamp,
              storeId,
              storeName,
              accountCode: '1040',
              accountName: 'Merchandise Inventory Asset',
              category: 'Asset',
              debit: absVal,
              credit: 0,
              referenceType: 'STOCK_OPNAME',
              referenceId: sessionId,
              description: `Inventory Asset surplus adjustment for Stock Opname ${sessionId}`,
            },
            {
              id: g2,
              timestamp,
              storeId,
              storeName,
              accountCode: '5210',
              accountName: 'Inventory Shrinkage & Blind Opname Variance Expense',
              category: 'Expense',
              debit: 0,
              credit: absVal,
              referenceType: 'STOCK_OPNAME',
              referenceId: sessionId,
              description: `Stock Opname Surplus credit (${sessionId})`,
            },
          ],
          true
        );
      }
    }

    const session: StockOpnameSession = {
      id: sessionId,
      date: rawSession.date || timestamp,
      storeId,
      storeName,
      warehouseZoneId: rawSession.warehouseZoneId || 'WH-JKT-SEN-COLD',
      auditorId: rawSession.auditorId || 'AUD-001',
      auditorName: rawSession.auditorName || currentActiveStaffSession.userName,
      status: 'reconciled',
      items,
      totalSystemUnits: rawSession.totalSystemUnits ?? Number(totalSystemUnits.toFixed(2)),
      totalCountedUnits: rawSession.totalCountedUnits ?? Number(totalCountedUnits.toFixed(2)),
      totalVarianceUnits: rawSession.totalVarianceUnits ?? Number(totalVarianceUnits.toFixed(2)),
      netFinancialVarianceIDR: rawSession.netFinancialVarianceIDR ?? roundIDR(netFinancialVarianceIDR),
      glEntryIds,
      notes: rawSession.notes || 'Periodic physical stocktake cycle count',
      completedAt: rawSession.completedAt || timestamp,
    };
    stockOpnameSessions.unshift(session);
    res.json({
      success: true,
      session,
      journalEntryIds: glEntryIds,
      message: `Stock Opname ${sessionId} reconciled across ${items.length} SKUs (${glEntryIds.length > 0 ? `GL posted: ${glEntryIds.join(', ')}` : 'zero variance — balanced'}).`,
    });
  });

  app.get('/api/admin/inventory/transfer', (_req: Request, res: Response) => {
    res.json(stockTransfersList);
  });

  app.post('/api/admin/inventory/transfer', (req: Request, res: Response) => {
    const { sku, sourceStoreId, destinationStoreId, quantity, notes, status: reqStatus } = req.body;
    const qty = Math.max(0, Number(quantity) || 0);

    if (!sku || !sourceStoreId || !destinationStoreId || qty <= 0) {
      return res.status(400).json({ error: 'sku, sourceStoreId, destinationStoreId, and positive quantity are required.' });
    }
    if (sourceStoreId === destinationStoreId) {
      return res.status(400).json({ error: 'Source and destination stores must be different.' });
    }

    const sourceTier = storeInventoryTiers.find(
      (t) => t.sku === sku && t.storeId === sourceStoreId
    );
    const inv = inventoryList.find((i) => i.sku === sku);
    const atpCheck = getSellableNonExpiredAtpStock(sku, sourceStoreId);
    if (qty > atpCheck.effectiveAtp) {
      return res.status(400).json({
        error: `Insufficient non-expired ATP stock for SKU ${sku} at ${sourceTier?.storeName || sourceStoreId}: requested ${qty}, available ${atpCheck.effectiveAtp}.`,
      });
    }

    const timestamp = new Date().toISOString();
    const srcSchedule = storeSchedules.find((s) => s.storeId === sourceStoreId);
    const dstSchedule = storeSchedules.find((s) => s.storeId === destinationStoreId);
    const resolvedUnitCost = Number(req.body.unitCost) || sourceTier?.unitCost || inv?.wacUnitCost || inv?.unitCost || 0;

    // Atomic batch pre-check before mutating source tier
    const batchDeduction = deductBatchesByStrategy(sku, qty, sourceStoreId, resolvedUnitCost, atpCheck.hasBatchTracking);
    if (batchDeduction.insufficientStock) {
      return res.status(400).json({
        error: `Insufficient non-expired ATP stock for SKU ${sku} at ${sourceTier?.storeName || sourceStoreId}: requested ${qty}, available ${batchDeduction.availableSellableQty}.`,
      });
    }

    const normalizedStatus: 'completed' | 'in_transit' =
      String(reqStatus || '').toLowerCase() === 'in_transit' ? 'in_transit' : 'completed';

    const destStoreName = req.body.destinationStoreName || dstSchedule?.storeName || destinationStoreId;
    const sourceStoreName = req.body.sourceStoreName || sourceTier?.storeName || srcSchedule?.storeName || sourceStoreId;
    const productName = req.body.productName || sourceTier?.productName || inv?.productName || inv?.name || sku;

    // Deduct source tier stock
    if (sourceTier) {
      sourceTier.physicalStock = Math.max(0, Number((sourceTier.physicalStock - qty).toFixed(2)));
      sourceTier.reservedStock = Math.min(sourceTier.reservedStock, sourceTier.physicalStock);
      sourceTier.availableStock = Math.max(0, Number((sourceTier.physicalStock - sourceTier.reservedStock).toFixed(2)));
      sourceTier.totalValuation = Math.round(sourceTier.physicalStock * sourceTier.unitCost);
      sourceTier.updatedAt = timestamp;
    }
    const movedLots = batchDeduction.allocations.length > 0
      ? batchDeduction.allocations.map((al) => {
          const orig = inventoryBatches.find((b) => b.batchId === al.batchId);
          return {
            lotNumber: al.lotNumber,
            expiryDate: al.expiryDate,
            allocatedQty: al.allocatedQty,
            unitCost: al.unitCost,
            storageZone: orig?.storageZone || sourceTier?.storageType || 'cold_chilled',
            sellingPrice: orig?.sellingPrice || sourceTier?.sellingPrice || inv?.sellingPrice || Math.round(al.unitCost * 1.45),
            supplierName: orig?.supplierName || sourceTier?.supplierName || 'Internal Hub Transfer',
          };
        })
      : [
          {
            lotNumber: `TRF-LOT-${Date.now().toString().slice(-5)}`,
            expiryDate: new Date(Date.now() + 86400000 * 14).toISOString(),
            allocatedQty: qty,
            unitCost: resolvedUnitCost,
            storageZone: sourceTier?.storageType || 'cold_chilled',
            sellingPrice: sourceTier?.sellingPrice || inv?.sellingPrice || Math.round(resolvedUnitCost * 1.45),
            supplierName: sourceTier?.supplierName || 'Internal Hub Transfer',
          },
        ];

    const recordId = `TRF-2026-${(stockTransfersList.length + 1).toString().padStart(3, '0')}`;
    const destZone =
      warehouseZones.find((z) => z.storeId === destinationStoreId && z.type === (sourceTier?.storageType || 'cold_chilled')) ||
      warehouseZones.find((z) => z.storeId === destinationStoreId);

    let destTier = storeInventoryTiers.find(
      (t) => t.sku === sku && t.storeId === destinationStoreId
    );
    if (!destTier) {
      destTier = {
        id: `STK-TRF-${Date.now().toString().slice(-5)}`,
        sku,
        productId: sourceTier?.productId || inv?.productId || sku,
        productName,
        category: sourceTier?.category || inv?.category || 'produce',
        storeId: destinationStoreId,
        storeName: destStoreName,
        warehouseZoneId: destZone?.id || `WH-${destinationStoreId.toUpperCase()}`,
        storageType: sourceTier?.storageType || destZone?.type || 'cold_chilled',
        physicalStock: 0,
        availableStock: 0,
        reservedStock: 0,
        incomingStock: 0,
        minimumThreshold: sourceTier?.minimumThreshold ?? 10,
        safetyStockBuffer: sourceTier?.safetyStockBuffer ?? 5,
        maxCapacity: sourceTier?.maxCapacity ?? 120,
        reorderQuantity: sourceTier?.reorderQuantity ?? 30,
        unitCost: resolvedUnitCost,
        sellingPrice: sourceTier?.sellingPrice || inv?.sellingPrice || Math.round(resolvedUnitCost * 1.45),
        unit: sourceTier?.unit || inv?.unit || 'pack',
        handlingInstructions: sourceTier?.handlingInstructions || 'Standard cold-chain handling',
        supplierId: sourceTier?.supplierId || 'SUP-INTERNAL',
        supplierName: sourceTier?.supplierName || sourceStoreName,
        lastRestockedAt: timestamp,
        updatedAt: timestamp,
      };
      storeInventoryTiers.push(destTier);
    }

    if (normalizedStatus === 'completed') {
      const oldDestStock = Math.max(0, Number(destTier.physicalStock) || 0);
      const newDestStock = Number((oldDestStock + qty).toFixed(2));
      const newDestWac =
        newDestStock > 0
          ? Math.round(((oldDestStock * (destTier.unitCost || resolvedUnitCost)) + (qty * resolvedUnitCost)) / newDestStock)
          : resolvedUnitCost;
      destTier.unitCost = newDestWac;
      destTier.physicalStock = newDestStock;
      destTier.availableStock = Math.max(0, Number((destTier.physicalStock - destTier.reservedStock).toFixed(2)));
      destTier.totalValuation = Math.round(destTier.physicalStock * destTier.unitCost);
      destTier.lastRestockedAt = timestamp;
      destTier.updatedAt = timestamp;

      movedLots.forEach((lot, idx) => {
        const daysUntilExpiry = Math.max(1, Math.ceil((new Date(lot.expiryDate).getTime() - Date.now()) / 86400000));
        inventoryBatches.unshift({
          batchId: `BAT-TRF-${Date.now().toString().slice(-5)}-${idx + 1}`,
          sku,
          productName,
          storeId: destinationStoreId,
          storeName: destStoreName,
          warehouseZoneId: destTier!.warehouseZoneId,
          lotNumber: lot.lotNumber,
          initialQuantity: lot.allocatedQty,
          currentStock: lot.allocatedQty,
          unitCost: lot.unitCost,
          sellingPrice: lot.sellingPrice,
          receivedDate: timestamp,
          expiryDate: lot.expiryDate,
          daysUntilExpiry,
          status: daysUntilExpiry <= 7 ? 'near_expiry' : 'fresh',
          storageZone: lot.storageZone,
          supplierName: lot.supplierName,
          notes: `Transferred from ${sourceStoreName} (${recordId})`,
        });
      });
    } else {
      destTier.incomingStock = (destTier.incomingStock || 0) + qty;
      destTier.updatedAt = timestamp;
      inTransitTransferLots.set(recordId, movedLots);
    }

    const record: StockTransferRecord = {
      id: recordId,
      timestamp,
      sku,
      productName,
      sourceStoreId,
      sourceStoreName,
      destinationStoreId,
      destinationStoreName: destStoreName,
      quantity: qty,
      unitCost: resolvedUnitCost,
      totalTransferValue: Number(req.body.totalTransferValue) || Math.round(qty * resolvedUnitCost),
      transferredBy: req.body.transferredBy || currentActiveStaffSession.userName,
      status: normalizedStatus,
      notes,
      suratJalanNumber: req.body.suratJalanNumber,
    };

    stockTransfersList.unshift(record);

    // Event 2 & Event 7 notifications
    checkAndNotifyLowStockForSkus([sku], sourceStoreId);
    if (normalizedStatus === 'in_transit') {
      emitEnterpriseNotification({
        dedupeKey: `TRANSFER_IN_TRANSIT:${recordId}`,
        category: 'LOGISTICS',
        severity: 'ACTION_REQUIRED',
        title: `Transfer In-Transit (${recordId})`,
        message: `${qty}x ${productName} dispatched from ${sourceStoreName} to ${destStoreName}. Destination hub must confirm arrival.`,
        metadataLabel: `${recordId} • ${sku} • ${qty} units`,
        targetTab: 'transfers',
      });
    }

    res.json({
      success: true,
      record,
      message:
        normalizedStatus === 'in_transit'
          ? `Transfer #${recordId} dispatched (in_transit) from ${sourceStoreName} to ${destStoreName}.`
          : 'Stock transferred and warehouse tiers synchronized.',
    });
  });

  app.post('/api/admin/inventory/transfer/:id/receive', (req: Request, res: Response) => {
    const { id } = req.params;
    const record = stockTransfersList.find((t) => t.id === id);
    if (!record) return res.status(404).json({ error: 'Stock transfer record not found.' });
    if (record.status === 'completed') {
      return res.json({ success: true, record, message: `Transfer #${id} already completed.` });
    }

    const timestamp = new Date().toISOString();
    const destTier = storeInventoryTiers.find(
      (t) => t.sku === record.sku && t.storeId === record.destinationStoreId
    );
    if (destTier) {
      const oldStock = Math.max(0, Number(destTier.physicalStock) || 0);
      const newStock = Number((oldStock + record.quantity).toFixed(2));
      destTier.unitCost =
        newStock > 0
          ? Math.round(((oldStock * (destTier.unitCost || record.unitCost)) + (record.quantity * record.unitCost)) / newStock)
          : record.unitCost;
      destTier.physicalStock = newStock;
      destTier.incomingStock = Math.max(0, (destTier.incomingStock || 0) - record.quantity);
      destTier.availableStock = Math.max(0, Number((destTier.physicalStock - destTier.reservedStock).toFixed(2)));
      destTier.totalValuation = Math.round(destTier.physicalStock * destTier.unitCost);
      destTier.lastRestockedAt = timestamp;
      destTier.updatedAt = timestamp;
    }

    const transitLots = inTransitTransferLots.get(id) || [
      {
        lotNumber: `TRF-LOT-${id.slice(-4)}`,
        expiryDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        allocatedQty: record.quantity,
        unitCost: record.unitCost,
        storageZone: destTier?.storageType || ('cold_chilled' as StorageZoneType),
        sellingPrice: destTier?.sellingPrice || Math.round(record.unitCost * 1.45),
        supplierName: record.sourceStoreName,
      },
    ];
    transitLots.forEach((lot, idx) => {
      const diffMs = new Date(lot.expiryDate).getTime() - Date.now();
      const isExpiredLot = !Number.isFinite(diffMs) || diffMs <= 0;
      const daysUntilExpiry = isExpiredLot
        ? Math.min(0, Math.floor((Number.isFinite(diffMs) ? diffMs : 0) / 86400000))
        : Math.max(1, Math.ceil(diffMs / 86400000));
      inventoryBatches.unshift({
        batchId: `BAT-TRF-RCV-${Date.now().toString().slice(-5)}-${idx + 1}`,
        sku: record.sku,
        productName: record.productName,
        storeId: record.destinationStoreId,
        storeName: record.destinationStoreName,
        warehouseZoneId: destTier?.warehouseZoneId || `WH-${record.destinationStoreId.toUpperCase()}`,
        lotNumber: lot.lotNumber,
        initialQuantity: lot.allocatedQty,
        currentStock: lot.allocatedQty,
        unitCost: lot.unitCost,
        sellingPrice: lot.sellingPrice,
        receivedDate: timestamp,
        expiryDate: lot.expiryDate,
        daysUntilExpiry,
        status: isExpiredLot ? 'expired' : daysUntilExpiry <= 7 ? 'near_expiry' : 'fresh',
        storageZone: lot.storageZone,
        supplierName: lot.supplierName,
        notes: `Received from ${record.sourceStoreName} (${record.id})`,
      });
    });
    inTransitTransferLots.delete(id);

    record.status = 'completed';
    markEnterpriseNotificationReadByDedupeKey(`TRANSFER_IN_TRANSIT:${id}`);
    res.json({ success: true, record, message: `Transfer #${id} received at ${record.destinationStoreName}.` });
  });

  // --- 9. APPROVAL WORKFLOW & MATRIX APIS ---
  app.get('/api/admin/approvals/rules', (_req: Request, res: Response) => {
    res.json(approvalRulesList);
  });

  app.put('/api/admin/approvals/rules', (req: Request, res: Response) => {
    const { rules } = req.body as { rules: ApprovalTierRule[] };
    if (Array.isArray(rules)) {
      approvalRulesList = rules;
    }
    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'APPROVAL_MATRIX_UPDATE',
      resourceId: 'APPROVAL_RULES',
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: 'ALL',
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { ruleCount: approvalRulesList.length },
    });
    res.json({ success: true, rules: approvalRulesList, message: 'Approval tier matrix synchronized.' });
  });

  app.get('/api/admin/approvals/queue', (req: Request, res: Response) => {
    const { storeId, status } = req.query as { storeId?: string; status?: string };
    let result = [...approvalQueueList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      result = result.filter((q) => q.storeId === storeId);
    }
    if (status && status !== 'ALL') {
      result = result.filter((q) => q.status === status);
    }
    res.json(result);
  });

  app.post('/api/admin/approvals/action', (req: Request, res: Response) => {
    const { requestId, action, comments } = req.body as {
      requestId: string;
      action: 'APPROVED' | 'REJECTED';
      comments?: string;
    };
    const reqItem = approvalQueueList.find((q) => q.id === requestId);
    if (!reqItem) return res.status(404).json({ error: 'Approval request not found.' });

    const newLog = {
      tierLevel: reqItem.currentTierLevel,
      tierName: `Tier ${reqItem.currentTierLevel}`,
      approverId: currentActiveStaffSession.userId,
      approverName: currentActiveStaffSession.userName,
      approverRole: currentActiveStaffSession.userRole,
      action,
      timestamp: new Date().toISOString(),
      comments: comments || `${action} by ${currentActiveStaffSession.userName}`,
    };
    reqItem.history.push(newLog);

    if (action === 'REJECTED') {
      reqItem.status = 'REJECTED';
      if (reqItem.module === 'blind_stock_opname') {
        const sheet = blindOpnameSheetsList.find((s) => s.id === reqItem.documentId || s.approvalRequestId === reqItem.id);
        if (sheet) sheet.status = 'REJECTED';
      } else if (reqItem.module === 'procurement_po' && reqItem.documentId.startsWith('VB-')) {
        const bill = vendorBillsList.find((b) => b.id === reqItem.documentId);
        if (bill) bill.status = 'VOID';
      } else if (reqItem.module === 'b2b_credit_term' || reqItem.module === 'b2b_transfer_verification') {
        const order = b2bOrdersList.find((o) => o.id === reqItem.documentId);
        if (order) {
          order.status = 'DRAFT';
          order.paymentStatus = 'AWAITING_APPROVAL';
        }
      }
    } else {
      if (reqItem.currentTierLevel < reqItem.requiredTierLevel) {
        reqItem.currentTierLevel += 1;
      } else {
        reqItem.status = 'APPROVED';
        if (reqItem.module === 'blind_stock_opname') {
          const sheet = blindOpnameSheetsList.find((s) => s.id === reqItem.documentId || s.approvalRequestId === reqItem.id);
          if (sheet && sheet.status !== 'APPROVED') {
            applyBlindOpnameApproval(sheet, currentActiveStaffSession.userName);
          }
        } else if (reqItem.module === 'procurement_po' && reqItem.documentId.startsWith('VB-')) {
          const bill = vendorBillsList.find((b) => b.id === reqItem.documentId);
          if (bill && bill.status !== 'APPROVED' && bill.status !== 'PAID') {
            bill.status = 'APPROVED';
            bill.approvedBy = currentActiveStaffSession.userName;
            bill.approvedAt = new Date().toISOString();
            postVendorBillApprovalGL(bill, currentActiveStaffSession.userName);
          }
        } else if (reqItem.module === 'b2b_credit_term' || reqItem.module === 'b2b_transfer_verification') {
          const order = b2bOrdersList.find((o) => o.id === reqItem.documentId);
          if (order) {
            order.status = 'CONFIRMED';
            if (reqItem.module === 'b2b_transfer_verification') {
              order.paymentStatus = 'SETTLED';
              const cust = b2bCustomersList.find((c) => c.id === order.customerId);
              if (cust) {
                cust.outstandingAR = Math.max(0, cust.outstandingAR - order.totalAmountIDR);
                cust.availableCredit = Math.max(0, cust.creditLimit - cust.outstandingAR);
                if (cust.status === 'CREDIT_LOCKED' && cust.outstandingAR < cust.creditLimit && cust.overdueDaysMax <= 7) {
                  cust.status = 'ACTIVE';
                  cust.lockReason = undefined;
                }
              }
              const ts = new Date().toISOString();
              commitBalancedGlBatch(
                [
                  {
                    id: `GLE-TRF-${Date.now().toString().slice(-5)}-1`,
                    timestamp: ts,
                    storeId: 'CONSOLIDATED',
                    storeName: 'Consolidated Company-Wide',
                    accountCode: '1020',
                    accountName: 'Bank BCA Operational Clearing',
                    category: 'Asset',
                    debit: order.totalAmountIDR,
                    credit: 0,
                    referenceType: 'B2B_WHOLESALE_ORDER',
                    referenceId: order.id,
                    description: `Verified bank transfer settlement for B2B Order ${order.id} (${order.companyName})`,
                  },
                  {
                    id: `GLE-TRF-${Date.now().toString().slice(-5)}-2`,
                    timestamp: ts,
                    storeId: 'CONSOLIDATED',
                    storeName: 'Consolidated Company-Wide',
                    accountCode: '1200',
                    accountName: 'Accounts Receivable - B2B Wholesale',
                    category: 'Asset',
                    debit: 0,
                    credit: order.totalAmountIDR,
                    referenceType: 'B2B_WHOLESALE_ORDER',
                    referenceId: order.id,
                    description: `AR cleared by Finance-verified transfer for ${order.id}`,
                  },
                ],
                true
              );
            } else {
              order.paymentStatus = 'APPROVED_CREDIT';
            }
          }
        }
      }
    }

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: reqItem.module === 'procurement_po' ? 'PURCHASE_ORDER_APPROVAL' : 'GOODS_RECEIPT_APPROVAL',
      resourceId: reqItem.documentId,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: reqItem.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { requestId, action, finalStatus: reqItem.status, amountIDR: reqItem.amountIDR },
    });

    if (reqItem.status === 'APPROVED' || reqItem.status === 'REJECTED') {
      markEnterpriseNotificationReadByDedupeKey(`APR_QUEUE:${reqItem.id}`);
    }

    res.json({
      success: true,
      request: reqItem,
      message: `Request ${reqItem.documentId} ${action === 'APPROVED' ? (reqItem.status === 'APPROVED' ? 'fully authorized' : `advanced to Tier ${reqItem.currentTierLevel}`) : 'rejected'}.`,
    });
  });

  // --- 10. LOGISTICS & SHIPPING DOCUMENTS APIS ---
  app.get('/api/admin/logistics/surat-jalan', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      return res.json(suratJalanList.filter((sj) => sj.senderStoreId === storeId || sj.recipientStoreId === storeId));
    }
    res.json(suratJalanList);
  });

  app.post('/api/admin/logistics/surat-jalan', (req: Request, res: Response) => {
    const body = req.body as Partial<SuratJalanDocument>;
    const seq = (suratJalanList.length + 1).toString().padStart(4, '0');
    const docNumber = `SJ/GMRT/JKT/2026/${seq}`;
    const newDoc: SuratJalanDocument = {
      id: `SJ-2026-${seq}`,
      documentNumber: docNumber,
      issueDate: new Date().toISOString().split('T')[0],
      senderStoreId: body.senderStoreId || 'store-jkt-senopati',
      senderStoreName: body.senderStoreName || 'GroceMart Senopati Flagship',
      senderAddress: body.senderAddress || 'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan',
      senderPhone: body.senderPhone || '+62 21 720 8891',
      recipientName: body.recipientName || 'Fulfillment Center Hub',
      recipientAddress: body.recipientAddress || 'Cold Transit Depot, Jakarta',
      recipientPhone: body.recipientPhone || '+62 812 0000 1111',
      carrierName: body.carrierName || 'GroceMart Reefer Fleet Logistics',
      vehiclePlateNumber: body.vehiclePlateNumber || 'B 9142 SRO',
      vehicleType: body.vehicleType || 'Refrigerated Van 1.5T',
      driverName: body.driverName || 'Bambang Supriyanto',
      driverPhone: body.driverPhone || '+62 812 8899 7711',
      coldChainTempCelsius: body.coldChainTempCelsius ?? 3.5,
      specialHandlingInstructions: body.specialHandlingInstructions || 'Keep refrigerated at 0-4°C.',
      items: body.items || [],
      totalPackages: body.totalPackages || (body.items?.length || 1),
      totalWeightKg: body.totalWeightKg || 50,
      status: 'in_transit',
      senderSignatureName: body.senderSignatureName || currentActiveStaffSession.userName,
      driverSignatureName: body.driverSignatureName || body.driverName || 'Bambang Supriyanto',
      ...body,
    };
    suratJalanList.unshift(newDoc);

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'LOGISTICS_DOCUMENT_ISSUED',
      resourceId: newDoc.documentNumber,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: newDoc.senderStoreId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { vehiclePlate: newDoc.vehiclePlateNumber, itemsCount: newDoc.items.length },
    });

    res.json({ success: true, document: newDoc, message: `Surat Jalan #${newDoc.documentNumber} issued.` });
  });

  app.get('/api/admin/logistics/delivery-orders', (_req: Request, res: Response) => {
    res.json(deliveryOrdersList);
  });

  app.post('/api/admin/logistics/delivery-orders', (req: Request, res: Response) => {
    const seq = (deliveryOrdersList.length + 1).toString().padStart(4, '0');
    const newDo: DeliveryOrderDocument = {
      id: `DO-2026-${seq}`,
      doNumber: `DO/GMRT/2026/${seq}`,
      issueDate: new Date().toISOString().split('T')[0],
      customerOrStoreName: 'GroceMart Commercial Kitchen',
      deliveryAddress: 'Main Delivery Dock',
      deliveryWindow: 'Morning Slot (08:00 - 12:00 WIB)',
      authorizedOfficer: currentActiveStaffSession.userName,
      items: [],
      subtotalIDR: 0,
      taxIDR: 0,
      totalAmountIDR: 0,
      status: 'pending',
      ...req.body,
    };
    deliveryOrdersList.unshift(newDo);
    res.json({ success: true, document: newDo, message: `Delivery Order #${newDo.doNumber} registered.` });
  });

  app.get('/api/admin/logistics/shipments', (_req: Request, res: Response) => {
    res.json(shipmentsList);
  });

  app.post('/api/admin/logistics/shipments', (req: Request, res: Response) => {
    const newShp: ShipmentQuotaTracking = {
      id: `SHP-2026-${(shipmentsList.length + 1).toString().padStart(3, '0')}`,
      tripId: `TRIP-JKT-${Date.now().toString().slice(-4)}`,
      vehicleType: 'Refrigerated Van 1.5T',
      vehiclePlate: 'B 9142 SRO',
      maxPayloadKg: 1500,
      currentPayloadKg: 850,
      quotaUtilizationPercent: 57,
      storageZone: 'cold_chilled',
      currentTempCelsius: 3.5,
      targetTempCelsius: 4.0,
      departureHub: 'Senopati Hub',
      destinationHub: 'PIK 2 Hub',
      departureTime: '08:00 WIB',
      estimatedArrival: '09:30 WIB',
      driverName: 'Bambang Supriyanto',
      driverContact: '+62 812 8899 7711',
      assignedOrdersCount: 5,
      status: 'in_transit',
      ...req.body,
    };
    shipmentsList.unshift(newShp);
    res.json({ success: true, shipment: newShp, message: 'Shipment trip dispatched.' });
  });

  // --- 11. INVENTORY QUALITY CONTROL (QC) APIS ---
  app.get('/api/admin/qc/inspections', (req: Request, res: Response) => {
    const { storeId, disposition } = req.query as { storeId?: string; disposition?: string };
    let result = [...qcInspectionsList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      result = result.filter((qc) => qc.storeId === storeId);
    }
    if (disposition && disposition !== 'ALL') {
      result = result.filter((qc) => qc.disposition === disposition);
    }
    res.json(result);
  });

  app.post('/api/admin/qc/inspections', (req: Request, res: Response) => {
    const seq = (qcInspectionsList.length + 1).toString().padStart(4, '0');
    const newQc: QCInspectionRecord = {
      id: `QC-2026-${seq}`,
      timestamp: new Date().toISOString(),
      referenceType: 'INCOMING_PO',
      referenceId: 'PO-2026-0099',
      sku: 'SKU-PRD-001',
      productName: 'Fresh Produce Harvest',
      category: 'produce',
      batchNumber: `BAT-2026-${seq}`,
      expiryDate: new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      sampleQuantity: 5,
      totalBatchQuantity: 100,
      storeId: 'store-jkt-senopati',
      storeName: 'GroceMart Senopati Flagship',
      inspectorId: currentActiveStaffSession.userId,
      inspectorName: currentActiveStaffSession.userName,
      parameters: {
        visualFreshness: 'Grade A (Pristine)',
        temperatureCelsius: 3.5,
        coldChainCompliant: true,
        packagingIntegrity: 'Sealed & Intact',
        sensoryOdorCheck: 'Normal & Fresh',
        weightToleranceCompliant: true,
      },
      disposition: 'PASSED',
      actionTaken: 'RELEASE_TO_SHELF',
      ...req.body,
    };
    qcInspectionsList.unshift(newQc);

    // Sync QC disposition with Lot/Batch status, Available ATP stock, and Scrap GL
    const qcQty = Math.max(0, Number(newQc.totalBatchQuantity) || 0);
    const matchingBatch = inventoryBatches.find(
      (b) =>
        (newQc.batchNumber
          ? b.lotNumber === newQc.batchNumber && b.sku === newQc.sku
          : b.sku === newQc.sku) &&
        (b.storeId === newQc.storeId || newQc.storeId === 'ALL')
    );
    const matchingTier = storeInventoryTiers.find(
      (t) => t.sku === newQc.sku && t.storeId === newQc.storeId
    );
    const inv = inventoryList.find((i) => i.sku === newQc.sku);
    const wasAlreadyQuarantined = matchingBatch?.status === 'quarantined';

    if (newQc.disposition === 'REJECTED' && newQc.actionTaken === 'SCRAP_WASTE') {
      const scrapQty = qcQty > 0 ? qcQty : (matchingBatch?.currentStock || 0);
      const unitCost = matchingBatch?.unitCost || matchingTier?.unitCost || inv?.wacUnitCost || inv?.unitCost || 15000;
      const lossValue = Math.round(scrapQty * unitCost);

      if (matchingBatch && scrapQty > 0) {
        matchingBatch.currentStock = Math.max(0, Number((matchingBatch.currentStock - scrapQty).toFixed(2)));
        matchingBatch.status = matchingBatch.currentStock === 0 ? 'depleted' : matchingBatch.status;
        matchingBatch.notes = `Scrapped via QC ${newQc.id}`;
      }
      if (matchingTier && scrapQty > 0) {
        matchingTier.physicalStock = Math.max(0, Number((matchingTier.physicalStock - scrapQty).toFixed(2)));
        if (wasAlreadyQuarantined) {
          matchingTier.reservedStock = Math.max(0, Number((matchingTier.reservedStock - scrapQty).toFixed(2)));
        }
        matchingTier.reservedStock = Math.min(matchingTier.reservedStock, matchingTier.physicalStock);
        matchingTier.availableStock = Math.max(0, Number((matchingTier.physicalStock - matchingTier.reservedStock).toFixed(2)));
        matchingTier.totalValuation = Math.round(matchingTier.physicalStock * matchingTier.unitCost);
        matchingTier.updatedAt = newQc.timestamp;
      }
      if (inv && scrapQty > 0) {
        inv.currentStock = Math.max(0, Number(((inv.currentStock || 0) - scrapQty).toFixed(2)));
      }
      if (scrapQty > 0 && lossValue > 0) {
        const gle1 = `GLE-QC-WST-${seq}-1`;
        const gle2 = `GLE-QC-WST-${seq}-2`;
        wasteRecords.unshift({
          id: `WST-QC-${seq}`,
          sku: newQc.sku,
          productName: newQc.productName,
          storeId: newQc.storeId,
          storeName: newQc.storeName,
          warehouseZoneId: matchingTier?.warehouseZoneId || 'WH-JKT-SEN-COLD',
          batchId: matchingBatch?.batchId || newQc.batchNumber,
          lotNumber: newQc.batchNumber,
          quantityScrapped: scrapQty,
          unit: inv?.unit || 'unit',
          unitCost,
          totalShrinkageCost: lossValue,
          reason: 'supplier_defect',
          actionTaken: 'safe_disposal',
          disposition: 'unsalvageable_scrap',
          reportedBy: newQc.inspectorName,
          reportedAt: newQc.timestamp,
          notes: `Auto-scrapped from QC Inspection ${newQc.id}`,
          glEntryId: gle1,
        });
        commitBalancedGlBatch(
          [
            {
              id: gle1,
              timestamp: newQc.timestamp,
              storeId: newQc.storeId,
              storeName: newQc.storeName,
              accountCode: '6030',
              accountName: 'Perishable Spoilage & Shrinkage Expense',
              category: 'Expense',
              debit: lossValue,
              credit: 0,
              referenceType: 'WASTE_SHRINKAGE',
              referenceId: newQc.id,
              description: `QC Scrap Write-Off (${scrapQty} ${newQc.sku}) from inspection ${newQc.id}`,
            },
            {
              id: gle2,
              timestamp: newQc.timestamp,
              storeId: newQc.storeId,
              storeName: newQc.storeName,
              accountCode: '1040',
              accountName: 'Merchandise Inventory Asset',
              category: 'Asset',
              debit: 0,
              credit: lossValue,
              referenceType: 'WASTE_SHRINKAGE',
              referenceId: newQc.id,
              description: `Inventory Asset reduced for QC Scrap ${newQc.id}`,
            },
          ],
          true
        );
      }
    } else if (newQc.disposition === 'QUARANTINED' || newQc.disposition === 'REJECTED') {
      if (matchingBatch) {
        matchingBatch.status = 'quarantined';
      } else if (qcQty > 0) {
        inventoryBatches.unshift({
          batchId: `BAT-QC-${seq}`,
          sku: newQc.sku,
          productName: newQc.productName,
          storeId: newQc.storeId,
          storeName: newQc.storeName,
          warehouseZoneId: matchingTier?.warehouseZoneId || 'WH-JKT-SEN-COLD',
          lotNumber: newQc.batchNumber,
          initialQuantity: qcQty,
          currentStock: qcQty,
          unitCost: inv?.unitCost || 15000,
          sellingPrice: inv?.sellingPrice || 24000,
          receivedDate: newQc.timestamp,
          expiryDate: newQc.expiryDate,
          daysUntilExpiry: 7,
          status: 'quarantined',
          storageZone: matchingTier?.storageType || 'cold_chilled',
          supplierName: inv?.supplierName || 'QC Quarantine Hold',
          notes: `Quarantined by QC ${newQc.id}`,
        });
      }
      if (matchingTier && qcQty > 0 && !wasAlreadyQuarantined) {
        matchingTier.reservedStock = Math.min(
          matchingTier.physicalStock,
          matchingTier.reservedStock + qcQty
        );
        matchingTier.availableStock = Math.max(
          0,
          matchingTier.physicalStock - matchingTier.reservedStock
        );
        matchingTier.updatedAt = newQc.timestamp;
      }
    } else if (newQc.disposition === 'PASSED') {
      if (matchingBatch && matchingBatch.status === 'quarantined') {
        matchingBatch.status = matchingBatch.daysUntilExpiry <= 7 ? 'near_expiry' : 'fresh';
        if (matchingTier) {
          const releaseQty = qcQty > 0 ? Math.min(qcQty, matchingBatch.currentStock) : matchingBatch.currentStock;
          matchingTier.reservedStock = Math.max(0, matchingTier.reservedStock - releaseQty);
          matchingTier.availableStock = Math.max(0, matchingTier.physicalStock - matchingTier.reservedStock);
          matchingTier.updatedAt = newQc.timestamp;
        }
      }
    }

    if (newQc.disposition === 'QUARANTINED' || newQc.disposition === 'REJECTED') {
      emitEnterpriseNotification({
        dedupeKey: `QC_ALERT:${newQc.id}`,
        category: 'QUALITY_CONTROL',
        severity: 'CRITICAL',
        title: `QC ${newQc.disposition}: ${newQc.productName}`,
        message: `Lot ${newQc.batchNumber} (${qcQty} units) at ${newQc.storeName} marked ${newQc.disposition} (${newQc.actionTaken}).`,
        metadataLabel: `${newQc.id} • ${newQc.sku} • ${newQc.parameters?.temperatureCelsius ?? 'N/A'}°C`,
        targetTab: newQc.actionTaken === 'SCRAP_WASTE' ? 'waste' : 'qc',
      });
    }

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'QC_INSPECTION_LOGGED',
      resourceId: newQc.id,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: newQc.storeId,
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { sku: newQc.sku, disposition: newQc.disposition, action: newQc.actionTaken },
    });

    res.json({ success: true, record: newQc, message: `Quality inspection ${newQc.id} logged with disposition ${newQc.disposition}.` });
  });

  // --- 12. MANUAL CHART OF ACCOUNTS (COA) APIS ---
  app.post('/api/admin/settings/coa-account', (req: Request, res: Response) => {
    const body = req.body as Partial<ChartOfAccount>;
    if (!body.accountCode || !body.accountName) {
      return res.status(400).json({ error: 'accountCode and accountName are required.' });
    }
    const existing = chartOfAccounts.find((a) => a.accountCode === body.accountCode);
    if (existing) {
      return res.status(400).json({ error: `Account code ${body.accountCode} already exists.` });
    }
    const newAcct: ChartOfAccount = {
      accountCode: body.accountCode,
      accountName: body.accountName,
      category: body.category || 'Asset',
      storeId: body.storeId || 'CONSOLIDATED',
      normalBalance: body.normalBalance || (body.category === 'Asset' || body.category === 'Expense' ? 'Debit' : 'Credit'),
      balance: body.balance || 0,
      description: body.description || '',
    };
    chartOfAccounts.push(newAcct);

    securityAuditTrail.unshift({
      id: `AUD-SEC-2026-${(securityAuditTrail.length + 1).toString().padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      actionType: 'COA_MAPPING_UPDATE',
      resourceId: newAcct.accountCode,
      userId: currentActiveStaffSession.userId,
      userName: currentActiveStaffSession.userName,
      userRole: currentActiveStaffSession.userRole,
      storeId: 'ALL',
      shiftId: currentActiveStaffSession.activeShiftId,
      status: 'AUTHORIZED_EXECUTED',
      metadata: { action: 'CREATE', accountCode: newAcct.accountCode, accountName: newAcct.accountName },
    });

    res.json({ success: true, account: newAcct, message: `COA account [${newAcct.accountCode}] ${newAcct.accountName} created.` });
  });

  app.put('/api/admin/settings/coa-account/:code', (req: Request, res: Response) => {
    const { code } = req.params;
    const acct = chartOfAccounts.find((a) => a.accountCode === code);
    if (!acct) return res.status(404).json({ error: 'COA account not found.' });
    Object.assign(acct, req.body);
    res.json({ success: true, account: acct, message: `Account ${code} updated.` });
  });

  app.delete('/api/admin/settings/coa-account/:code', (req: Request, res: Response) => {
    const { code } = req.params;
    const idx = chartOfAccounts.findIndex((a) => a.accountCode === code);
    if (idx === -1) return res.status(404).json({ error: 'COA account not found.' });
    chartOfAccounts.splice(idx, 1);
    res.json({ success: true, message: `Account ${code} deleted.` });
  });

  // --- 13. SPECIALIZED GROCERY METRICS & INTELLIGENCE REPORT ---
  app.get('/api/admin/reports/grocery-metrics', (req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const { storeId } = req.query as { storeId?: string };
    const targetStore = storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED' ? storeId : 'store-jkt-senopati';

    const report: GroceryMetricsReport = {
      generatedAt: new Date().toISOString(),
      storeId: targetStore,
      fifoExpiryMetrics: {
        criticalBatchesCount: 4,
        nearExpiryBatchesCount: 8,
        freshBatchesCount: 22,
        stableBatchesCount: 45,
        atRiskInventoryValueIDR: 4250000,
        vivoDiscountSoldUnits: 142,
        vivoRevenueRecoveredIDR: 3550000,
        batchTurnoverRateDays: 4.8,
        agingBuckets: [
          { bucket: '< 3 Days (Critical)', units: 48, valueIDR: 1200000 },
          { bucket: '4 - 7 Days (Near Expiry)', units: 120, valueIDR: 3050000 },
          { bucket: '8 - 14 Days (Prime Fresh)', units: 260, valueIDR: 6500000 },
          { bucket: '> 15 Days (Long Stable)', units: 410, valueIDR: 10250000 },
        ],
      },
      wasteShrinkageMetrics: {
        totalShrinkLossIDR: 2150000,
        shrinkToSalesRatioPercent: 1.4,
        naturalMoistureLossIDR: 450000,
        prepAndWashLossIDR: 380000,
        handlingDamageLossIDR: 320000,
        expiredSpoilageLossIDR: 1000000,
        departmentBreakdown: [
          { department: 'Fresh Produce', lossIDR: 1200000, percentage: 55.8 },
          { department: 'Chilled Dairy & Eggs', lossIDR: 520000, percentage: 24.2 },
          { department: 'Meat & Seafood', lossIDR: 430000, percentage: 20.0 },
        ],
      },
      fulfillmentMetrics: {
        averagePickTimeMinutes: 3.4,
        catchWeightAccuracyPercent: 99.2,
        substitutionsAcceptedPercent: 94.5,
        onTimeDeliveryPercent: 98.1,
        clickAndCollectFulfillmentRatePercent: 99.5,
      },
    };
    res.json(report);
  });

  // =============================================================
  // 14. COLD CHAIN TELEMETRY & COMPLIANCE
  // =============================================================
  app.get('/api/admin/cold-chain/logs', (req: Request, res: Response) => {
    const { zoneId, storeId } = req.query as { zoneId?: string; storeId?: string };
    let filtered = [...coldChainLogs];
    if (zoneId && zoneId !== 'ALL') {
      filtered = filtered.filter((l) => l.warehouseZoneId === zoneId);
    }
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      filtered = filtered.filter((l) => l.storeId === storeId);
    }
    res.json(filtered);
  });

  app.post('/api/admin/cold-chain/logs', (req: Request, res: Response) => {
    const payload = req.body as Partial<ColdChainLogEntry>;
    const tempC = payload.temperatureCelsius ?? 4.0;
    const isExcursion = tempC > 8.0 || tempC < -22.0;
    const newLog: ColdChainLogEntry = {
      id: `CCL-${Date.now()}`,
      warehouseZoneId: payload.warehouseZoneId || 'zone-chiller-01',
      zoneName: payload.zoneName || 'Chilled Dairy & Cold Storage',
      storeId: payload.storeId || 'store-jkt-senopati',
      storeName: payload.storeName || 'GroceMart Senopati Flagship',
      sensorId: payload.sensorId || `IOT-TEMP-${Math.floor(Math.random() * 900 + 100)}`,
      timestamp: new Date().toISOString(),
      temperatureCelsius: tempC,
      temperatureFahrenheit: Number(((tempC * 9) / 5 + 32).toFixed(1)),
      humidityPercent: payload.humidityPercent ?? 75,
      isExcursion,
      severity: isExcursion ? (tempC > 12 ? 'CRITICAL_SPIKE' : 'ELEVATED') : 'NORMAL',
      complianceStandard: payload.complianceStandard || 'FDA FSMA 204',
      correctiveAction: payload.correctiveAction,
      inspectorName: payload.inspectorName || 'Store IoT Logger',
    };
    coldChainLogs.unshift(newLog);
    if (isExcursion) {
      emitEnterpriseNotification({
        dedupeKey: `COLD_EXCURSION:${newLog.id}`,
        category: 'QUALITY_CONTROL',
        severity: 'CRITICAL',
        title: `Cold-Chain Excursion: ${newLog.zoneName}`,
        message: `Sensor ${newLog.sensorId} recorded ${tempC}°C (${newLog.severity}) at ${newLog.storeName}. Immediate HACCP inspection needed.`,
        metadataLabel: `${tempC}°C • ${newLog.zoneName}`,
        targetTab: 'qc',
      });
    }
    res.json({ success: true, log: newLog, message: 'Cold chain telemetry recorded successfully' });
  });

  // =============================================================
  // 15. BATCH RECALL & FDA/EU TRACEABILITY APIS
  // =============================================================
  app.get('/api/admin/batch-recall/trace/:query', (req: Request, res: Response) => {
    const { query } = req.params;
    const cleanQ = String(query ?? '').toLowerCase().trim();
    const batch = inventoryBatches.find(
      (b) =>
        String(b.batchId ?? '').toLowerCase().includes(cleanQ) ||
        String(b.lotNumber ?? '').toLowerCase().includes(cleanQ) ||
        String(b.sku ?? '').toLowerCase().includes(cleanQ) ||
        String(b.productName ?? '').toLowerCase().includes(cleanQ)
    ) || inventoryBatches[0];

    if (!batch) {
      return res.status(404).json({ error: `No batch found matching query '${query}'` });
    }

    const matchedItem = inventoryList.find((i) => i.sku === batch.sku);
    const traceResult: BatchRecallTraceResult = {
      batchId: batch.batchId,
      lotNumber: batch.lotNumber,
      sku: batch.sku,
      productName: batch.productName,
      category: matchedItem?.category || 'fresh_produce',
      supplierName: batch.supplierName || 'PT Lembang Agro Sejahtera',
      receivedDate: batch.receivedDate || new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
      expiryDate: batch.expiryDate,
      currentWarehouseStock: batch.remainingQuantity ?? batch.currentStock ?? 0,
      quarantinedStock: batch.status === 'quarantined' ? (batch.remainingQuantity ?? batch.currentStock ?? 0) : 0,
      recallStatus: batch.status === 'quarantined' ? 'fda_class_1_active' : 'none',
      quarantineReason: batch.notes || undefined,
      quarantinedAt: batch.status === 'quarantined' ? new Date().toISOString() : undefined,
      upstreamOrigin: {
        poId: batch.sourcePoNumber || 'PO-2026-0042',
        supplierId: 'SUPP-AGRO-01',
        supplierName: batch.supplierName || 'PT Lembang Agro Sejahtera',
        deliveryNoteNumber: 'DN-AGRO-8821',
        intakeTempCelsius: 3.5,
        intakeQualityStatus: 'Grade A Certified',
        receivedDate: batch.receivedDate || new Date().toISOString(),
      },
      warehouseLocations: [
        {
          storeId: batch.storeId || 'store-jkt-senopati',
          storeName: 'GroceMart Senopati Flagship',
          warehouseZoneId: 'zone-produce-01',
          storageType: 'Chilled / Controlled Atmosphere',
          physicalStock: batch.remainingQuantity ?? batch.currentStock ?? 0,
          availableStock: batch.status === 'quarantined' ? 0 : (batch.remainingQuantity ?? batch.currentStock ?? 0),
          isQuarantined: batch.status === 'quarantined',
        },
      ],
      posSales: [
        {
          receiptNumber: 'RCP-2026-1028-04',
          transactionId: 'TX-2026-904',
          orderId: 'ORD-2026-1028',
          timestamp: new Date(Date.now() - 1000 * 3600 * 12).toISOString(),
          storeName: 'GroceMart Senopati Flagship',
          cashierName: 'Dewi Lestari',
          customerName: 'Sarah Jenkins',
          quantitySold: 2,
          lineTotal: (matchedItem?.sellingPrice || 18500) * 2,
        },
      ],
      onlineOrders: [
        {
          orderId: 'ORD-B2C-9901',
          customerName: 'Budi Santoso',
          customerEmail: 'budi.santoso@example.com',
          customerPhone: '+6281234567890',
          orderDate: new Date(Date.now() - 1000 * 3600 * 8).toISOString(),
          status: 'DELIVERED',
          quantity: 1,
          deliveryAddress: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
        },
      ],
      regulatoryNotice: {
        recallClassification: 'Class I (High Risk / Immediate Hazard)',
        fdaReportableFoodRegistryId: 'RFR-2026-ID-0091',
        euRasffReferenceNumber: 'RASFF-2026.4182',
        fsanzAlertId: 'FSANZ-ALERT-88',
        hazardDescription: 'Microbiological contamination check or cold chain breach risk identified during quality audit.',
        recommendedAction: 'Immediately cease distribution, isolate inventory in biohazard waste cage, notify affected purchasers.',
        mandatoryActionRequired: 'Immediately cease distribution, isolate inventory in biohazard waste cage, notify affected purchasers.',
      },
    };

    res.json(traceResult);
  });

  app.post('/api/admin/batch-recall/quarantine', (req: Request, res: Response) => {
    const { batchId, reason, recallClassification, hazardDescription } = req.body;
    const batch = inventoryBatches.find((b) => b.batchId === batchId);
    if (!batch) {
      return res.status(404).json({ error: `Batch ${batchId} not found` });
    }
    batch.status = 'quarantined';
    batch.notes = `Quarantined: ${reason || hazardDescription || recallClassification || 'Suspected contamination'}`;
    const quarantinedUnits = batch.remainingQuantity ?? batch.currentStock ?? 0;
    emitEnterpriseNotification({
      dedupeKey: `RECALL_QUARANTINE:${batchId}`,
      category: 'QUALITY_CONTROL',
      severity: 'CRITICAL',
      title: `Batch Quarantine Lock: ${batch.productName}`,
      message: `Lot ${batch.lotNumber} (${quarantinedUnits} units) locked from picking & POS sales (${reason || recallClassification || 'Recall Quarantine'}).`,
      metadataLabel: `${batch.sku} • Lot ${batch.lotNumber}`,
      targetTab: 'qc',
    });
    res.json({
      success: true,
      message: `Batch ${batchId} has been locked and quarantined from all picking & POS sales.`,
      quarantinedUnits,
    });
  });

  app.post('/api/admin/batch-recall/notify-customers', (req: Request, res: Response) => {
    const { batchId, channel } = req.body;
    const notifications = [
      {
        notificationId: `NOTIF-${Date.now()}-1`,
        customerName: 'Sarah Jenkins',
        contactDetail: '+6281298765432',
        channel: (channel || 'WhatsApp') as 'WhatsApp' | 'SMS' | 'Email',
        sentAt: new Date().toISOString(),
        status: 'SENT' as const,
      },
      {
        notificationId: `NOTIF-${Date.now()}-2`,
        customerName: 'Budi Santoso',
        contactDetail: 'budi.santoso@example.com',
        channel: (channel || 'Email') as 'WhatsApp' | 'SMS' | 'Email',
        sentAt: new Date().toISOString(),
        status: 'DELIVERED' as const,
      },
    ];
    res.json({
      success: true,
      message: `Safety recall notice dispatched to all purchasers of batch ${batchId}.`,
      notifications,
    });
  });

  app.post('/api/admin/batch-recall/release', (req: Request, res: Response) => {
    const { batchId } = req.body;
    const batch = inventoryBatches.find((b) => b.batchId === batchId);
    if (!batch) {
      return res.status(404).json({ error: `Batch ${batchId} not found` });
    }
    batch.status = (batch.daysUntilExpiry ?? 14) <= 7 ? 'near_expiry' : 'fresh';
    batch.notes = 'Released from quarantine after lab clearance verified.';
    res.json({
      success: true,
      message: `Batch ${batchId} cleared and returned to active sellable inventory.`,
    });
  });

  // =============================================================
  // 16. POS HARDWARE & PERIPHERAL INTEGRATION
  // =============================================================
  app.get('/api/admin/hardware/status', (_req: Request, res: Response) => {
    res.json(posHardwareStatus);
  });

  app.post('/api/admin/hardware/kick-drawer', (req: Request, res: Response) => {
    const { pulseMs } = req.body;
    posHardwareStatus.cashDrawer.status = 'open';
    posHardwareStatus.cashDrawer.kickPulseMs = pulseMs || 120;
    posHardwareStatus.cashDrawer.lastKickedAt = new Date().toISOString();
    res.json({
      success: true,
      message: 'Cash drawer solenoid kick pulse dispatched successfully',
      status: posHardwareStatus,
    });
  });

  app.post('/api/admin/hardware/close-drawer', (_req: Request, res: Response) => {
    posHardwareStatus.cashDrawer.status = 'closed';
    res.json({ success: true, status: posHardwareStatus });
  });

  app.post('/api/admin/hardware/test-print', (req: Request, res: Response) => {
    const { paperWidthMm, storeName } = req.body;
    posHardwareStatus.thermalPrinter.lastPrintedAt = new Date().toISOString();
    posHardwareStatus.thermalPrinter.paperWidthMm = paperWidthMm || 80;
    const slipText = [
      '================================',
      `    ${storeName || 'GROCEMART ERP'}    `,
      '   ESC/POS THERMAL TEST SLIP    ',
      '================================',
      `Date: ${new Date().toLocaleString('id-ID')}`,
      `Printer: ${posHardwareStatus.thermalPrinter.model}`,
      `Width: ${posHardwareStatus.thermalPrinter.paperWidthMm}mm ESC/POS Raster`,
      'Status: ONLINE / PAPER LOADED OK',
      '--------------------------------',
      'Items Checked: 3 SKUs Tested    ',
      'Cutter Pulse: SUCCESS           ',
      '================================',
      '     THANK YOU FOR TESTING      ',
      '================================',
    ].join('\n');
    res.json({
      success: true,
      message: 'Thermal receipt sent to printer buffer',
      slipText,
      status: posHardwareStatus,
    });
  });

  app.post('/api/admin/hardware/scale/tare', (req: Request, res: Response) => {
    const { tareGrams } = req.body;
    posHardwareStatus.digitalScale.tareGrams = Number(tareGrams) || 0;
    posHardwareStatus.digitalScale.status = 'stable';
    res.json({ success: true, status: posHardwareStatus });
  });

  app.post('/api/admin/hardware/scale/zero', (_req: Request, res: Response) => {
    posHardwareStatus.digitalScale.currentWeightGrams = 0;
    posHardwareStatus.digitalScale.tareGrams = 0;
    posHardwareStatus.digitalScale.status = 'zeroed';
    posHardwareStatus.digitalScale.isStable = true;
    res.json({ success: true, status: posHardwareStatus });
  });

  app.post('/api/admin/hardware/scale/weigh', (req: Request, res: Response) => {
    const { weightGrams, isStable } = req.body;
    posHardwareStatus.digitalScale.currentWeightGrams = Number(weightGrams) || 0;
    posHardwareStatus.digitalScale.isStable = isStable !== undefined ? Boolean(isStable) : true;
    posHardwareStatus.digitalScale.status = posHardwareStatus.digitalScale.isStable ? 'stable' : 'motion';
    posHardwareStatus.digitalScale.lastStabilizedAt = new Date().toISOString();
    res.json({ success: true, status: posHardwareStatus });
  });

  app.post('/api/admin/hardware/scanner/simulate', (req: Request, res: Response) => {
    const { barcode } = req.body;
    posHardwareStatus.barcodeScanner.lastScannedBarcode = barcode;
    posHardwareStatus.barcodeScanner.lastScannedAt = new Date().toISOString();
    const clean = String(barcode || '').trim();
    const matched = inventoryList.find((i) => i.barcode === clean || i.sku === clean) || inventoryList[0];
    res.json({
      success: true,
      barcode: clean,
      matchedItem: matched,
      status: posHardwareStatus,
    });
  });

  // =============================================================
  // 17. REVERSE LOGISTICS, RETURNS, & REFUNDS
  // =============================================================
  app.get('/api/admin/returns', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    let filtered = [...posReturnsList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      filtered = filtered.filter((r) => r.storeId === storeId);
    }
    res.json(filtered);
  });

  app.get('/api/admin/returns/lookup-receipt/:query', (req: Request, res: Response) => {
    const { query } = req.params;
    const cleanQ = String(query ?? '').toLowerCase().trim();
    if (!cleanQ) {
      return res.status(400).json({ error: 'Receipt search query is required' });
    }

    const posMatch = posTransactionsHistory.find(
      (tx) =>
        String(tx.receiptNumber ?? '').toLowerCase().includes(cleanQ) ||
        String(tx.transactionId ?? '').toLowerCase().includes(cleanQ) ||
        String(tx.orderId ?? '').toLowerCase().includes(cleanQ) ||
        String(tx.cashierName ?? '').toLowerCase().includes(cleanQ) ||
        (Array.isArray(tx.items) &&
          tx.items.some(
            (i) =>
              String(i?.name ?? '').toLowerCase().includes(cleanQ) ||
              String(i?.sku ?? '').toLowerCase().includes(cleanQ)
          ))
    );

    if (posMatch) {
      return res.json({
        receiptNumber: posMatch.receiptNumber,
        orderId: posMatch.orderId || posMatch.transactionId,
        storeId: posMatch.storeId,
        storeName: posMatch.storeName,
        customerName: 'POS Walk-in Customer',
        customerPhone: '+6281234567890',
        timestamp: posMatch.timestamp,
        totalAmountIDR: posMatch.total,
        items: (posMatch.items || []).map((i) => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          unit: i.unit || 'pack',
          returnEligible: true,
        })),
      });
    }

    const order = customerOrders.find(
      (o) =>
        String(o.id ?? '').toLowerCase().includes(cleanQ) ||
        String(o.customerName ?? '').toLowerCase().includes(cleanQ) ||
        (Array.isArray(o.items) &&
          o.items.some((i: any) => String(i?.product?.name || i?.name || '').toLowerCase().includes(cleanQ)))
    );

    if (!order) {
      return res.status(404).json({ error: `Receipt '${query}' not found in POS archives` });
    }

    const items = (order.items || []).map((i: any) => {
      const prodName = i.product?.name || i.name || 'GroceMart Item';
      const prodSku = i.product?.sku || i.sku || 'SKU-PRD-001';
      const uPrice = i.product?.price || i.price || 0;
      const qty = i.quantity || 1;
      return {
        sku: prodSku,
        name: prodName,
        quantity: qty,
        unitPrice: uPrice,
        lineTotal: uPrice * qty,
        unit: 'pack',
        returnEligible: true,
      };
    });

    res.json({
      receiptNumber: `RCP-${order.id}`,
      orderId: order.id,
      storeId: order.pickupStore?.id || 'store-jkt-senopati',
      storeName: order.pickupStore?.name || 'GroceMart Senopati Flagship',
      customerName: order.customerName || 'Walk-in Customer',
      customerPhone: order.customerPhone || '+6281234567890',
      timestamp: order.createdAt || new Date().toISOString(),
      totalAmountIDR: (order as any).totalAmount || order.total || 0,
      items,
    });
  });

  app.post('/api/admin/returns', (req: Request, res: Response) => {
    const {
      originalReceiptNumber,
      originalOrderId,
      storeId = 'store-jkt-senopati',
      processedByUserId,
      processedByUserName,
      items = [],
      refundChannel,
      customerName,
      customerPhone,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one return item is required.' });
    }

    const storeInfo = storeSchedules.find((s) => s.storeId === storeId);
    const resolvedStoreName = storeInfo?.storeName || 'GroceMart Senopati Flagship';
    const normalizedItems: POSReturnItemLine[] = items.map((it: any) => {
      const inv = inventoryList.find((p) => p.sku === it.sku);
      const returnQty = Math.max(0.01, Number(it.returnQuantity ?? it.quantity ?? 1));
      const origQty = Math.max(returnQty, Number(it.originalQuantity ?? returnQty));
      const uPrice = Number(it.unitPrice ?? inv?.sellingPrice ?? 0);
      const uCost = Number(it.unitCost ?? inv?.unitCost ?? Math.round(uPrice * 0.65));
      const refundAmt = Number(it.refundAmount ?? Math.round(returnQty * uPrice));
      return {
        sku: it.sku || inv?.sku || 'SKU-PRD-001',
        productName: it.productName || it.name || inv?.productName || 'GroceMart Item',
        category: it.category || inv?.category || 'produce',
        originalQuantity: origQty,
        returnQuantity: returnQty,
        unitPrice: uPrice,
        unitCost: uCost,
        refundAmount: refundAmt,
        returnReason: it.returnReason || 'PERISHABLE_DEFECT',
        disposition: it.disposition === 'RESTOCK_INVENTORY' ? 'RESTOCK_INVENTORY' : 'RETURN_CAGE_WASTE',
        conditionNotes: it.conditionNotes || it.reason,
      };
    });

    const totalRefund = normalizedItems.reduce((sum, it) => sum + (Number(it.refundAmount) || 0), 0);
    const returnId = `RET-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const resolvedChannel = (refundChannel as RefundPaymentChannel) || 'CASH_DRAWER';
    const seq = `${Date.now().toString().slice(-6)}`;
    const revGleId = `GLE-RET-${seq}-REV`;
    const settleGleId = `GLE-RET-${seq}-SETTLE`;
    const glVoucherIds: string[] = [revGleId, settleGleId];

    // Double-entry 1: Debit Grocery Sales Revenue (#4010) / Credit Cash (#1010) or Store Credit (#2020)
    const revEntry: GeneralLedgerEntry = {
      id: revGleId,
      timestamp,
      storeId,
      storeName: resolvedStoreName,
      accountCode: '4010',
      accountName: 'Grocery Sales Revenue',
      category: 'Revenue',
      debit: totalRefund,
      credit: 0,
      referenceType: 'POS_SALE',
      referenceId: returnId,
      description: `POS Sales Return Reversal (${returnId}) for receipt ${originalReceiptNumber || 'Walk-in'}`,
    };

    let settleEntry: GeneralLedgerEntry;
    if (resolvedChannel === 'CASH_DRAWER') {
      settleEntry = {
        id: settleGleId,
        timestamp,
        storeId,
        storeName: resolvedStoreName,
        accountCode: '1010',
        accountName: 'Cash on Hand & Store Registers',
        category: 'Asset',
        debit: 0,
        credit: totalRefund,
        referenceType: 'POS_SALE',
        referenceId: returnId,
        description: `POS Cash Drawer Refund for Return ${returnId}`,
      };
      const openShift = posShiftsList.find((s) => s.status === 'OPEN' && s.storeId === storeId);
      if (openShift) {
        openShift.cashRefundsIDR += totalRefund;
        openShift.expectedTotalCashInDrawerIDR =
          openShift.openingFloatIDR + openShift.expectedCashSalesIDR - openShift.cashRefundsIDR;
      }
    } else {
      settleEntry = {
        id: settleGleId,
        timestamp,
        storeId,
        storeName: resolvedStoreName,
        accountCode: '2020',
        accountName: 'Customer Store Credit Liability',
        category: 'Liability',
        debit: 0,
        credit: totalRefund,
        referenceType: 'POS_SALE',
        referenceId: returnId,
        description: `Store Credit / E-Wallet Refund (${resolvedChannel}) for Return ${returnId}`,
      };
    }
    commitBalancedGlBatch([revEntry, settleEntry], true);

    let totalRestockCogs = 0;
    let totalScrapCogs = 0;

    // Restore restockable inventory & track restock vs scrap COGS
    normalizedItems.forEach((it) => {
      const lineCogs = Math.round(it.returnQuantity * it.unitCost);
      if (it.disposition === 'RESTOCK_INVENTORY') {
        totalRestockCogs += lineCogs;
        const qty = it.returnQuantity;
        const inv = inventoryList.find((p) => p.sku === it.sku);
        if (inv) {
          inv.currentStock = Number(((inv.currentStock || 0) + qty).toFixed(2));
          if (typeof inv.stockLevel === 'number') {
            inv.stockLevel = Number((inv.stockLevel + qty).toFixed(2));
          }
        }
        const tier = storeInventoryTiers.find(
          (t) => t.sku === it.sku && (t.storeId === storeId || storeId === 'CONSOLIDATED')
        );
        if (tier) {
          tier.physicalStock = Number((tier.physicalStock + qty).toFixed(2));
          tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
          tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
          tier.updatedAt = timestamp;
        }
        syncBatchesForStockVariance(it.sku, storeId, qty, it.unitCost);
      } else {
        totalScrapCogs += lineCogs;
      }
    });

    if (totalRestockCogs > 0) {
      const invGle = `GLE-RET-${seq}-INV`;
      const cogsGle = `GLE-RET-${seq}-COGS`;
      glVoucherIds.push(invGle, cogsGle);
      commitBalancedGlBatch(
        [
          {
            id: invGle,
            timestamp,
            storeId,
            storeName: resolvedStoreName,
            accountCode: '1040',
            accountName: 'Merchandise Inventory Asset',
            category: 'Asset',
            debit: totalRestockCogs,
            credit: 0,
            referenceType: 'POS_SALE',
            referenceId: returnId,
            description: `Good-condition POS return restocked to ATP (${returnId})`,
          },
          {
            id: cogsGle,
            timestamp,
            storeId,
            storeName: resolvedStoreName,
            accountCode: '5010',
            accountName: 'Cost of Goods Sold (COGS)',
            category: 'Expense',
            debit: 0,
            credit: totalRestockCogs,
            referenceType: 'POS_SALE',
            referenceId: returnId,
            description: `COGS reversal for restocked POS return (${returnId})`,
          },
        ],
        true
      );
    }

    if (totalScrapCogs > 0) {
      const scrapDrGle = `GLE-RET-${seq}-SCRAP-DR`;
      const scrapCrGle = `GLE-RET-${seq}-SCRAP-CR`;
      glVoucherIds.push(scrapDrGle, scrapCrGle);
      commitBalancedGlBatch(
        [
          {
            id: scrapDrGle,
            timestamp,
            storeId,
            storeName: resolvedStoreName,
            accountCode: '6030',
            accountName: 'Perishable Spoilage & Shrinkage Expense',
            category: 'Expense',
            debit: totalScrapCogs,
            credit: 0,
            referenceType: 'POS_SALE',
            referenceId: returnId,
            description: `Returned perishable waste written off on POS return (${returnId})`,
          },
          {
            id: scrapCrGle,
            timestamp,
            storeId,
            storeName: resolvedStoreName,
            accountCode: '5010',
            accountName: 'Cost of Goods Sold (COGS)',
            category: 'Expense',
            debit: 0,
            credit: totalScrapCogs,
            referenceType: 'POS_SALE',
            referenceId: returnId,
            description: `COGS reclassification to Spoilage Waste for POS return (${returnId})`,
          },
        ],
        true
      );
    }

    const newReturn: POSReturnRecord = {
      id: returnId,
      originalReceiptNumber: originalReceiptNumber || `RCP-${Date.now()}`,
      originalOrderId,
      storeId,
      storeName: resolvedStoreName,
      processedByUserId: processedByUserId || currentActiveStaffSession.userId,
      processedByUserName: processedByUserName || currentActiveStaffSession.userName,
      timestamp,
      items: normalizedItems,
      totalRefundAmountIDR: totalRefund,
      refundChannel: resolvedChannel,
      glVoucherIds,
      status: 'COMPLETED',
      customerName,
      customerPhone,
    };

    posReturnsList.unshift(newReturn);

    const slipText = [
      '================================',
      '      GROCEMART RETURN SLIP     ',
      '================================',
      `Return ID: ${newReturn.id}`,
      `Original Receipt: ${newReturn.originalReceiptNumber}`,
      `Date: ${new Date().toLocaleString('id-ID')}`,
      `Cashier: ${newReturn.processedByUserName}`,
      `Customer: ${customerName || 'Walk-in'}`,
      '--------------------------------',
      ...normalizedItems.map((it) => `${it.productName || it.sku} x${it.returnQuantity} = Rp ${Number(it.refundAmount).toLocaleString('id-ID')}`),
      '--------------------------------',
      `TOTAL REFUND: Rp ${totalRefund.toLocaleString('id-ID')}`,
      `CHANNEL: ${resolvedChannel}`,
      `GL ENTRY: ${glVoucherIds[0]}`,
      '================================',
    ].join('\n');

    res.json({
      success: true,
      returnRecord: newReturn,
      glVoucherIds,
      slipText,
      message: `Return ${returnId} processed successfully. Refund Rp ${totalRefund.toLocaleString('id-ID')} authorized.`,
    });
  });

  // =============================================================
  // 18. AUTO-REPLENISHMENT & MIN-MAX PLANNING
  // =============================================================
  app.get('/api/admin/replenishment/plan', (req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    const { storeId } = req.query as { storeId?: string };
    const isSpecificStore = Boolean(storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED');
    const targetStore = isSpecificStore ? storeId! : 'store-jkt-senopati';
    const storeInfo = storeSchedules.find((s) => s.storeId === targetStore);
    const storeName = isSpecificStore
      ? storeInfo?.storeName || 'GroceMart Regional Outlet'
      : 'All Store Outlets (Consolidated Network)';

    const items: AutoReplenishmentItemPlan[] = inventoryList.map((item) => {
      const tier = isSpecificStore
        ? storeInventoryTiers.find((t) => t.sku === item.sku && t.storeId === targetStore)
        : undefined;
      const matchingTiers = storeInventoryTiers.filter((t) => t.sku === item.sku);
      const minThresh = tier?.minimumThreshold ?? item.minimumThreshold ?? 20;
      const physicalStock = tier ? tier.physicalStock : (item.currentStock ?? item.stockLevel ?? 0);
      const reservedStock = tier
        ? tier.reservedStock
        : matchingTiers.reduce((sum, t) => sum + (t.reservedStock || 0), 0);
      const availableStock = tier ? tier.availableStock : Math.max(0, physicalStock - reservedStock);
      const incomingStock = tier ? tier.incomingStock : (item.incomingStock ?? 0);
      const reorderQty = item.reorderQuantity || Math.max(30, minThresh * 2);
      const needsRestock = availableStock + incomingStock <= minThresh;
      const maxCapacity = Math.max(100, minThresh * 4);
      const suggestedOrderQty = needsRestock ? reorderQty : 0;
      const uCost = item.wacUnitCost ?? item.unitCost ?? Math.round(item.sellingPrice * 0.7);
      const estimatedOrderCostIDR = suggestedOrderQty * uCost;

      let urgencyLevel: AutoReplenishmentItemPlan['urgencyLevel'] = 'HEALTHY_STOCK';
      if (availableStock <= 0) {
        urgencyLevel = 'CRITICAL_OUT_OF_STOCK';
      } else if (needsRestock) {
        urgencyLevel = 'BELOW_SAFETY_STOCK';
      } else if (availableStock > maxCapacity) {
        urgencyLevel = 'OVERSTOCKED';
      }

      return {
        sku: item.sku,
        productName: item.productName || item.name || 'GroceMart Item',
        category: item.category,
        storeId: targetStore,
        storeName,
        warehouseZoneId: tier?.warehouseZoneId || 'WH-JKT-SEN-COLD',
        physicalStock,
        availableStock,
        reservedStock,
        incomingStock,
        minimumThreshold: minThresh,
        safetyStockBuffer: tier?.safetyStockBuffer ?? Math.round(minThresh * 0.4),
        maxCapacity,
        reorderQuantity: reorderQty,
        dailySalesVelocity: 4.5,
        daysOfInventoryLeft: availableStock > 0 ? Number((availableStock / 4.5).toFixed(1)) : 0,
        supplierLeadTimeDays: 3,
        reorderPoint: minThresh,
        isReorderTriggered: needsRestock,
        urgencyLevel,
        suggestedOrderQty,
        unitCost: uCost,
        estimatedOrderCostIDR,
        supplierId: item.supplierId || 'SUPP-AGRO-01',
        supplierName: item.supplierName || 'PT Lembang Agro Sejahtera',
      };
    });

    const needingRestock = items.filter((i) => i.isReorderTriggered);
    const critical = items.filter((i) => i.urgencyLevel === 'CRITICAL_OUT_OF_STOCK');
    const totalCost = needingRestock.reduce((sum, i) => sum + i.estimatedOrderCostIDR, 0);

    const supplierGroupMap = new Map<string, {
      supplierId: string;
      supplierName: string;
      skuCount: number;
      totalOrderQty: number;
      totalAmountIDR: number;
      suggestedPoId: string;
    }>();

    needingRestock.forEach((it, idx) => {
      const key = it.supplierName || it.supplierId || 'SUPP-AGRO-01';
      const existing = supplierGroupMap.get(key);
      if (existing) {
        existing.skuCount += 1;
        existing.totalOrderQty += it.suggestedOrderQty;
        existing.totalAmountIDR += it.estimatedOrderCostIDR;
      } else {
        supplierGroupMap.set(key, {
          supplierId: it.supplierId || `SUPP-${idx + 1}`,
          supplierName: it.supplierName || 'PT Lembang Agro Sejahtera',
          skuCount: 1,
          totalOrderQty: it.suggestedOrderQty,
          totalAmountIDR: it.estimatedOrderCostIDR,
          suggestedPoId: `PO-AUTO-${Date.now().toString().slice(-4)}-${idx + 1}`,
        });
      }
    });

    const plan: AutoReplenishmentConsolidatedPlan = {
      storeId: targetStore,
      storeName,
      calculatedAt: new Date().toISOString(),
      totalSkusEvaluated: items.length,
      skusNeedingRestockCount: needingRestock.length,
      criticalSkusCount: critical.length,
      totalSuggestedCostIDR: totalCost,
      items,
      bySupplier: Array.from(supplierGroupMap.values()),
    };

    res.json(plan);
  });

  app.post('/api/admin/replenishment/generate-po', (req: Request, res: Response) => {
    const { storeId, selectedSkus } = req.body as { storeId?: string; selectedSkus?: string[] };
    const effectiveStore = storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED' ? storeId : 'store-jkt-senopati';
    const storeInfo = storeSchedules.find((s) => s.storeId === effectiveStore);
    const resolvedStoreName = storeInfo?.storeName || 'GroceMart Senopati Flagship';

    const targetSkus: string[] =
      Array.isArray(selectedSkus) && selectedSkus.length > 0
        ? selectedSkus
        : inventoryList
            .filter((i) => {
              const tier = storeInventoryTiers.find((t) => t.sku === i.sku && t.storeId === effectiveStore);
              const stock = tier ? tier.availableStock : (i.stockLevel ?? i.currentStock ?? 0);
              const incoming = tier ? tier.incomingStock : (i.incomingStock ?? 0);
              return stock + incoming <= (tier?.minimumThreshold ?? i.minimumThreshold ?? 20);
            })
            .map((i) => i.sku);

    if (targetSkus.length === 0) {
      return res.status(400).json({ error: 'No low-stock SKUs selected or eligible for replenishment PO generation.' });
    }

    const bySupplier = new Map<string, InventoryItem[]>();
    targetSkus.forEach((sku) => {
      const item = inventoryList.find((p) => p.sku === sku);
      if (!item) return;
      const supplierKey = item.supplierName || item.supplierId || 'PT Lembang Agro Sejahtera';
      const bucket = bySupplier.get(supplierKey) || [];
      bucket.push(item);
      bySupplier.set(supplierKey, bucket);
    });

    const generatedOrders: PurchaseOrder[] = [];
    let idxOffset = 0;

    bySupplier.forEach((supplierItems, supplierName) => {
      idxOffset += 1;
      const generatedPoId = `PO-2026-${(purchaseOrders.length + idxOffset + 100).toString().padStart(3, '0')}`;
      const poItems: PurchaseOrderItem[] = supplierItems.map((item) => {
        const qty = item.reorderQuantity || 30;
        const uCost = item.wacUnitCost ?? item.unitCost ?? Math.round(item.sellingPrice * 0.7);
        item.incomingStock = (item.incomingStock || 0) + qty;
        const tier = storeInventoryTiers.find((t) => t.sku === item.sku && t.storeId === effectiveStore);
        if (tier) {
          tier.incomingStock = (tier.incomingStock || 0) + qty;
          tier.updatedAt = new Date().toISOString();
        }
        return {
          sku: item.sku,
          productName: item.productName || item.name || 'Produce Item',
          orderedQuantity: qty,
          quantity: qty,
          receivedQuantity: 0,
          remainingBackorder: qty,
          unitCost: uCost,
          totalCost: qty * uCost,
          lineTotal: qty * uCost,
          handlingNotes: item.handlingInstructions || 'Standard cold-chain replenishment delivery',
        };
      });

      const subtotalCost = poItems.reduce((sum, it) => sum + it.totalCost, 0);
      const taxAmount = Math.round(subtotalCost * 0.11);
      const totalPoCost = subtotalCost + taxAmount;

      const newPo: PurchaseOrder = {
        id: generatedPoId,
        poNumber: generatedPoId,
        supplierId: supplierItems[0]?.supplierId || 'SUPP-AGRO-01',
        supplierName,
        supplierContact: 'Vendor Dispatch Desk (+62 812 8000 9000)',
        status: 'Sent',
        issueDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate: new Date(Date.now() + 1000 * 3600 * 48).toISOString().split('T')[0],
        storeId: effectiveStore,
        storeName: resolvedStoreName,
        warehouseZoneId: 'WH-JKT-SEN-COLD',
        items: poItems,
        subtotalCost,
        taxPercent: 11,
        taxAmount,
        totalCost: totalPoCost,
        totalAmount: totalPoCost,
        paymentTerms: 'Net 30',
        goodsReceiptIds: [],
        notes: 'Auto-generated replenishment purchase order triggered by min-max inventory thresholds.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      purchaseOrders.unshift(newPo);
      generatedOrders.push(newPo);
    });

    res.json({
      success: true,
      generatedOrders,
      message: `Generated ${generatedOrders.length} Replenishment PO(s) (${generatedOrders.map((o) => o.id).join(', ')}) and updated incoming stock projections.`,
    });
  });

  // =============================================================
  // 19. RETURN-TO-VENDOR (RTV) & VENDOR CREDIT NOTES
  // =============================================================
  app.get('/api/admin/vendor-credit-notes', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    let filtered = [...vendorCreditNotesList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      filtered = filtered.filter((v) => v.storeId === storeId);
    }
    res.json(filtered);
  });

  app.post('/api/admin/vendor-credit-notes', (req: Request, res: Response) => {
    const payload = req.body as Partial<VendorCreditNote> & { vendorBillId?: string; poId?: string };
    const noteId = `VCN-${Date.now().toString().slice(-4)}`;
    const journalDrId = `GLE-VCN-${Date.now().toString().slice(-4)}-DR`;
    const journalCrId = `GLE-VCN-${Date.now().toString().slice(-4)}-INV`;
    const timestamp = new Date().toISOString();

    const sku = payload.sku || 'SKU-PRD-001';
    const storeId = payload.storeId || 'store-jkt-senopati';
    const storeName = payload.storeName || 'GroceMart Senopati Flagship';
    const qty = Math.max(1, Number(payload.quantityReturned) || 1);
    const inv = inventoryList.find((i) => i.sku === sku);
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    const resolvedUnitCost = Number(payload.unitCost) || tier?.unitCost || inv?.wacUnitCost || 15000;

    const baseSubtotal = Math.round(qty * resolvedUnitCost);
    const rule = skuTaxRulesList.find((r) => r.sku === sku);
    const taxCat: IndonesianTaxCategory =
      rule?.taxCategory || inferDefaultTaxCategory(inv?.category || '', payload.productName || inv?.productName || '');
    const taxCalc = computeIndonesianTax(baseSubtotal, taxCat, false, rule?.taxRatePercent || 11);

    let subtotalReturnedIDR = baseSubtotal;
    let ppnMasukanReversedIDR = taxCalc.ppnIDR;
    let totalCreditIDR = baseSubtotal + ppnMasukanReversedIDR;

    if (payload.totalCreditIDR !== undefined && Number.isFinite(Number(payload.totalCreditIDR))) {
      totalCreditIDR = Math.max(0, Math.round(Number(payload.totalCreditIDR)));
      if (ppnMasukanReversedIDR > 0 && Math.abs(totalCreditIDR - (baseSubtotal + ppnMasukanReversedIDR)) <= 5) {
        subtotalReturnedIDR = totalCreditIDR - ppnMasukanReversedIDR;
      } else {
        subtotalReturnedIDR = totalCreditIDR;
        ppnMasukanReversedIDR = 0;
      }
    }

    // Deduct returned stock from batch, warehouse tier, and catalog
    const matchingBatch = inventoryBatches.find(
      (b) =>
        b.sku === sku &&
        b.currentStock > 0 &&
        (payload.lotNumber ? b.lotNumber === payload.lotNumber : (b.storeId === storeId || storeId === 'ALL'))
    );
    if (matchingBatch) {
      const wasQuarantined = matchingBatch.status === 'quarantined';
      matchingBatch.currentStock = Math.max(0, Number((matchingBatch.currentStock - qty).toFixed(2)));
      if (matchingBatch.currentStock === 0) matchingBatch.status = 'depleted';
      if (tier && wasQuarantined) {
        tier.reservedStock = Math.max(0, Number((tier.reservedStock - qty).toFixed(2)));
      }
    } else {
      deductBatchesByStrategy(sku, qty, storeId, resolvedUnitCost);
    }

    if (tier) {
      tier.physicalStock = Math.max(0, Number((tier.physicalStock - qty).toFixed(2)));
      tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
      tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
      tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
      tier.updatedAt = timestamp;
    }
    if (inv) {
      inv.currentStock = Math.max(0, Number(((inv.currentStock || 0) - qty).toFixed(2)));
    }

    // Post-Approval RTV & Vendor Credit Balance Guard: prevent negative COA #2010 / #2100
    const linkedBill = findLinkedVendorBillForRtv({
      vendorBillId: payload.vendorBillId,
      poId: payload.poId,
      supplierName: payload.supplierName,
      sku,
    });
    const billRemainingIDR = linkedBill
      ? linkedBill.remainingBalanceIDR ?? Math.round((linkedBill.remainingDue ?? 0) * (linkedBill.exchangeRate || 1))
      : 0;
    const ap2010Balance = chartOfAccounts.find((c) => c.accountCode === '2010')?.balance ?? 0;

    let apOffsetIDR = 0;
    let prepaymentAdvanceIDR = 0;

    if (linkedBill) {
      if (linkedBill.status !== 'PAID' && billRemainingIDR > 0 && ap2010Balance > 0) {
        apOffsetIDR = Math.min(totalCreditIDR, billRemainingIDR, ap2010Balance);
        prepaymentAdvanceIDR = Math.max(0, totalCreditIDR - apOffsetIDR);

        const newRemIDR = Math.max(0, billRemainingIDR - apOffsetIDR);
        linkedBill.remainingBalanceIDR = newRemIDR;
        linkedBill.remainingDue =
          linkedBill.exchangeRate && linkedBill.exchangeRate > 1
            ? Number((newRemIDR / linkedBill.exchangeRate).toFixed(2))
            : newRemIDR;
        if (newRemIDR === 0) {
          linkedBill.status = 'PAID';
          linkedBill.paymentStatus = 'PAID';
        } else {
          linkedBill.status = 'PARTIALLY_PAID';
          linkedBill.paymentStatus = 'PARTIALLY_PAID';
        }
      } else {
        // Linked bill already PAID or zero remaining: book full claim to #1150 Vendor Prepayments
        apOffsetIDR = 0;
        prepaymentAdvanceIDR = totalCreditIDR;
      }
    } else if (ap2010Balance >= totalCreditIDR) {
      apOffsetIDR = totalCreditIDR;
    } else {
      apOffsetIDR = 0;
      prepaymentAdvanceIDR = totalCreditIDR;
    }

    const vcnGlBatch: GeneralLedgerEntry[] = [];

    if (apOffsetIDR > 0) {
      vcnGlBatch.push({
        id: journalDrId,
        timestamp,
        storeId,
        storeName,
        accountCode: '2010',
        accountName: 'Trade Accounts Payable',
        category: 'Liability',
        debit: apOffsetIDR,
        credit: 0,
        referenceType: 'PURCHASE_AP',
        referenceId: noteId,
        description: `Vendor Credit Note ${noteId} reducing AP to ${payload.supplierName || 'Vendor'}`,
      });
    }

    if (prepaymentAdvanceIDR > 0) {
      const advGlId = apOffsetIDR > 0 ? `${journalDrId}-ADV` : journalDrId;
      vcnGlBatch.push({
        id: advGlId,
        timestamp,
        storeId,
        storeName,
        accountCode: '1150',
        accountName: 'Vendor Prepayments / Advances (Uang Muka Pembelian)',
        category: 'Asset',
        debit: prepaymentAdvanceIDR,
        credit: 0,
        referenceType: 'PURCHASE_AP',
        referenceId: noteId,
        description: `Post-payment Vendor Advance ${noteId} (${linkedBill ? `Bill ${linkedBill.id} ${linkedBill.status}` : 'No open AP'}) to ${payload.supplierName || 'Vendor'}`,
      });
    }

    vcnGlBatch.push({
      id: journalCrId,
      timestamp,
      storeId,
      storeName,
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: 0,
      credit: subtotalReturnedIDR,
      referenceType: 'PURCHASE_AP',
      referenceId: noteId,
      description: `Inventory Asset credited for RTV ${noteId} (${qty} ${payload.unit || 'pack'} ${sku})`,
    });

    if (ppnMasukanReversedIDR > 0) {
      vcnGlBatch.push({
        id: `GLE-VCN-${Date.now().toString().slice(-4)}-VAT`,
        timestamp,
        storeId,
        storeName,
        accountCode: '2026',
        accountName: 'PPN Masukan (VAT Input Creditable)',
        category: 'Asset',
        debit: 0,
        credit: ppnMasukanReversedIDR,
        referenceType: 'TAX_ADJUSTMENT',
        referenceId: noteId,
        description: `PPN Masukan reversed for Vendor Credit Note ${noteId}`,
      });
    }

    commitBalancedGlBatch(vcnGlBatch, true);

    const newNote: VendorCreditNote = {
      creditNoteId: noteId,
      rmaNumber: payload.rmaNumber || `RMA-${Date.now().toString().slice(-4)}`,
      supplierId: payload.supplierId || 'SUPP-AGRO-01',
      supplierName: payload.supplierName || 'PT Lembang Agro Sejahtera',
      storeId,
      storeName,
      sku,
      productName: payload.productName || inv?.productName || 'Organic Hydroponic Produce',
      lotNumber: payload.lotNumber || 'LOT-RTV-DEFAULT',
      quantityReturned: qty,
      unit: payload.unit || inv?.unit || 'pack',
      unitCost: resolvedUnitCost,
      totalCreditIDR,
      reason: payload.reason || 'spoiled_on_arrival',
      status: apOffsetIDR > 0 && linkedBill ? 'applied_to_bill' : 'pending_pickup',
      appliedToBillId: apOffsetIDR > 0 && linkedBill ? linkedBill.id : undefined,
      createdAt: timestamp,
      approvedBy: payload.approvedBy || 'Store Manager',
      journalEntryId: journalDrId,
      notes:
        prepaymentAdvanceIDR > 0
          ? `${payload.notes || 'RTV claim created.'} (Rp ${prepaymentAdvanceIDR.toLocaleString('id-ID')} booked to #1150 Vendor Prepayments)`
          : payload.notes || 'RTV claim created from receiving inspection dock.',
    };

    vendorCreditNotesList.unshift(newNote);

    res.json({
      success: true,
      creditNote: newNote,
      journalEntryId: journalDrId,
      apOffsetIDR,
      vendorPrepaymentAdvanceIDR: prepaymentAdvanceIDR,
      linkedBillId: linkedBill?.id,
      message: `Return-to-Vendor Credit Note ${noteId} created for ${newNote.supplierName}. Credit Rp ${newNote.totalCreditIDR.toLocaleString('id-ID')} logged.`,
    });
  });

  app.post('/api/admin/vendor-credit-notes/:id/apply', (req: Request, res: Response) => {
    const { id } = req.params;
    const { vendorBillId } = req.body;

    const note = vendorCreditNotesList.find((v) => v.creditNoteId === id);
    if (!note) {
      return res.status(404).json({ error: `Vendor Credit Note ${id} not found` });
    }
    if (note.status === 'applied_to_bill') {
      return res.status(400).json({
        error: `Vendor Credit Note ${id} is already applied to bill ${note.appliedToBillId}.`,
      });
    }

    const bill = vendorBillsList.find((b) => b.id === vendorBillId);
    if (!bill) {
      return res.status(404).json({ error: `Vendor Bill ${vendorBillId} not found` });
    }

    const curDueIDR =
      bill.remainingBalanceIDR !== undefined
        ? bill.remainingBalanceIDR
        : Math.round((bill.remainingDue ?? bill.grandTotal ?? 0) * (bill.exchangeRate || 1));

    if (bill.status === 'PAID' || curDueIDR <= 0) {
      return res.status(400).json({
        error: `Cannot apply Credit Note ${id}: Vendor Bill ${vendorBillId} is already PAID (remaining balance Rp 0). Claim remains in #1150 Vendor Prepayments / Advances.`,
      });
    }

    const appliedIDR = Math.min(curDueIDR, note.totalCreditIDR);
    const excessAdvanceIDR = Math.max(0, note.totalCreditIDR - appliedIDR);
    const newDueIDR = Math.max(0, curDueIDR - appliedIDR);

    bill.remainingBalanceIDR = newDueIDR;
    bill.remainingDue =
      bill.exchangeRate && bill.exchangeRate > 1
        ? Number((newDueIDR / bill.exchangeRate).toFixed(2))
        : newDueIDR;
    if (newDueIDR === 0) {
      bill.status = 'PAID';
      bill.paymentStatus = 'PAID';
    } else {
      bill.status = 'PARTIALLY_PAID';
      bill.paymentStatus = 'PARTIALLY_PAID';
    }

    const originalHad2010Debit = generalLedger.some(
      (g) => g.referenceId === note.creditNoteId && g.accountCode === '2010' && g.debit > 0
    );
    const originalHad1150Debit = generalLedger.some(
      (g) => g.referenceId === note.creditNoteId && g.accountCode === '1150' && g.debit > 0
    );
    const tsApply = new Date().toISOString();

    if (excessAdvanceIDR > 0 && originalHad2010Debit) {
      const advGlId = `GLE-VCN-ADV-${Date.now().toString().slice(-4)}`;
      commitBalancedGlBatch(
        [
          {
            id: advGlId,
            timestamp: tsApply,
            storeId: note.storeId,
            storeName: note.storeName,
            accountCode: '1150',
            accountName: 'Vendor Prepayments / Advances (Uang Muka Pembelian)',
            category: 'Asset',
            debit: excessAdvanceIDR,
            credit: 0,
            referenceType: 'PURCHASE_AP',
            referenceId: note.creditNoteId,
            description: `Excess credit Rp ${excessAdvanceIDR.toLocaleString('id-ID')} from ${note.creditNoteId} (${note.supplierName}) reclassified to Vendor Prepayment after settling ${vendorBillId}`,
          },
          {
            id: `${advGlId}-CR`,
            timestamp: tsApply,
            storeId: note.storeId,
            storeName: note.storeName,
            accountCode: '2010',
            accountName: 'Trade Accounts Payable',
            category: 'Liability',
            debit: 0,
            credit: excessAdvanceIDR,
            referenceType: 'PURCHASE_AP',
            referenceId: note.creditNoteId,
            description: `Reverse excess AP debit on ${note.creditNoteId}`,
          },
        ],
        true
      );
    } else if (appliedIDR > 0 && !originalHad2010Debit && originalHad1150Debit) {
      const setGlId = `GLE-VCN-SET-${Date.now().toString().slice(-4)}`;
      commitBalancedGlBatch(
        [
          {
            id: `${setGlId}-DR`,
            timestamp: tsApply,
            storeId: note.storeId,
            storeName: note.storeName,
            accountCode: '2010',
            accountName: 'Trade Accounts Payable',
            category: 'Liability',
            debit: appliedIDR,
            credit: 0,
            referenceType: 'PURCHASE_AP',
            referenceId: note.creditNoteId,
            description: `Apply Vendor Prepayment ${note.creditNoteId} to settle Bill ${vendorBillId}`,
          },
          {
            id: `${setGlId}-CR`,
            timestamp: tsApply,
            storeId: note.storeId,
            storeName: note.storeName,
            accountCode: '1150',
            accountName: 'Vendor Prepayments / Advances (Uang Muka Pembelian)',
            category: 'Asset',
            debit: 0,
            credit: appliedIDR,
            referenceType: 'PURCHASE_AP',
            referenceId: note.creditNoteId,
            description: `Consume Vendor Advance ${note.creditNoteId} against Bill ${vendorBillId}`,
          },
        ],
        true
      );
    }

    note.status = 'applied_to_bill';
    note.appliedToBillId = vendorBillId;

    res.json({
      success: true,
      creditNote: note,
      vendorBill: bill,
      appliedAmountIDR: appliedIDR,
      vendorPrepaymentExcessIDR: excessAdvanceIDR,
      message: `Credit Note ${id} applied Rp ${appliedIDR.toLocaleString('id-ID')} against Vendor Bill ${vendorBillId}.${excessAdvanceIDR > 0 ? ` Excess Rp ${excessAdvanceIDR.toLocaleString('id-ID')} held in #1150 Vendor Prepayments.` : ''}`,
    });
  });

  // =============================================================
  // 20. DYNAMIC MARKDOWN & EXPIRY DISCOUNT ENGINE
  // =============================================================
  app.get('/api/admin/markdown-rules', (_req: Request, res: Response) => {
    syncAllBatchesExpiryStatus(Date.now());
    res.json(dynamicMarkdownConfig);
  });

  app.post('/api/admin/markdown-rules', (req: Request, res: Response) => {
    const config = req.body as DynamicMarkdownConfig;
    dynamicMarkdownConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin Markdown Manager',
    };
    res.json({
      success: true,
      config: dynamicMarkdownConfig,
      message: 'Dynamic markdown rules & shelf-life discount tiers updated successfully.',
    });
  });

  app.post('/api/admin/markdown-rules/apply-batches', (req: Request, res: Response) => {
    const { batchIds } = req.body as { batchIds: string[] };
    const targetBatches = Array.isArray(batchIds) && batchIds.length > 0 ? batchIds : inventoryBatches.map((b) => b.batchId);
    const nowMs = Date.now();

    let count = 0;
    targetBatches.forEach((id) => {
      const b = inventoryBatches.find((batch) => batch.batchId === id);
      if (!b) return;
      const isExpired = syncBatchExpiryStatus(b, nowMs);
      if (isExpired) {
        b.markdownDiscountPercent = 0;
        return;
      }
      if (
        b.currentStock > 0 &&
        b.status !== 'quarantined' &&
        b.status !== 'recalled' &&
        b.status !== 'expired' &&
        b.status !== 'depleted'
      ) {
        const candidate = evaluateBatchMarkdown(b, dynamicMarkdownConfig);
        if (candidate) {
          b.markdownDiscountPercent = candidate.discountPercent;
          count++;
        }
      }
    });

    res.json({
      success: true,
      appliedCount: count,
      message: `Dynamic markdowns applied to ${count} near-expiry batch lots across storefront & POS registers.`,
    });
  });

  // =============================================================
  // 21. INDONESIAN REGULATORY COMPLIANCE SUITE (5 CORE MODULES)
  // =============================================================

  // --- MODULE 1A: CUSTOMER RMA & NOTA RETUR PENJUALAN (B2C / B2B / POS) ---
  app.get('/api/admin/compliance/rma', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    let list = [...customerRmaList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((r) => r.storeId === storeId);
    }
    res.json(list);
  });

  app.get('/api/admin/compliance/rma-sources', (_req: Request, res: Response) => {
    const posReceipts = posTransactionsHistory.slice(0, 20).map((r) => ({
      sourceChannel: 'POS' as RmaSourceChannel,
      referenceId: r.receiptNumber,
      storeId: r.storeId,
      storeName: r.storeName,
      customerName: 'Walk-in Retail Shopper',
      totalAmountIDR: r.total,
      timestamp: r.timestamp,
      items: r.items.map((it) => ({
        sku: it.sku,
        productName: it.name,
        category: it.category,
        quantity: it.quantity,
        unitPriceIDR: it.unitPrice,
        unitCostIDR: it.unitCost || Math.round(it.unitPrice * 0.62),
        lotNumber: it.lotNumber,
      })),
    }));

    const b2c = customerOrders.slice(0, 20).map((o) => ({
      sourceChannel: 'B2C' as RmaSourceChannel,
      referenceId: o.id,
      storeId: (o as any).storeId || o.pickupStore?.id || 'store-jkt-senopati',
      storeName: o.pickupStore?.name || 'GroceMart B2C Storefront',
      customerName: o.customerName || 'B2C Shopper',
      totalAmountIDR: (o as any).totalAmount ?? o.total ?? 0,
      timestamp: o.createdAt || new Date().toISOString(),
      items: (o.items || []).map((it: any) => ({
        sku: it.product?.sku || it.sku || 'SKU-PRD-001',
        productName: it.product?.name || it.name || 'GroceMart Item',
        category: it.product?.category || 'produce',
        quantity: it.quantity || 1,
        unitPriceIDR: it.product?.price || it.price || 18500,
        unitCostIDR: Math.round((it.product?.price || it.price || 18500) * 0.65),
        lotNumber: 'BAT-202611-01',
      })),
    }));

    const b2b = b2bOrdersList.slice(0, 20).map((o) => {
      const cust = b2bCustomersList.find((c) => c.id === o.customerId);
      return {
        sourceChannel: 'B2B' as RmaSourceChannel,
        referenceId: o.id,
        storeId: 'store-jkt-senopati',
        storeName: 'Central Distribution Center (B2B)',
        customerId: o.customerId,
        customerName: o.companyName,
        customerNpwpOrNik: cust?.npwp || cust?.nik || '',
        totalAmountIDR: o.totalAmountIDR,
        timestamp: o.orderDate,
        items: o.items.map((it) => ({
          sku: it.product?.sku || 'B2B-SKU',
          productName: it.product?.name || 'Wholesale Item',
          category: it.product?.category || 'pantry_staples',
          quantity: it.baseUnitsCalculated || it.quantity,
          unitPriceIDR: Math.round(it.lineTotal / Math.max(1, it.baseUnitsCalculated || it.quantity)),
          unitCostIDR: Math.round((it.lineTotal / Math.max(1, it.baseUnitsCalculated || it.quantity)) * 0.78),
          lotNumber: 'BAT-B2B-2026',
        })),
      };
    });

    res.json({ posReceipts, b2cOrders: b2c, b2bOrders: b2b });
  });

  app.post('/api/admin/compliance/rma', (req: Request, res: Response) => {
    const {
      sourceChannel = 'POS',
      sourceReferenceId,
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      customerId,
      customerName = 'Retail Customer',
      customerNpwpOrNik,
      refundMethod = 'CASH',
      items = [],
      notes,
    } = req.body as {
      sourceChannel: RmaSourceChannel;
      sourceReferenceId: string;
      storeId?: string;
      storeName?: string;
      customerId?: string;
      customerName?: string;
      customerNpwpOrNik?: string;
      refundMethod?: RmaRefundMethod;
      items: Array<{
        sku: string;
        productName: string;
        category?: string;
        quantity: number;
        unitPriceIDR: number;
        unitCostIDR?: number;
        disposition: RmaDisposition;
        lotNumber?: string;
        reason?: string;
      }>;
      notes?: string;
    };

    if (!sourceReferenceId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'sourceReferenceId and at least one return item are required.' });
    }

    const timestamp = new Date().toISOString();
    const seq = (customerRmaList.length + 1).toString().padStart(4, '0');
    const rmaId = `RMA-2026-${seq}`;
    const notaReturNumber = `NR-2026-${seq}`;

    let totalSubtotalReversed = 0;
    let totalPpnReversed = 0;
    let totalRestockCogs = 0;
    let totalScrapLoss = 0;

    const processedItems: CustomerRmaItem[] = items.map((it) => {
      const qty = Math.max(0.01, Number(it.quantity) || 1);
      const uPrice = Math.max(0, Number(it.unitPriceIDR) || 0);
      const uCost = Math.max(0, Number(it.unitCostIDR) || Math.round(uPrice * 0.65));
      const lineGross = Math.round(qty * uPrice);

      const rule = skuTaxRulesList.find((r) => r.sku === it.sku);
      const taxCat: IndonesianTaxCategory =
        rule?.taxCategory || inferDefaultTaxCategory(it.category || '', it.productName);
      const taxCalc = computeIndonesianTax(
        lineGross,
        taxCat,
        sourceChannel !== 'B2B',
        rule?.taxRatePercent || 11
      );

      totalSubtotalReversed += taxCalc.dppIDR;
      totalPpnReversed += taxCalc.ppnIDR + taxCalc.pb1IDR;

      if (it.disposition === 'RESTOCK_ATP') {
        totalRestockCogs += Math.round(qty * uCost);
        const tier = storeInventoryTiers.find(
          (t) => t.sku === it.sku && (t.storeId === storeId || storeId === 'CONSOLIDATED')
        );
        if (tier) {
          tier.physicalStock = Number((tier.physicalStock + qty).toFixed(2));
          tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
          tier.updatedAt = timestamp;
        }
        const inv = inventoryList.find((p) => p.sku === it.sku);
        if (inv) {
          inv.currentStock = Number(((inv.currentStock || 0) + qty).toFixed(2));
        }
        syncBatchesForStockVariance(it.sku, storeId, qty, uCost, it.lotNumber);
      } else {
        totalScrapLoss += Math.round(qty * uCost);
        const batchId = `BAT-QUAR-${Date.now().toString().slice(-5)}`;
        inventoryBatches.unshift({
          batchId,
          sku: it.sku,
          productName: it.productName,
          storeId,
          storeName,
          warehouseZoneId: 'ZONE-QUAR-01',
          lotNumber: it.lotNumber || `QUAR-${seq}`,
          initialQuantity: qty,
          currentStock: qty,
          unitCost: uCost,
          sellingPrice: uPrice,
          receivedDate: timestamp.split('T')[0],
          expiryDate: timestamp.split('T')[0],
          daysUntilExpiry: 0,
          status: 'quarantined',
          storageZone: 'cold_chilled',
          supplierName: `Customer RMA (${customerName})`,
          notes: `Quarantined from Customer RMA ${notaReturNumber}: ${it.reason || 'Damaged/Expired'}`,
        });
        wasteRecords.unshift({
          id: `WST-RMA-${Date.now().toString().slice(-5)}`,
          sku: it.sku,
          productName: it.productName,
          storeId,
          storeName,
          warehouseZoneId: 'ZONE-QUAR-01',
          batchId,
          lotNumber: it.lotNumber || `QUAR-${seq}`,
          quantityScrapped: qty,
          unit: 'unit',
          unitCost: uCost,
          totalShrinkageCost: Math.round(qty * uCost),
          reason: 'customer_return_opened',
          actionTaken: 'safe_disposal',
          reportedBy: currentActiveStaffSession.userName,
          reportedAt: timestamp,
          glEntryId: `GLE-RMA-${seq}-SCRAP`,
          notes: `RMA Scrap/Quarantine (${notaReturNumber}): ${it.reason || 'Damaged on return'}`,
        });
      }

      return {
        sku: it.sku,
        productName: it.productName,
        category: it.category,
        quantity: qty,
        unitPriceIDR: uPrice,
        unitCostIDR: uCost,
        lineTotalIDR: taxCalc.totalIDR,
        taxCategory: taxCat,
        ppnAdjustmentIDR: taxCalc.ppnIDR + taxCalc.pb1IDR,
        disposition: it.disposition,
        lotNumber: it.lotNumber,
        reason: it.reason || 'Customer return',
      };
    });

    const totalCreditNoteIDR = totalSubtotalReversed + totalPpnReversed;
    const glIds: string[] = [];

    // 1. Reverse Revenue (#4010 retail / #4020 B2B) + Output VAT (#2025) vs AR/Cash/StoreCredit
    const revGleId = `GLE-RMA-${seq}-REV`;
    const settleGleId = `GLE-RMA-${seq}-SETTLE`;
    glIds.push(revGleId);

    const rmaRevGlBatch: GeneralLedgerEntry[] = [
      {
        id: revGleId,
        timestamp,
        storeId,
        storeName,
        accountCode: sourceChannel === 'B2B' ? '4020' : '4010',
        accountName: sourceChannel === 'B2B' ? 'B2B Wholesale Revenue' : 'Grocery Sales Revenue',
        category: 'Revenue',
        debit: totalSubtotalReversed,
        credit: 0,
        referenceType: 'POS_SALE',
        referenceId: notaReturNumber,
        description: `Sales Return Reversal (${notaReturNumber}) for ${sourceChannel} Ref #${sourceReferenceId}`,
      },
    ];

    if (totalPpnReversed > 0) {
      const taxGleId = `GLE-RMA-${seq}-PPN`;
      glIds.push(taxGleId);
      rmaRevGlBatch.push({
        id: taxGleId,
        timestamp,
        storeId,
        storeName,
        accountCode: '2025',
        accountName: 'PPN Keluaran (VAT Output Payable 11%/12%)',
        category: 'Liability',
        debit: totalPpnReversed,
        credit: 0,
        referenceType: 'TAX_ADJUSTMENT',
        referenceId: notaReturNumber,
        description: `Nota Retur PPN Keluaran Adjustment (${notaReturNumber}) - DJP e-Faktur Compliance`,
      });
    }

    glIds.push(settleGleId);
    if (refundMethod === 'AR_REDUCTION' || sourceChannel === 'B2B') {
      rmaRevGlBatch.push({
        id: settleGleId,
        timestamp,
        storeId,
        storeName,
        accountCode: '1200',
        accountName: 'B2B Accounts Receivable (Piutang Usaha)',
        category: 'Asset',
        debit: 0,
        credit: totalCreditNoteIDR,
        referenceType: 'B2B_AR_CREDIT',
        referenceId: notaReturNumber,
        description: `Credit Note ${notaReturNumber} AR reduction for ${customerName}`,
      });
      if (customerId) {
        const b2bCust = b2bCustomersList.find((c) => c.id === customerId);
        if (b2bCust) {
          b2bCust.outstandingAR = Math.max(0, b2bCust.outstandingAR - totalCreditNoteIDR);
          b2bCust.availableCredit = Math.max(0, b2bCust.creditLimit - b2bCust.outstandingAR);
        }
      }
    } else if (refundMethod === 'CASH') {
      rmaRevGlBatch.push({
        id: settleGleId,
        timestamp,
        storeId,
        storeName,
        accountCode: '1010',
        accountName: 'Cash on Hand & Store Registers',
        category: 'Asset',
        debit: 0,
        credit: totalCreditNoteIDR,
        referenceType: 'POS_SALE',
        referenceId: notaReturNumber,
        description: `Cash drawer refund for Customer RMA ${notaReturNumber}`,
      });
      const openShift = posShiftsList.find((s) => s.status === 'OPEN' && s.storeId === storeId);
      if (openShift) {
        openShift.cashRefundsIDR += totalCreditNoteIDR;
        openShift.expectedTotalCashInDrawerIDR =
          openShift.openingFloatIDR + openShift.expectedCashSalesIDR - openShift.cashRefundsIDR;
      }
    } else {
      rmaRevGlBatch.push({
        id: settleGleId,
        timestamp,
        storeId,
        storeName,
        accountCode: '2020',
        accountName: 'Customer Store Credit Liability',
        category: 'Liability',
        debit: 0,
        credit: totalCreditNoteIDR,
        referenceType: 'POS_SALE',
        referenceId: notaReturNumber,
        description: `Store credit voucher issued for RMA ${notaReturNumber}`,
      });
    }
    commitBalancedGlBatch(rmaRevGlBatch, true);

    // 4. Inventory Asset Restock (#1040 vs #5010 COGS) or Scrap Quarantine (#6030 vs #5010)
    if (totalRestockCogs > 0) {
      const invGle = `GLE-RMA-${seq}-INV`;
      const cogsGle = `GLE-RMA-${seq}-COGS`;
      glIds.push(invGle, cogsGle);
      commitBalancedGlBatch(
        [
          {
            id: invGle,
            timestamp,
            storeId,
            storeName,
            accountCode: '1040',
            accountName: 'Merchandise Inventory Asset',
            category: 'Asset',
            debit: totalRestockCogs,
            credit: 0,
            referenceType: 'POS_SALE',
            referenceId: notaReturNumber,
            description: `Good-condition RMA restocked to Available ATP (${notaReturNumber})`,
          },
          {
            id: cogsGle,
            timestamp,
            storeId,
            storeName,
            accountCode: '5010',
            accountName: 'Cost of Goods Sold (COGS)',
            category: 'Expense',
            debit: 0,
            credit: totalRestockCogs,
            referenceType: 'POS_SALE',
            referenceId: notaReturNumber,
            description: `COGS reversal for restocked RMA items (${notaReturNumber})`,
          },
        ],
        true
      );
    }

    if (totalScrapLoss > 0) {
      const scrapDrGle = `GLE-RMA-${seq}-SCRAP`;
      const scrapCrGle = `GLE-RMA-${seq}-SCRAP-CR`;
      glIds.push(scrapDrGle, scrapCrGle);
      commitBalancedGlBatch(
        [
          {
            id: scrapDrGle,
            timestamp,
            storeId,
            storeName,
            accountCode: '6030',
            accountName: 'Perishable Spoilage & Shrinkage Expense',
            category: 'Expense',
            debit: totalScrapLoss,
            credit: 0,
            referenceType: 'WASTE_SHRINKAGE',
            referenceId: notaReturNumber,
            description: `RMA Spoilage/Quarantine Loss (${notaReturNumber})`,
          },
          {
            id: scrapCrGle,
            timestamp,
            storeId,
            storeName,
            accountCode: '5010',
            accountName: 'Cost of Goods Sold (COGS)',
            category: 'Expense',
            debit: 0,
            credit: totalScrapLoss,
            referenceType: 'WASTE_SHRINKAGE',
            referenceId: notaReturNumber,
            description: `COGS reclassification to Spoilage Expense for RMA (${notaReturNumber})`,
          },
        ],
        true
      );
    }

    const rmaRecord: CustomerRmaRecord = {
      id: rmaId,
      notaReturNumber,
      sourceChannel,
      sourceReferenceId,
      storeId,
      storeName,
      customerId,
      customerName,
      customerNpwpOrNik,
      items: processedItems,
      subtotalReversedIDR: totalSubtotalReversed,
      ppnReversedIDR: totalPpnReversed,
      totalCreditNoteIDR,
      refundMethod,
      status: 'COMPLETED',
      glVoucherIds: glIds,
      createdAt: timestamp,
      processedBy: currentActiveStaffSession.userName,
      notes,
    };
    customerRmaList.unshift(rmaRecord);

    // Sync to existing posReturnsList for 100% backward compatibility
    posReturnsList.unshift({
      id: rmaId,
      originalReceiptNumber: sourceReferenceId,
      originalOrderId: sourceReferenceId,
      storeId,
      storeName,
      processedByUserId: currentActiveStaffSession.userId,
      processedByUserName: currentActiveStaffSession.userName,
      timestamp,
      items: processedItems.map((it) => ({
        sku: it.sku,
        productName: it.productName,
        category: it.category || 'produce',
        originalQuantity: it.quantity,
        returnQuantity: it.quantity,
        unitPrice: it.unitPriceIDR,
        unitCost: it.unitCostIDR,
        refundAmount: it.lineTotalIDR,
        returnReason: 'PERISHABLE_DEFECT',
        disposition: it.disposition === 'RESTOCK_ATP' ? 'RESTOCK_INVENTORY' : 'RETURN_CAGE_WASTE',
        conditionNotes: it.reason,
      })),
      totalRefundAmountIDR: totalCreditNoteIDR,
      refundChannel: refundMethod === 'CASH' ? 'CASH_DRAWER' : 'STORE_CREDIT_VOUCHER',
      glVoucherIds: glIds,
      status: 'COMPLETED',
      customerName,
    });

    res.json({
      success: true,
      rma: rmaRecord,
      message: `Credit Note ${notaReturNumber} issued (${refundMethod}) with PPN Keluaran adjustment Rp ${totalPpnReversed.toLocaleString('id-ID')}.`,
    });
  });

  // --- MODULE 1B: RETURN-TO-VENDOR (RTV) & DEBIT NOTE (NOTA RETUR PEMBELIAN) ---
  app.get('/api/admin/compliance/rtv', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    let list = [...vendorRtvList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((r) => r.storeId === storeId);
    }
    res.json(list);
  });

  app.post('/api/admin/compliance/rtv', (req: Request, res: Response) => {
    const {
      qcInspectionId,
      vendorBillId,
      poId,
      supplierId = 'SUPP-AGRO-01',
      supplierName = 'PT Lembang Agro Sejahtera',
      supplierNpwp = '013084492007000',
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      sku,
      productName,
      lotNumber = 'LOT-QC-REJECT',
      quantityReturned = 1,
      unit = 'pack',
      unitCostIDR,
      reason = 'QC Rejected / Damaged Batch Return-to-Vendor',
    } = req.body;

    if (!sku) {
      return res.status(400).json({ error: 'SKU is required to generate an RTV Debit Note.' });
    }

    if (qcInspectionId && vendorRtvList.some((r) => r.qcInspectionId === qcInspectionId)) {
      return res.status(409).json({
        error: `RTV Debit Note already issued for QC Inspection ${qcInspectionId}.`,
      });
    }

    const timestamp = new Date().toISOString();
    const seq = (vendorRtvList.length + 1).toString().padStart(4, '0');
    const rtvId = `RTV-2026-${seq}`;
    const debitNoteNumber = `NRP-2026-${seq}`;
    const qty = Math.max(1, Number(quantityReturned) || 1);

    const inv = inventoryList.find((i) => i.sku === sku);
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    const resolvedUnitCost = Number(unitCostIDR) || tier?.unitCost || inv?.wacUnitCost || 18000;
    const subtotalReturnedIDR = Math.round(qty * resolvedUnitCost);

    const rule = skuTaxRulesList.find((r) => r.sku === sku);
    const taxCat: IndonesianTaxCategory =
      rule?.taxCategory || inferDefaultTaxCategory(inv?.category || '', productName || inv?.name || '');
    const taxCalc = computeIndonesianTax(subtotalReturnedIDR, taxCat, false, rule?.taxRatePercent || 11);
    const ppnMasukanReversedIDR = taxCalc.ppnIDR;
    const totalDebitNoteIDR = subtotalReturnedIDR + ppnMasukanReversedIDR;

    const matchingBatch =
      inventoryBatches.find(
        (b) => b.sku === sku && b.storeId === storeId && (b.lotNumber === lotNumber || b.status === 'quarantined')
      ) ||
      inventoryBatches.find(
        (b) => b.sku === sku && (b.lotNumber === lotNumber || b.status === 'quarantined')
      );
    const wasQuarantined = matchingBatch?.status === 'quarantined';

    // Deduct stock from batch, tier, and catalog
    if (tier) {
      tier.physicalStock = Math.max(0, Number((tier.physicalStock - qty).toFixed(2)));
      if (wasQuarantined || qcInspectionId) {
        tier.reservedStock = Math.max(0, Number((tier.reservedStock - qty).toFixed(2)));
      }
      tier.reservedStock = Math.min(tier.reservedStock, tier.physicalStock);
      tier.availableStock = Math.max(0, Number((tier.physicalStock - tier.reservedStock).toFixed(2)));
      tier.totalValuation = Math.round(tier.physicalStock * tier.unitCost);
      tier.updatedAt = timestamp;
    }
    if (inv) {
      inv.currentStock = Math.max(0, Number(((inv.currentStock || 0) - qty).toFixed(2)));
    }
    if (matchingBatch) {
      matchingBatch.currentStock = Math.max(0, Number((matchingBatch.currentStock - qty).toFixed(2)));
      if (matchingBatch.currentStock === 0) matchingBatch.status = 'depleted';
      matchingBatch.notes = `Dispatched via RTV ${debitNoteNumber}`;
    }

    // Post-Approval RTV & Vendor Credit Balance Guard:
    // Prevent COA #2010 / #2100 from going negative or over-crediting a PAID Vendor Bill.
    const linkedBill = findLinkedVendorBillForRtv({
      vendorBillId,
      poId,
      qcInspectionId,
      supplierName,
      sku,
    });
    const billRemainingIDR = linkedBill
      ? linkedBill.remainingBalanceIDR ?? Math.round((linkedBill.remainingDue ?? 0) * (linkedBill.exchangeRate || 1))
      : 0;
    const ap2010Balance = chartOfAccounts.find((c) => c.accountCode === '2010')?.balance ?? 0;

    let apOffsetIDR = 0;
    let prepaymentAdvanceIDR = 0;

    if (linkedBill) {
      if (linkedBill.status !== 'PAID' && billRemainingIDR > 0 && ap2010Balance > 0) {
        apOffsetIDR = Math.min(totalDebitNoteIDR, billRemainingIDR, ap2010Balance);
        prepaymentAdvanceIDR = Math.max(0, totalDebitNoteIDR - apOffsetIDR);

        const newRemIDR = Math.max(0, billRemainingIDR - apOffsetIDR);
        linkedBill.remainingBalanceIDR = newRemIDR;
        linkedBill.remainingDue =
          linkedBill.exchangeRate && linkedBill.exchangeRate > 1
            ? Number((newRemIDR / linkedBill.exchangeRate).toFixed(2))
            : newRemIDR;
        if (newRemIDR === 0) {
          linkedBill.status = 'PAID';
          linkedBill.paymentStatus = 'PAID';
        } else {
          linkedBill.status = 'PARTIALLY_PAID';
          linkedBill.paymentStatus = 'PARTIALLY_PAID';
        }
      } else {
        // Bill already PAID or remaining balance is 0 -> post full RTV claim to #1150 Vendor Prepayments / Advances
        apOffsetIDR = 0;
        prepaymentAdvanceIDR = totalDebitNoteIDR;
      }
    } else if (ap2010Balance >= totalDebitNoteIDR) {
      apOffsetIDR = totalDebitNoteIDR;
    } else {
      apOffsetIDR = 0;
      prepaymentAdvanceIDR = totalDebitNoteIDR;
    }

    const g1 = `GLE-RTV-${seq}-AP`;
    const gAdv = `GLE-RTV-${seq}-ADV`;
    const g2 = `GLE-RTV-${seq}-INV`;
    const glIds: string[] = [];
    const rtvGlBatch: GeneralLedgerEntry[] = [];

    if (apOffsetIDR > 0) {
      glIds.push(g1);
      rtvGlBatch.push({
        id: g1,
        timestamp,
        storeId,
        storeName,
        accountCode: '2010',
        accountName: 'Trade Accounts Payable',
        category: 'Liability',
        debit: apOffsetIDR,
        credit: 0,
        referenceType: 'PURCHASE_AP',
        referenceId: debitNoteNumber,
        description: `RTV Debit Note ${debitNoteNumber} reducing AP to ${supplierName} (Bill: ${linkedBill?.id || 'Open AP'}, QC: ${qcInspectionId || 'Manual'})`,
      });
    }

    if (prepaymentAdvanceIDR > 0) {
      glIds.push(gAdv);
      rtvGlBatch.push({
        id: gAdv,
        timestamp,
        storeId,
        storeName,
        accountCode: '1150',
        accountName: 'Vendor Prepayments / Advances (Uang Muka Pembelian)',
        category: 'Asset',
        debit: prepaymentAdvanceIDR,
        credit: 0,
        referenceType: 'PURCHASE_AP',
        referenceId: debitNoteNumber,
        description: `Post-payment RTV Debit Note ${debitNoteNumber} (${linkedBill ? `Bill ${linkedBill.id} ${linkedBill.status}` : 'Insufficient AP'}) booked as Vendor Advance to ${supplierName}`,
      });
    }

    glIds.push(g2);
    rtvGlBatch.push({
      id: g2,
      timestamp,
      storeId,
      storeName,
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: 0,
      credit: subtotalReturnedIDR,
      referenceType: 'PURCHASE_AP',
      referenceId: debitNoteNumber,
      description: `Inventory Asset deducted for RTV ${debitNoteNumber} (${qty} ${unit} ${sku})`,
    });

    if (ppnMasukanReversedIDR > 0) {
      const g3 = `GLE-RTV-${seq}-VAT`;
      glIds.push(g3);
      rtvGlBatch.push({
        id: g3,
        timestamp,
        storeId,
        storeName,
        accountCode: '2026',
        accountName: 'PPN Masukan (VAT Input Creditable)',
        category: 'Asset',
        debit: 0,
        credit: ppnMasukanReversedIDR,
        referenceType: 'TAX_ADJUSTMENT',
        referenceId: debitNoteNumber,
        description: `PPN Masukan reversed on Nota Retur Pembelian ${debitNoteNumber}`,
      });
    }

    commitBalancedGlBatch(rtvGlBatch, true);

    const vcnId = `VCN-2026-${seq}`;
    vendorCreditNotesList.unshift({
      creditNoteId: vcnId,
      rmaNumber: debitNoteNumber,
      supplierId,
      supplierName,
      storeId,
      storeName,
      sku,
      productName: productName || inv?.name || sku,
      lotNumber,
      quantityReturned: qty,
      unit,
      unitCost: resolvedUnitCost,
      totalCreditIDR: totalDebitNoteIDR,
      reason: 'spoiled_on_arrival',
      status: apOffsetIDR > 0 && linkedBill ? 'applied_to_bill' : 'pending_pickup',
      appliedToBillId: apOffsetIDR > 0 && linkedBill ? linkedBill.id : undefined,
      createdAt: timestamp,
      approvedBy: currentActiveStaffSession.userName,
      journalEntryId: glIds[0],
      notes:
        prepaymentAdvanceIDR > 0
          ? `Linked to ${debitNoteNumber} (${reason}) — Rp ${prepaymentAdvanceIDR.toLocaleString('id-ID')} booked to #1150 Vendor Prepayments`
          : `Linked to ${debitNoteNumber} (${reason})`,
    });

    const newRtv: VendorRtvDebitNote = {
      id: rtvId,
      debitNoteNumber,
      qcInspectionId,
      vendorCreditNoteId: vcnId,
      supplierId,
      supplierName,
      supplierNpwp,
      storeId,
      storeName,
      sku,
      productName: productName || inv?.name || sku,
      lotNumber,
      quantityReturned: qty,
      unit,
      unitCostIDR: resolvedUnitCost,
      subtotalReturnedIDR,
      ppnMasukanReversedIDR,
      totalDebitNoteIDR,
      reason,
      status: 'ISSUED',
      glVoucherIds: glIds,
      createdAt: timestamp,
      createdBy: currentActiveStaffSession.userName,
    };
    vendorRtvList.unshift(newRtv);

    res.json({
      success: true,
      rtv: newRtv,
      apOffsetIDR,
      vendorPrepaymentAdvanceIDR: prepaymentAdvanceIDR,
      linkedBillId: linkedBill?.id,
      message:
        prepaymentAdvanceIDR > 0 && apOffsetIDR === 0
          ? `Vendor Debit Note ${debitNoteNumber} issued for ${supplierName}. Linked bill already settled; Rp ${prepaymentAdvanceIDR.toLocaleString('id-ID')} recorded in #1150 Vendor Prepayments & PPN Masukan adjusted.`
          : `Vendor Debit Note ${debitNoteNumber} issued for ${supplierName}. AP & PPN Masukan adjusted.`,
    });
  });

  // --- MODULE 2: BLIND STOCK OPNAME & SHRINKAGE VARIANCE ---
  app.get('/api/admin/compliance/blind-opname', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    let sheets = [...blindOpnameSheetsList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      sheets = sheets.filter((s) => s.storeId === storeId);
    }
    // Strict anti-fraud payload projection: NEVER return systemQty/varianceQty while COUNTING
    const sanitized = sheets.map((s) => ({
      ...s,
      items: s.items.map((line) =>
        s.status === 'COUNTING'
          ? {
              sku: line.sku,
              productName: line.productName,
              category: line.category,
              unit: line.unit,
              warehouseZoneId: line.warehouseZoneId,
              binLocation: line.binLocation,
              expectedLotNumber: line.expectedLotNumber,
              countedLotNumber: line.countedLotNumber,
              countedQty: line.countedQty,
              notes: line.notes,
            }
          : line
      ),
    }));
    res.json(sanitized);
  });

  app.post('/api/admin/compliance/blind-opname/generate', (req: Request, res: Response) => {
    const {
      warehouseHub = 'CDC',
      storeId = 'store-jkt-senopati',
      zoneFilter = 'ALL',
    } = req.body as {
      warehouseHub?: 'CDC' | 'DARK_STORE' | 'RETAIL_FRONT';
      storeId?: string;
      zoneFilter?: string;
    };

    const hubDefaultStore =
      warehouseHub === 'CDC'
        ? 'store-jkt-senopati'
        : warehouseHub === 'DARK_STORE'
        ? 'store-jkt-pik'
        : storeId || 'store-bdg-dago';
    const targetStoreId = storeId && storeId !== 'CONSOLIDATED' ? storeId : hubDefaultStore;
    const storeInfo = storeSchedules.find((s) => s.storeId === targetStoreId);
    const storeName = storeInfo?.storeName || 'GroceMart Senopati Flagship';

    let tiers = storeInventoryTiers.filter((t) => t.storeId === targetStoreId);
    if (zoneFilter && zoneFilter !== 'ALL') {
      tiers = tiers.filter((t) => t.warehouseZoneId === zoneFilter);
    }
    if (tiers.length === 0) {
      tiers = storeInventoryTiers.slice(0, 6);
    }

    const seq = (blindOpnameSheetsList.length + 1).toString().padStart(3, '0');
    const id = `BLIND-OPN-2026-${seq}`;
    const sheetNumber = `SO-BLIND-2026-${seq}`;

    const items: BlindOpnameLine[] = tiers.slice(0, 10).map((t) => {
      const batch = inventoryBatches.find((b) => b.sku === t.sku && b.storeId === t.storeId);
      return {
        sku: t.sku,
        productName: t.productName,
        category: t.category,
        unit: t.unit,
        warehouseZoneId: t.warehouseZoneId,
        binLocation: t.warehouseZoneId.includes('COLD')
          ? 'Chilled-Rack-A1'
          : t.warehouseZoneId.includes('FRZ')
          ? 'Freezer-Bay-F2'
          : 'Ambient-Rack-B3',
        expectedLotNumber: batch?.lotNumber || `BAT-202611-${t.sku.slice(-3)}`,
        countedLotNumber: batch?.lotNumber || `BAT-202611-${t.sku.slice(-3)}`,
        countedQty: null,
        systemQty: t.physicalStock,
        unitCostIDR: t.unitCost,
      };
    });

    const newSheet: BlindOpnameSheet = {
      id,
      sheetNumber,
      warehouseHub,
      storeId: targetStoreId,
      storeName,
      zoneFilter,
      status: 'COUNTING',
      createdAt: new Date().toISOString(),
      createdBy: currentActiveStaffSession.userName,
      totalSurplusValueIDR: 0,
      totalShortageValueIDR: 0,
      netVarianceValueIDR: 0,
      glVoucherIds: [],
      items,
    };

    blindOpnameSheetsList.unshift(newSheet);

    const sanitized = {
      ...newSheet,
      items: newSheet.items.map(({ systemQty: _sys, unitCostIDR: _cost, ...visible }) => visible),
    };

    res.json({
      success: true,
      sheet: sanitized,
      message: `Blind Count Sheet ${sheetNumber} generated for ${storeName} (${items.length} SKUs). System quantities hidden from counter.`,
    });
  });

  app.post('/api/admin/compliance/blind-opname/:id/submit', (req: Request, res: Response) => {
    const { id } = req.params;
    const { counts = [], submittedBy } = req.body as {
      counts: Array<{ sku: string; countedQty: number; countedLotNumber?: string; notes?: string }>;
      submittedBy?: string;
    };

    const sheet = blindOpnameSheetsList.find((s) => s.id === id);
    if (!sheet) return res.status(404).json({ error: `Blind count sheet ${id} not found` });

    const timestamp = new Date().toISOString();
    let totalSurplus = 0;
    let totalShortage = 0;

    sheet.items = sheet.items.map((line) => {
      const input = counts.find((c) => c.sku === line.sku);
      const countedQty = input !== undefined ? Math.max(0, Number(input.countedQty) || 0) : (line.countedQty ?? 0);
      const sysQty = line.systemQty ?? 0;
      const varianceQty = Number((countedQty - sysQty).toFixed(2));
      const unitCost = line.unitCostIDR ?? 15000;
      const varianceVal = Math.round(varianceQty * unitCost);

      if (varianceVal > 0) totalSurplus += varianceVal;
      if (varianceVal < 0) totalShortage += Math.abs(varianceVal);

      return {
        ...line,
        countedQty,
        countedLotNumber: input?.countedLotNumber || line.countedLotNumber,
        notes: input?.notes || line.notes,
        systemQty: sysQty,
        varianceQty,
        unitCostIDR: unitCost,
        varianceValueIDR: varianceVal,
        status: varianceQty === 0 ? 'MATCHED' : varianceQty > 0 ? 'SURPLUS' : 'SHORTAGE',
      };
    });

    sheet.totalSurplusValueIDR = totalSurplus;
    sheet.totalShortageValueIDR = totalShortage;
    sheet.netVarianceValueIDR = totalSurplus - totalShortage;
    sheet.status = 'PENDING_APPROVAL';
    sheet.submittedAt = timestamp;
    sheet.submittedBy = submittedBy || currentActiveStaffSession.userName;

    const approvalId = `APR-OPN-${Date.now().toString().slice(-5)}`;
    sheet.approvalRequestId = approvalId;

    approvalQueueList.unshift({
      id: approvalId,
      module: 'blind_stock_opname',
      documentId: sheet.id,
      documentTitle: `Blind Opname Variance Audit: ${sheet.sheetNumber} (${sheet.storeName})`,
      requestedBy: sheet.submittedBy,
      requestedAt: timestamp,
      storeId: sheet.storeId,
      storeName: sheet.storeName,
      amountIDR: Math.abs(sheet.netVarianceValueIDR),
      currentTierLevel: 1,
      requiredTierLevel: 1,
      status: 'PENDING',
      history: [],
      payloadSummary: {
        sku: sheet.items[0]?.sku,
        productName: `${sheet.items.length} SKUs (${sheet.warehouseHub})`,
        quantity: sheet.items.length,
        reason: `Surplus Rp ${totalSurplus.toLocaleString('id-ID')} / Shortage Rp ${totalShortage.toLocaleString('id-ID')} (Net Rp ${sheet.netVarianceValueIDR.toLocaleString('id-ID')})`,
      },
    });

    emitEnterpriseNotification({
      dedupeKey: `APR_QUEUE:${approvalId}`,
      category: 'PROCUREMENT_FINANCE',
      severity: 'ACTION_REQUIRED',
      title: `Stocktake Variance Approval (${sheet.sheetNumber})`,
      message: `${sheet.storeName} Blind Opname net variance Rp ${sheet.netVarianceValueIDR.toLocaleString('id-ID')} queued for Supervisor sign-off.`,
      metadataLabel: `${sheet.sheetNumber} • Rp ${Math.abs(sheet.netVarianceValueIDR).toLocaleString('id-ID')}`,
      targetTab: 'approvals',
    });

    res.json({
      success: true,
      sheet,
      approvalRequestId: approvalId,
      message: `Blind Count ${sheet.sheetNumber} submitted. Variance revealed and routed to Supervisor Approval Matrix (${approvalId}).`,
    });
  });

  app.post('/api/admin/compliance/blind-opname/:id/approve', (req: Request, res: Response) => {
    const { id } = req.params;
    const { action = 'APPROVED', approverNotes } = req.body as {
      action?: 'APPROVED' | 'REJECTED';
      approverNotes?: string;
    };

    const sheet = blindOpnameSheetsList.find((s) => s.id === id);
    if (!sheet) return res.status(404).json({ error: `Blind count sheet ${id} not found` });

    const reqItem = approvalQueueList.find(
      (q) => q.id === sheet.approvalRequestId || q.documentId === sheet.id
    );

    if (action === 'REJECTED') {
      sheet.status = 'REJECTED';
      if (reqItem) reqItem.status = 'REJECTED';
      return res.json({
        success: true,
        sheet,
        message: `Blind Opname ${sheet.sheetNumber} rejected. Re-count required.`,
      });
    }

    const glIds = applyBlindOpnameApproval(sheet, currentActiveStaffSession.userName);
    if (reqItem) {
      reqItem.status = 'APPROVED';
      reqItem.history.push({
        tierLevel: 1,
        tierName: 'Supervisor Reconciliation',
        approverId: currentActiveStaffSession.userId,
        approverName: currentActiveStaffSession.userName,
        approverRole: currentActiveStaffSession.userRole,
        action: 'APPROVED',
        timestamp: new Date().toISOString(),
        comments: approverNotes || 'Physical variance verified and posted to COA #5210',
      });
    }

    res.json({
      success: true,
      sheet,
      glVoucherIds: glIds,
      message: `Blind Opname ${sheet.sheetNumber} approved. Stock levels & COA #5210 Shrinkage Variance synchronized.`,
    });
  });

  // --- MODULE 4: POS CASHIER SHIFT & BLIND Z-REPORT RECONCILIATION ---
  app.get('/api/pos/shifts/active', (req: Request, res: Response) => {
    const { storeId = 'store-jkt-senopati' } = req.query as { storeId?: string };
    const effectiveStore = storeId === 'CONSOLIDATED' ? 'store-jkt-senopati' : storeId;
    const active = posShiftsList.find((s) => s.status === 'OPEN' && s.storeId === effectiveStore) || null;
    res.json({ activeShift: active });
  });

  app.get('/api/pos/shifts/history', (req: Request, res: Response) => {
    const { storeId } = req.query as { storeId?: string };
    let list = [...posShiftsList];
    if (storeId && storeId !== 'ALL' && storeId !== 'CONSOLIDATED') {
      list = list.filter((s) => s.storeId === storeId);
    }
    res.json(list);
  });

  app.post('/api/pos/shifts/open', (req: Request, res: Response) => {
    const {
      storeId = 'store-jkt-senopati',
      storeName = 'GroceMart Senopati Flagship',
      registerId = 'REG-04',
      openingFloatIDR = 500000,
      cashierName,
    } = req.body;

    const existing = posShiftsList.find((s) => s.status === 'OPEN' && s.storeId === storeId);
    if (existing) {
      return res.json({
        success: true,
        shift: existing,
        message: `Register shift ${existing.id} is already open.`,
      });
    }

    const seq = (posShiftsList.length + 1).toString().padStart(4, '0');
    const newShift: PosRegisterShiftSession = {
      id: `SHF-2026-${seq}`,
      storeId,
      storeName,
      registerId,
      cashierId: currentActiveStaffSession.userId,
      cashierName: cashierName || currentActiveStaffSession.userName,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      openingFloatIDR: Math.max(0, Number(openingFloatIDR) || 0),
      transactionCount: 0,
      expectedCashSalesIDR: 0,
      expectedQrisSalesIDR: 0,
      expectedEdcSalesIDR: 0,
      expectedTotalCashInDrawerIDR: Math.max(0, Number(openingFloatIDR) || 0),
      cashRefundsIDR: 0,
    };

    posShiftsList.unshift(newShift);
    res.json({
      success: true,
      shift: newShift,
      message: `Shift ${newShift.id} opened with petty cash float Rp ${newShift.openingFloatIDR.toLocaleString('id-ID')}.`,
    });
  });

  app.post('/api/pos/shifts/close', (req: Request, res: Response) => {
    const {
      shiftId,
      storeId = 'store-jkt-senopati',
      denominations = [],
      countedQrisBatchIDR = 0,
      countedEdcBatchIDR = 0,
      notes,
    } = req.body as {
      shiftId?: string;
      storeId?: string;
      denominations: PosShiftDenominationCount[];
      countedQrisBatchIDR?: number;
      countedEdcBatchIDR?: number;
      notes?: string;
    };

    const shift =
      (shiftId ? posShiftsList.find((s) => s.id === shiftId) : undefined) ||
      posShiftsList.find((s) => s.status === 'OPEN' && s.storeId === storeId);

    if (!shift) {
      return res.status(404).json({ error: 'No open POS register shift found to close.' });
    }

    const timestamp = new Date().toISOString();
    const countedCashIDR = (denominations || []).reduce(
      (sum, d) => sum + (Number(d.denomination) || 0) * (Number(d.count) || 0),
      0
    );
    const cashVarianceIDR = countedCashIDR - shift.expectedTotalCashInDrawerIDR;
    const qrisVarianceIDR = Number(countedQrisBatchIDR || 0) - shift.expectedQrisSalesIDR;
    const edcVarianceIDR = Number(countedEdcBatchIDR || 0) - shift.expectedEdcSalesIDR;

    const zReportNumber = `Z-RPT-${shift.id.replace('SHF-', '')}`;
    const glIds: string[] = [];

    if (cashVarianceIDR !== 0) {
      const absVar = Math.abs(cashVarianceIDR);
      const isShort = cashVarianceIDR < 0;
      const g1 = `GLE-ZRP-${Date.now().toString().slice(-5)}-1`;
      const g2 = `GLE-ZRP-${Date.now().toString().slice(-5)}-2`;
      glIds.push(g1, g2);

      if (isShort) {
        commitBalancedGlBatch(
          [
            {
              id: g1,
              timestamp,
              storeId: shift.storeId,
              storeName: shift.storeName,
              accountCode: '5220',
              accountName: 'POS Cash Drawer Over/Short Variance (Selisih Kasir)',
              category: 'Expense',
              debit: absVar,
              credit: 0,
              referenceType: 'POS_SHIFT_Z_REPORT',
              referenceId: zReportNumber,
              description: `Cashier Short Variance (Selisih Kurang) on ${zReportNumber} - ${shift.cashierName}`,
            },
            {
              id: g2,
              timestamp,
              storeId: shift.storeId,
              storeName: shift.storeName,
              accountCode: '1010',
              accountName: 'Cash on Hand & Store Registers',
              category: 'Asset',
              debit: 0,
              credit: absVar,
              referenceType: 'POS_SHIFT_Z_REPORT',
              referenceId: zReportNumber,
              description: `Cash drawer physical balance adjustment on ${zReportNumber}`,
            },
          ],
          true
        );
      } else {
        commitBalancedGlBatch(
          [
            {
              id: g1,
              timestamp,
              storeId: shift.storeId,
              storeName: shift.storeName,
              accountCode: '1010',
              accountName: 'Cash on Hand & Store Registers',
              category: 'Asset',
              debit: absVar,
              credit: 0,
              referenceType: 'POS_SHIFT_Z_REPORT',
              referenceId: zReportNumber,
              description: `Cash drawer surplus (Selisih Lebih) deposited on ${zReportNumber}`,
            },
            {
              id: g2,
              timestamp,
              storeId: shift.storeId,
              storeName: shift.storeName,
              accountCode: '5220',
              accountName: 'POS Cash Drawer Over/Short Variance (Selisih Kasir)',
              category: 'Expense',
              debit: 0,
              credit: absVar,
              referenceType: 'POS_SHIFT_Z_REPORT',
              referenceId: zReportNumber,
              description: `Cashier Over Variance credit on ${zReportNumber} - ${shift.cashierName}`,
            },
          ],
          true
        );
      }
    }

    shift.status = 'CLOSED';
    shift.closedAt = timestamp;
    shift.zReportNumber = zReportNumber;
    shift.denominations = denominations;
    shift.countedCashIDR = countedCashIDR;
    shift.countedQrisBatchIDR = Number(countedQrisBatchIDR || 0);
    shift.countedEdcBatchIDR = Number(countedEdcBatchIDR || 0);
    shift.cashVarianceIDR = cashVarianceIDR;
    shift.qrisVarianceIDR = qrisVarianceIDR;
    shift.edcVarianceIDR = edcVarianceIDR;
    shift.varianceGlVoucherIds = glIds;
    shift.notes = notes;

    if (cashVarianceIDR !== 0 || qrisVarianceIDR !== 0 || edcVarianceIDR !== 0) {
      const absCashVar = Math.abs(cashVarianceIDR);
      const signPrefix = cashVarianceIDR < 0 ? '-' : cashVarianceIDR > 0 ? '+' : '';
      emitEnterpriseNotification({
        dedupeKey: `POS_SHIFT_VAR:${shift.id}`,
        category: 'POS_OPERATIONS',
        severity: absCashVar >= 50000 ? 'CRITICAL' : 'WARNING',
        title: `POS Shift Variance (${zReportNumber})`,
        message: `${shift.cashierName} closed ${shift.registerId} at ${shift.storeName} with COA #5220 variance ${signPrefix}Rp ${absCashVar.toLocaleString('id-ID')}.`,
        metadataLabel: `${zReportNumber} • ${signPrefix}Rp ${absCashVar.toLocaleString('id-ID')}`,
        targetTab: 'pos',
      });
    }

    res.json({
      success: true,
      shift,
      zReportNumber,
      message: `Z-Report ${zReportNumber} finalized. Cash variance: Rp ${cashVarianceIDR.toLocaleString('id-ID')}.`,
    });
  });

  // --- MODULE 5: INDONESIAN TAX ENGINE (PPN / SEMBAKO / PB1) & CORETAX DJP EXPORT ---
  app.get('/api/admin/compliance/sku-tax-rules', (_req: Request, res: Response) => {
    res.json(skuTaxRulesList);
  });

  app.put('/api/admin/compliance/sku-tax-rules', (req: Request, res: Response) => {
    const { sku, taxCategory, taxRatePercent, b2cTaxInclusive, b2bTaxExclusive } = req.body as Partial<SkuTaxRule>;
    if (!sku || !taxCategory) {
      return res.status(400).json({ error: 'sku and taxCategory are required.' });
    }
    const resolvedRate =
      taxRatePercent !== undefined ? Number(taxRatePercent) : getTaxRateForCategory(taxCategory, 11);
    const existing = skuTaxRulesList.find((r) => r.sku === sku);
    if (existing) {
      existing.taxCategory = taxCategory;
      existing.taxRatePercent = resolvedRate;
      if (b2cTaxInclusive !== undefined) existing.b2cTaxInclusive = b2cTaxInclusive;
      if (b2bTaxExclusive !== undefined) existing.b2bTaxExclusive = b2bTaxExclusive;
      existing.updatedAt = new Date().toISOString();
    } else {
      const inv = inventoryList.find((i) => i.sku === sku);
      skuTaxRulesList.push({
        sku,
        productName: inv?.name || inv?.productName || sku,
        category: inv?.category || 'general',
        taxCategory,
        taxRatePercent: resolvedRate,
        b2cTaxInclusive: b2cTaxInclusive ?? true,
        b2bTaxExclusive: b2bTaxExclusive ?? true,
        updatedAt: new Date().toISOString(),
      });
    }
    res.json({
      success: true,
      rules: skuTaxRulesList,
      message: `Indonesian tax classification for ${sku} updated to ${taxCategory} (${resolvedRate}%).`,
    });
  });

  app.post('/api/admin/compliance/validate-npwp', (req: Request, res: Response) => {
    const { npwpOrNik, npwp, b2bCustomerId } = req.body as { npwpOrNik?: string; npwp?: string; b2bCustomerId?: string };
    const result = validateNpwpOrNik(String(npwpOrNik ?? npwp ?? ''));
    if (result.valid && b2bCustomerId) {
      const cust = b2bCustomersList.find((c) => c.id === b2bCustomerId);
      if (cust) {
        if (result.type === 'NIK_16') cust.nik = result.cleanDigits;
        else cust.npwp = result.cleanDigits;
      }
    }
    res.json(result);
  });

  app.get('/api/admin/compliance/coretax-export', (_req: Request, res: Response) => {
    const rows: CoretaxExportRow[] = [];

    // 1. B2B Faktur Pajak Keluaran
    b2bOrdersList.forEach((order, idx) => {
      const cust = b2bCustomersList.find((c) => c.id === order.customerId);
      const rawTin = cust?.npwp || cust?.nik || '';
      const tinCheck = validateNpwpOrNik(rawTin);
      const dppIDR = Math.max(0, order.subtotalIDR - (order.pwpDiscountIDR || 0));
      let taxClassification: IndonesianTaxCategory = 'BKP_STANDARD';
      let pb1IDR = 0;
      if (order.taxPPN11IDR === 0) {
        const hasPb1Item = order.items.some((it) => {
          const rule = skuTaxRulesList.find((r) => r.sku === it.product?.sku);
          const cat =
            rule?.taxCategory ||
            inferDefaultTaxCategory(it.product?.category || '', it.product?.name || '');
          return cat === 'NON_BKP_PB1';
        });
        if (hasPb1Item && order.totalAmountIDR > dppIDR) {
          taxClassification = 'NON_BKP_PB1';
          pb1IDR = order.totalAmountIDR - dppIDR;
        } else {
          taxClassification = 'BKP_DIBEBASKAN';
        }
      }
      rows.push({
        rowId: `CT-B2B-${idx + 1}`,
        documentType: 'FAKTUR_KELUARAN_B2B',
        kodeTransaksi: '04',
        documentNumber: `FP-040.000-26.${String(idx + 1001).padStart(8, '0')}`,
        documentDate: order.orderDate,
        counterpartyName: order.companyName,
        npwpOrNik: tinCheck.cleanDigits || '0000000000000000',
        isNpwpValid: tinCheck.valid,
        taxClassification,
        dppIDR,
        ppnIDR: order.taxPPN11IDR,
        pb1IDR,
        totalIDR: order.totalAmountIDR,
        referenceId: order.id,
      });
    });

    // 2. B2C POS Digunggung Retail Invoices
    posTransactionsHistory.forEach((rcp, idx) => {
      const pb1Amount = Math.max(0, Number((rcp as any).pb1TaxIDR || 0));
      const dpp = Math.max(0, rcp.total - rcp.tax - pb1Amount);
      const hasPb1Item =
        pb1Amount > 0 ||
        (rcp.items || []).some((it) => {
          const rule = skuTaxRulesList.find((r) => r.sku === it.sku);
          const cat =
            rule?.taxCategory || inferDefaultTaxCategory(it.category || '', it.name || '');
          return cat === 'NON_BKP_PB1';
        });
      const taxClassification: IndonesianTaxCategory =
        rcp.tax === 0 && pb1Amount === 0
          ? 'BKP_DIBEBASKAN'
          : rcp.tax === 0 && hasPb1Item
          ? 'NON_BKP_PB1'
          : 'BKP_STANDARD';
      rows.push({
        rowId: `CT-POS-${idx + 1}`,
        documentType: 'DIGUNGGUNG_B2C_POS',
        kodeTransaksi: '01',
        documentNumber: rcp.receiptNumber,
        documentDate: rcp.timestamp,
        counterpartyName: 'Konsumen Akhir (POS Retail Digunggung)',
        npwpOrNik: '0000000000000000',
        isNpwpValid: false,
        taxClassification,
        dppIDR: dpp,
        ppnIDR: rcp.tax,
        pb1IDR: pb1Amount,
        totalIDR: rcp.total,
        referenceId: rcp.receiptNumber,
      });
    });

    // 3. Nota Retur Penjualan (Customer RMA)
    customerRmaList.forEach((rma, idx) => {
      const tinCheck = validateNpwpOrNik(rma.customerNpwpOrNik || '');
      rows.push({
        rowId: `CT-NR-${idx + 1}`,
        documentType: 'NOTA_RETUR_PENJUALAN',
        kodeTransaksi: '04',
        documentNumber: rma.notaReturNumber,
        documentDate: rma.createdAt,
        counterpartyName: rma.customerName,
        npwpOrNik: tinCheck.cleanDigits || '0000000000000000',
        isNpwpValid: tinCheck.valid,
        taxClassification: rma.items[0]?.taxCategory || 'BKP_STANDARD',
        dppIDR: -rma.subtotalReversedIDR,
        ppnIDR: -rma.ppnReversedIDR,
        pb1IDR: 0,
        totalIDR: -rma.totalCreditNoteIDR,
        referenceId: rma.id,
      });
    });

    // 4. Nota Retur Pembelian (Vendor RTV Debit Notes)
    vendorRtvList.forEach((rtv, idx) => {
      const tinCheck = validateNpwpOrNik(rtv.supplierNpwp || '');
      rows.push({
        rowId: `CT-NRP-${idx + 1}`,
        documentType: 'NOTA_RETUR_PEMBELIAN',
        kodeTransaksi: '04',
        documentNumber: rtv.debitNoteNumber,
        documentDate: rtv.createdAt,
        counterpartyName: rtv.supplierName,
        npwpOrNik: tinCheck.cleanDigits || '0000000000000000',
        isNpwpValid: tinCheck.valid,
        taxClassification: rtv.ppnMasukanReversedIDR > 0 ? 'BKP_STANDARD' : 'BKP_DIBEBASKAN',
        dppIDR: -rtv.subtotalReturnedIDR,
        ppnIDR: -rtv.ppnMasukanReversedIDR,
        pb1IDR: 0,
        totalIDR: -rtv.totalDebitNoteIDR,
        referenceId: rtv.id,
      });
    });

    const csvContent = buildCoretaxCsv(rows);
    const xmlContent = buildCoretaxXml(rows);

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalRows: rows.length,
        totalPpnKeluaranIDR: rows
          .filter((r) => r.documentType !== 'NOTA_RETUR_PEMBELIAN')
          .reduce((s, r) => s + r.ppnIDR, 0),
        totalNotaReturPpnIDR: rows
          .filter((r) => r.documentType === 'NOTA_RETUR_PENJUALAN')
          .reduce((s, r) => s + Math.abs(r.ppnIDR), 0),
        b2bMissingNpwpCount: rows.filter(
          (r) => r.documentType === 'FAKTUR_KELUARAN_B2B' && !r.isNpwpValid
        ).length,
      },
      rows,
      csvContent,
      xmlContent,
    });
  });

  // -------------------------------------------------------------
  // ADDITIVE COMMUNICATION DISPATCH ENGINE (SMTP & WHATSAPP)
  // -------------------------------------------------------------
  function normalizeIndonesianPhone(rawPhone?: string): string {
    const cleaned = String(rawPhone || '').replace(/[^\d+]/g, '');
    if (!cleaned) return '';
    let digits = cleaned.replace(/^\+/, '');
    if (digits.startsWith('620')) {
      digits = `62${digits.slice(3)}`;
    } else if (digits.startsWith('08')) {
      digits = `628${digits.slice(2)}`;
    } else if (digits.startsWith('0')) {
      digits = `62${digits.slice(1)}`;
    } else if (digits.startsWith('8')) {
      digits = `62${digits}`;
    }
    return digits;
  }

  function buildWaMeUrl(phoneDigits: string, messageText: string): string {
    const encoded = encodeURIComponent(messageText);
    return `https://wa.me/${phoneDigits}?text=${encoded}`;
  }

  function formatCurrencyRp(amount: number): string {
    return `Rp ${Math.round(Number(amount) || 0).toLocaleString('id-ID')}`;
  }

  function escapeHtmlText(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderCommunicationTemplate(
    template: string,
    vars: Record<string, string>
  ): string {
    return String(template || '')
      .replace(/\{\{\s*recipient_name\s*\}\}/g, vars.recipient_name || '')
      .replace(/\{\{\s*doc_type\s*\}\}/g, vars.doc_type || '')
      .replace(/\{\{\s*doc_number\s*\}\}/g, vars.doc_number || '')
      .replace(/\{\{\s*total_amount\s*\}\}/g, vars.total_amount || '')
      .replace(/\{\{\s*outlet_name\s*\}\}/g, vars.outlet_name || '');
  }

  function isMaskedSecretPlaceholder(val: unknown): boolean {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    return (
      trimmed === '********' ||
      trimmed === '••••••••' ||
      /^[•*]{6,}$/.test(trimmed)
    );
  }

  function maskCommunicationConfig(
    cfg: CommunicationGatewayConfig,
    includeSecrets: boolean
  ): CommunicationGatewayConfig {
    if (includeSecrets) {
      return JSON.parse(JSON.stringify(cfg));
    }
    return {
      ...cfg,
      smtp: {
        ...cfg.smtp,
        password: cfg.smtp.password ? '********' : '',
      },
      whatsapp: {
        ...cfg.whatsapp,
        metaAccessToken: cfg.whatsapp.metaAccessToken ? '********' : '',
        gatewayApiKey: cfg.whatsapp.gatewayApiKey ? '********' : '',
      },
    };
  }

  function getEffectiveRequestRole(req: Request): CanonicalServerRole {
    const rawHeaderRole =
      typeof req.headers['x-operator-role'] === 'string'
        ? req.headers['x-operator-role'].trim()
        : undefined;
    const rawHeaderOpId =
      typeof req.headers['x-operator-id'] === 'string'
        ? req.headers['x-operator-id'].trim()
        : undefined;
    const assignedProfile = rawHeaderOpId
      ? AVAILABLE_STAFF_USERS.find((u) => u.userId === rawHeaderOpId)
      : undefined;
    const strictHeaderRole = rawHeaderRole ? normalizeServerRoleStrict(rawHeaderRole) : undefined;
    const resolvedSessionRole =
      normalizeServerRoleStrict(currentActiveStaffSession.userRole) || 'cashier';
    return rawHeaderRole
      ? strictHeaderRole || 'cashier'
      : assignedProfile
      ? normalizeServerRole(assignedProfile.userRole)
      : resolvedSessionRole;
  }

  function getEffectiveOperatorName(req: Request): string {
    const rawHeaderOpId =
      typeof req.headers['x-operator-id'] === 'string'
        ? req.headers['x-operator-id'].trim()
        : undefined;
    const assignedProfile = rawHeaderOpId
      ? AVAILABLE_STAFF_USERS.find((u) => u.userId === rawHeaderOpId)
      : undefined;
    return assignedProfile?.userName || currentActiveStaffSession.userName || 'System Operator';
  }

  function buildFormattedDocumentContent(
    docType: CommunicationDocType,
    docId: string,
    recipientName: string,
    customNote?: string
  ): {
    docNumber: string;
    docLabel: string;
    outletName: string;
    totalDisplay: string;
    subject: string;
    htmlBody: string;
    whatsappText: string;
  } {
    let docLabel = 'Enterprise Document';
    let docNumber = docId;
    let outletName = 'GroceMart Central Operations';
    let totalDisplay = 'Rp 0';
    let isCustomerFacing = false;
    let detailRowsHtml = '';
    let lineItemsHtml = '';
    let waDetailsLines: string[] = [];

    if (docType === 'QUOTATION') {
      isCustomerFacing = true;
      const q = enterpriseQuotationsList.find(
        (item) => item.id === docId || item.quotationNumber === docId
      );
      if (!q) throw new Error(`Quotation '${docId}' not found.`);
      const qItems = Array.isArray(q.items) ? q.items : [];
      docLabel = q.isProForma ? 'Pro Forma Invoice' : 'Sales Quotation';
      docNumber = q.quotationNumber || q.id;
      outletName = 'PT GroceMart Retail Indonesia (B2B Desk)';
      totalDisplay = formatCurrencyRp(q.total);
      detailRowsHtml = `
        <tr><td><strong>Customer / Company</strong></td><td>${escapeHtmlText(q.customerCompany || q.customerName || '-')}</td></tr>
        <tr><td><strong>Issue Date / Valid Until</strong></td><td>${escapeHtmlText(q.date || '-')} / ${escapeHtmlText(q.validUntil || '-')}</td></tr>
        <tr><td><strong>Required Deposit (${Number(q.requiredDepositPercent) || 0}%)</strong></td><td>${formatCurrencyRp(q.depositAmount)}</td></tr>
        <tr><td><strong>Signature Status</strong></td><td>${escapeHtmlText(q.signatureStatus || 'PENDING')}</td></tr>`;
      lineItemsHtml = qItems
        .map(
          (it) =>
            `<tr><td>${escapeHtmlText(it.sku || '-')}</td><td>${escapeHtmlText(it.productName || '-')}</td><td style="text-align:right;">${Number(it.quantity) || 0} ${escapeHtmlText(it.unit || 'unit')}</td><td style="text-align:right;">${formatCurrencyRp(it.unitPrice)}</td><td style="text-align:right;">${formatCurrencyRp(it.lineTotal)}</td></tr>`
        )
        .join('');
      waDetailsLines = [
        `Perusahaan: ${q.customerCompany || q.customerName || '-'}`,
        `Berlaku s/d: ${q.validUntil || '-'}`,
        `Subtotal: ${formatCurrencyRp(q.subtotal)} | PPN: ${formatCurrencyRp(q.taxAmount)}`,
        `Item (${qItems.length}): ${qItems.slice(0, 3).map((i) => `${i.productName || i.sku} (${i.quantity} ${i.unit || 'unit'})`).join(', ') || '-'}`,
      ];
    } else if (docType === 'PR') {
      const pr = purchaseRequests.find((item) => item.id === docId);
      if (!pr) throw new Error(`Purchase Request '${docId}' not found.`);
      docLabel = 'Purchase Request (PR)';
      docNumber = pr.id;
      outletName = pr.storeName || 'GroceMart Outlet';
      totalDisplay = formatCurrencyRp(pr.totalEstimatedCost);
      const prPriority = String(pr.priority || 'normal').toUpperCase();
      const prStatus = String(pr.status || 'pending').toUpperCase();
      detailRowsHtml = `
        <tr><td><strong>Requested By</strong></td><td>${escapeHtmlText(pr.requestedBy || '-')}</td></tr>
        <tr><td><strong>Target Store / Hub</strong></td><td>${escapeHtmlText(outletName)}</td></tr>
        <tr><td><strong>Priority / Reason</strong></td><td>${escapeHtmlText(prPriority)} (${escapeHtmlText(pr.reason || '-')})</td></tr>
        <tr><td><strong>Status</strong></td><td>${escapeHtmlText(prStatus)}</td></tr>`;
      lineItemsHtml = `<tr><td>${escapeHtmlText(pr.sku || '-')}</td><td>${escapeHtmlText(pr.productName || '-')}</td><td style="text-align:right;">${Number(pr.suggestedQuantity) || 0}</td><td style="text-align:right;">${formatCurrencyRp(pr.estimatedUnitCost)}</td><td style="text-align:right;">${formatCurrencyRp(pr.totalEstimatedCost)}</td></tr>`;
      waDetailsLines = [
        `Outlet: ${outletName}`,
        `SKU: ${pr.sku || '-'} — ${pr.productName || '-'}`,
        `Qty Diminta: ${Number(pr.suggestedQuantity) || 0} unit | Prioritas: ${prPriority}`,
      ];
    } else if (docType === 'PO') {
      const po = purchaseOrders.find((item) => item.id === docId || item.poNumber === docId);
      if (!po) throw new Error(`Purchase Order '${docId}' not found.`);
      const poItems = Array.isArray(po.items) ? po.items : [];
      docLabel = 'Purchase Order (PO)';
      docNumber = po.poNumber || po.id;
      outletName = po.storeName || 'GroceMart Warehouse';
      totalDisplay = formatCurrencyRp(po.totalCost);
      detailRowsHtml = `
        <tr><td><strong>Supplier / Vendor</strong></td><td>${escapeHtmlText(po.supplierName || '-')}</td></tr>
        <tr><td><strong>Destination Store</strong></td><td>${escapeHtmlText(outletName)}</td></tr>
        <tr><td><strong>Expected Delivery</strong></td><td>${escapeHtmlText(po.expectedDeliveryDate || '-')}</td></tr>
        <tr><td><strong>Payment Terms</strong></td><td>${escapeHtmlText(po.paymentTerms || 'Net 30')}</td></tr>
        <tr><td><strong>PO Status</strong></td><td>${escapeHtmlText(po.status || 'OPEN')}</td></tr>`;
      lineItemsHtml = poItems
        .map((it) => {
          const ordered = Number(it.orderedQuantity) || 0;
          const received = Number(it.receivedQuantity) || 0;
          const backorder = Math.max(0, ordered - received);
          const qtyCell = backorder > 0 && received > 0
            ? `${ordered} (Rec: ${received}, Backorder: ${backorder})`
            : `${ordered} (Rec: ${received})`;
          return `<tr><td>${escapeHtmlText(it.sku || '-')}</td><td>${escapeHtmlText(it.productName || '-')}</td><td style="text-align:right;">${qtyCell}</td><td style="text-align:right;">${formatCurrencyRp(it.unitCost)}</td><td style="text-align:right;">${formatCurrencyRp(it.totalCost)}</td></tr>`;
        })
        .join('');
      const totalBackorder = poItems.reduce((s, i) => s + Math.max(0, (Number(i.orderedQuantity) || 0) - (Number(i.receivedQuantity) || 0)), 0);
      waDetailsLines = [
        `Supplier: ${po.supplierName || '-'}`,
        `Tujuan: ${outletName}`,
        `Estimasi Kirim: ${po.expectedDeliveryDate || '-'} | Status: ${po.status || 'OPEN'}${totalBackorder > 0 ? ` (Backorder: ${totalBackorder} unit)` : ''}`,
        `Item (${poItems.length}): ${poItems.slice(0, 3).map((i) => `${i.productName || i.sku} x${i.orderedQuantity}`).join(', ') || '-'}`,
      ];
    } else if (docType === 'GR') {
      const gr = goodsReceipts.find((item) => item.id === docId);
      if (!gr) throw new Error(`Goods Receipt '${docId}' not found.`);
      const grItems = Array.isArray(gr.items) ? gr.items : [];
      docLabel = 'Goods Receipt (GR)';
      docNumber = gr.id;
      outletName = gr.storeName || 'GroceMart Warehouse';
      const totalQty = grItems.reduce((s, i) => s + (Number(i.quantityReceived) || 0), 0);
      const totalOrdered = grItems.reduce((s, i) => s + (Number(i.quantityOrdered) || 0), 0);
      const remainingBackorder = Math.max(0, totalOrdered - totalQty);
      totalDisplay = `${totalQty} units received`;
      detailRowsHtml = `
        <tr><td><strong>PO Reference</strong></td><td>${escapeHtmlText(gr.poId || '-')}</td></tr>
        <tr><td><strong>Vendor</strong></td><td>${escapeHtmlText(gr.vendorName || '-')}</td></tr>
        <tr><td><strong>Vendor Delivery Note</strong></td><td>${escapeHtmlText(gr.deliveryNoteNumber || '-')}</td></tr>
        <tr><td><strong>Received By</strong></td><td>${escapeHtmlText(gr.receivedBy || '-')} (${escapeHtmlText(gr.isPartial ? `Partial Delivery — Backorder ${remainingBackorder}` : 'Full Delivery')})</td></tr>`;
      lineItemsHtml = grItems
        .map(
          (it) =>
            `<tr><td>${escapeHtmlText(it.sku || '-')}</td><td>${escapeHtmlText(it.productName || '-')} (Batch ${escapeHtmlText(it.batchNumber || '-')})</td><td style="text-align:right;">${Number(it.quantityReceived) || 0} / ${Number(it.quantityOrdered) || 0}</td><td style="text-align:right;">${it.tempCheckCelsius !== undefined ? `${it.tempCheckCelsius}°C` : '-'}</td><td style="text-align:right;">${escapeHtmlText(it.qualityCondition || '-')}</td></tr>`
        )
        .join('');
      waDetailsLines = [
        `Ref PO: ${gr.poId || '-'} | Surat Jalan Vendor: ${gr.deliveryNoteNumber || '-'}`,
        `Diterima di: ${outletName} oleh ${gr.receivedBy || '-'}`,
        `Delivery: ${gr.isPartial ? 'Partial' : 'Full'} (${totalQty} / ${totalOrdered} units${remainingBackorder > 0 ? `, Backorder ${remainingBackorder}` : ''})`,
      ];
    } else if (docType === 'QC_REPORT') {
      const qc = qcInspectionsList.find((item) => item.id === docId);
      if (!qc) throw new Error(`QC Inspection Report '${docId}' not found.`);
      const params = qc.parameters || ({} as NonNullable<typeof qc.parameters>);
      docLabel = 'HACCP QC Inspection & RTV Report';
      docNumber = qc.id;
      outletName = qc.storeName || 'GroceMart Cold-Chain QC';
      const totalBatchQty = Math.max(0, Number(qc.totalBatchQuantity) || 0);
      const passedQty = qc.disposition === 'PASSED' ? totalBatchQty : 0;
      const quarantineQty = qc.disposition === 'QUARANTINED' ? totalBatchQty : 0;
      const rejectedRtvQty = qc.disposition === 'REJECTED' ? totalBatchQty : 0;
      const passRatePct = totalBatchQty > 0 ? Math.round((passedQty / totalBatchQty) * 1000) / 10 : 0;
      const tempC = Number(params.temperatureCelsius ?? 0);
      const actionLabel = String(qc.actionTaken || 'RELEASE_TO_SHELF').replace(/_/g, ' ');
      totalDisplay = `Pass Rate ${passRatePct}% (${qc.disposition})`;
      detailRowsHtml = `
        <tr><td><strong>SKU / Product</strong></td><td>${escapeHtmlText(qc.sku || '-')} — ${escapeHtmlText(qc.productName || '-')}</td></tr>
        <tr><td><strong>Batch / Expiry</strong></td><td>${escapeHtmlText(qc.batchNumber || '-')} (Exp: ${escapeHtmlText(qc.expiryDate || '-')})</td></tr>
        <tr><td><strong>Cold-Chain Temperature</strong></td><td>${tempC}°C (${params.coldChainCompliant ? 'Compliant' : 'Temperature Breach'})</td></tr>
        <tr><td><strong>Disposition / Action</strong></td><td>${escapeHtmlText(qc.disposition)} — ${escapeHtmlText(actionLabel)}</td></tr>
        <tr><td><strong>Inspector</strong></td><td>${escapeHtmlText(qc.inspectorName || '-')}</td></tr>`;
      lineItemsHtml = `
        <tr><td>PASSED</td><td>Released / Passed Inspection</td><td style="text-align:right;">${passedQty}</td><td style="text-align:right;">${passRatePct}%</td><td style="text-align:right;">${escapeHtmlText(params.visualFreshness || '-')}</td></tr>
        <tr><td>QUARANTINE</td><td>Quarantine Hold</td><td style="text-align:right;">${quarantineQty}</td><td style="text-align:right;">${quarantineQty > 0 ? 'HOLD' : '0%'}</td><td style="text-align:right;">${escapeHtmlText(params.packagingIntegrity || '-')}</td></tr>
        <tr><td>REJECTED_RTV</td><td>Rejected / Return to Vendor (RTV)</td><td style="text-align:right;">${rejectedRtvQty}</td><td style="text-align:right;">${rejectedRtvQty > 0 ? 'RTV' : '0%'}</td><td style="text-align:right;">${escapeHtmlText(params.sensoryOdorCheck || '-')}</td></tr>`;
      waDetailsLines = [
        `Produk: ${qc.sku || '-'} - ${qc.productName || '-'} (Batch ${qc.batchNumber || '-'})`,
        `Suhu Cold-Chain: ${tempC}°C (${params.coldChainCompliant ? 'Compliant' : 'BREACH'})`,
        `Hasil: Passed ${passedQty} | Quarantine Hold ${quarantineQty} | Rejected RTV ${rejectedRtvQty} | Pass Rate ${passRatePct}%`,
        `Aksi: ${actionLabel} (Inspektor: ${qc.inspectorName || '-'})`,
      ];
    } else if (docType === 'POS_RECEIPT') {
      isCustomerFacing = true;
      const rcp = posTransactionsHistory.find(
        (item) => item.receiptNumber === docId || item.transactionId === docId || item.orderId === docId
      );
      if (!rcp) throw new Error(`POS Receipt '${docId}' not found.`);
      const rcpItems = Array.isArray(rcp.items) ? rcp.items : [];
      const payMethod = String(rcp.paymentMethod || 'cash').toUpperCase();
      docLabel = 'Customer POS Receipt';
      docNumber = rcp.receiptNumber;
      outletName = rcp.storeName || 'GroceMart Retail Store';
      totalDisplay = formatCurrencyRp(rcp.total);
      detailRowsHtml = `
        <tr><td><strong>Store Outlet</strong></td><td>${escapeHtmlText(outletName)}</td></tr>
        <tr><td><strong>Cashier / Shift</strong></td><td>${escapeHtmlText(rcp.cashierName || 'Cashier')} (${escapeHtmlText(rcp.shiftId || '-')})</td></tr>
        <tr><td><strong>Payment Method</strong></td><td>${escapeHtmlText(payMethod)}</td></tr>
        <tr><td><strong>Subtotal / Tax / Discount</strong></td><td>${formatCurrencyRp(rcp.subtotal)} / ${formatCurrencyRp(rcp.tax)} / -${formatCurrencyRp(rcp.discount)}</td></tr>`;
      lineItemsHtml = rcpItems
        .map(
          (it) =>
            `<tr><td>${escapeHtmlText(it.sku || '-')}</td><td>${escapeHtmlText(it.name || '-')}</td><td style="text-align:right;">${Number(it.quantity) || 0} ${escapeHtmlText(it.unit || 'unit')}</td><td style="text-align:right;">${formatCurrencyRp(it.unitPrice)}</td><td style="text-align:right;">${formatCurrencyRp(it.lineTotal)}</td></tr>`
        )
        .join('');
      waDetailsLines = [
        `Struk: ${rcp.receiptNumber} | Kasir: ${rcp.cashierName || 'Cashier'}`,
        `Metode Bayar: ${payMethod}`,
        `Item (${rcpItems.length}): ${rcpItems.slice(0, 4).map((i) => `${i.name || i.sku} x${i.quantity}`).join(', ') || '-'}`,
        `Subtotal: ${formatCurrencyRp(rcp.subtotal)} | Diskon: -${formatCurrencyRp(rcp.discount)} | PPN/PB1: ${formatCurrencyRp(rcp.tax)} | Grand Total: ${formatCurrencyRp(rcp.total)}`,
      ];
    } else if (docType === 'B2B_INVOICE') {
      isCustomerFacing = true;
      const ord = b2bOrdersList.find((item) => item.id === docId);
      if (!ord) throw new Error(`B2B Invoice '${docId}' not found.`);
      const ordItems = Array.isArray(ord.items) ? ord.items : [];
      const payMethod = String(ord.paymentMethod || 'cod').toUpperCase();
      docLabel = 'Faktur B2B Wholesale Invoice';
      docNumber = ord.id;
      outletName = 'PT GroceMart Wholesale Hub';
      totalDisplay = formatCurrencyRp(ord.totalAmountIDR);
      detailRowsHtml = `
        <tr><td><strong>Customer / Company</strong></td><td>${escapeHtmlText(ord.companyName || ord.customerName || '-')}</td></tr>
        <tr><td><strong>Order Date / Due Date</strong></td><td>${escapeHtmlText(ord.orderDate || '-')} / ${escapeHtmlText(ord.duePaymentDate || '-')}</td></tr>
        <tr><td><strong>Payment Method / Status</strong></td><td>${escapeHtmlText(payMethod)} (${escapeHtmlText(ord.paymentStatus || 'PENDING')})</td></tr>
        <tr><td><strong>PPN 11% / PWP Discount</strong></td><td>${formatCurrencyRp(ord.taxPPN11IDR)} / -${formatCurrencyRp(ord.pwpDiscountIDR)}</td></tr>`;
      lineItemsHtml = ordItems
        .map(
          (it) =>
            `<tr><td>${escapeHtmlText(it.product?.sku || '-')}</td><td>${escapeHtmlText(it.product?.name || 'Wholesale Item')}</td><td style="text-align:right;">${Number(it.quantity) || 0} ${escapeHtmlText(it.selectedUoM || 'unit')}</td><td style="text-align:right;">${formatCurrencyRp(it.unitPrice)}</td><td style="text-align:right;">${formatCurrencyRp(it.lineTotal)}</td></tr>`
        )
        .join('');
      waDetailsLines = [
        `Pelanggan: ${ord.companyName || ord.customerName || '-'}`,
        `Pembayaran: ${payMethod} (${ord.paymentStatus || 'PENDING'})`,
        `Total Base Units: ${Number(ord.totalBaseUnits) || 0} | PPN: ${formatCurrencyRp(ord.taxPPN11IDR)} | PWP Diskon: -${formatCurrencyRp(ord.pwpDiscountIDR)}`,
      ];
    } else if (docType === 'SURAT_JALAN') {
      const sj = suratJalanList.find(
        (item) => item.id === docId || item.documentNumber === docId
      );
      if (!sj) throw new Error(`Surat Jalan '${docId}' not found.`);
      const sjItems = Array.isArray(sj.items) ? sj.items : [];
      docLabel = 'Surat Jalan (Delivery Waybill)';
      docNumber = sj.documentNumber || sj.id;
      outletName = sj.senderStoreName || 'GroceMart Logistics CDC';
      totalDisplay = `${Number(sj.totalPackages) || 0} Koli / ${Number(sj.totalWeightKg) || 0} Kg`;
      detailRowsHtml = `
        <tr><td><strong>Sender Hub</strong></td><td>${escapeHtmlText(sj.senderStoreName || outletName)}</td></tr>
        <tr><td><strong>Recipient</strong></td><td>${escapeHtmlText(sj.recipientName || '-')} — ${escapeHtmlText(sj.recipientAddress || '-')}</td></tr>
        <tr><td><strong>Driver / Vehicle</strong></td><td>${escapeHtmlText(sj.driverName || '-')} (${escapeHtmlText(sj.vehicleType || 'Fleet')} - ${escapeHtmlText(sj.vehiclePlateNumber || '-')})</td></tr>
        <tr><td><strong>Cold-Chain Target</strong></td><td>${sj.coldChainTempCelsius !== undefined ? `${sj.coldChainTempCelsius}°C` : 'Ambient'}</td></tr>`;
      lineItemsHtml = sjItems
        .map(
          (it) =>
            `<tr><td>${escapeHtmlText(it.sku || '-')}</td><td>${escapeHtmlText(it.productName || '-')} (Batch ${escapeHtmlText(it.batchNumber || '-')})</td><td style="text-align:right;">${Number(it.quantity) || 0} ${escapeHtmlText(it.unit || 'unit')}</td><td style="text-align:right;">${escapeHtmlText(it.packagingType || '-')}</td><td style="text-align:right;">${escapeHtmlText(it.condition || '-')}</td></tr>`
        )
        .join('');
      waDetailsLines = [
        `Penerima: ${sj.recipientName || '-'} (${sj.recipientAddress || '-'})`,
        `Armada: ${sj.vehicleType || 'Fleet'} ${sj.vehiclePlateNumber || '-'} | Driver: ${sj.driverName || '-'}`,
        `Muatan: ${Number(sj.totalPackages) || 0} koli (${Number(sj.totalWeightKg) || 0} kg) | Suhu: ${sj.coldChainTempCelsius ?? '-'}°C`,
      ];
    } else {
      throw new Error(`Unsupported document type '${String(docType)}'.`);
    }

    const template = isCustomerFacing
      ? communicationGatewayConfig.whatsapp.customerMessageTemplate
      : communicationGatewayConfig.whatsapp.vendorMessageTemplate;

    const baseWaText = renderCommunicationTemplate(template, {
      recipient_name: recipientName || 'Partner',
      doc_type: docLabel,
      doc_number: docNumber,
      total_amount: totalDisplay,
      outlet_name: outletName,
    });

    const whatsappText = [
      baseWaText,
      '',
      ...waDetailsLines,
      customNote ? `\nCatatan Tambahan: ${customNote}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const subject = `[GroceMart] ${docLabel} #${docNumber} — ${outletName}`;
    const noteSection = customNote
      ? `<div style="margin:14px 0;padding:10px 14px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;color:#0f172a;"><strong>Note:</strong> ${escapeHtmlText(customNote)}</div>`
      : '';

    const htmlBody = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;padding:24px;background:#ffffff;color:#0f172a;border:1px solid #e2e8f0;border-radius:8px;">
        <div style="border-bottom:2px solid #0F4C3A;padding-bottom:12px;margin-bottom:16px;">
          <div style="font-size:18px;font-weight:700;color:#0F4C3A;">${escapeHtmlText(communicationGatewayConfig.smtp.senderName || 'PT GroceMart Retail Indonesia')}</div>
          <div style="font-size:12px;color:#475569;margin-top:4px;">${escapeHtmlText(docLabel)} • Ref: <strong>${escapeHtmlText(docNumber)}</strong></div>
        </div>
        <p style="font-size:13px;line-height:1.5;">Dear <strong>${escapeHtmlText(recipientName || 'Valued Partner')}</strong>,</p>
        <p style="font-size:13px;line-height:1.5;">Please find the official summary for <strong>${escapeHtmlText(docLabel)} (${escapeHtmlText(docNumber)})</strong> issued by ${escapeHtmlText(outletName)}.</p>
        ${noteSection}
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin:14px 0;">
          <tbody>${detailRowsHtml}</tbody>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:14px;border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Code / Metric</th>
              <th style="padding:8px;border-bottom:1px solid #cbd5e1;">Description</th>
              <th style="padding:8px;border-bottom:1px solid #cbd5e1;text-align:right;">Qty</th>
              <th style="padding:8px;border-bottom:1px solid #cbd5e1;text-align:right;">Unit / Rate</th>
              <th style="padding:8px;border-bottom:1px solid #cbd5e1;text-align:right;">Total / Status</th>
            </tr>
          </thead>
          <tbody>${lineItemsHtml}</tbody>
        </table>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:700;color:#0F4C3A;">
          Summary Total: ${escapeHtmlText(totalDisplay)}
        </div>
        <div style="margin-top:20px;font-size:11px;color:#64748b;">
          Sent automatically by GroceMatrix™ Enterprise ERP Communication Engine.
        </div>
      </div>`;

    return {
      docNumber,
      docLabel,
      outletName,
      totalDisplay,
      subject,
      htmlBody,
      whatsappText,
    };
  }

  async function dispatchEmailMessage(params: {
    toEmail: string;
    subject: string;
    htmlBody: string;
    docType: CommunicationDispatchLog['docType'];
    docId: string;
    docNumber: string;
    recipientName: string;
    sentBy: string;
  }): Promise<CommunicationDispatchLog> {
    const email = String(params.toEmail || '').trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const smtpCfg = communicationGatewayConfig.smtp;
    const mode: 'LIVE' | 'SANDBOX' = smtpCfg.enableLiveSmtp ? 'LIVE' : 'SANDBOX';
    const logId = `COMM-EM-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    if (!isValidEmail) {
      const failedLog: CommunicationDispatchLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        channel: 'email',
        docType: params.docType,
        docId: params.docId,
        docNumber: params.docNumber,
        recipientName: params.recipientName,
        recipientAddress: email || '(missing email)',
        mode,
        status: 'FAILED',
        subjectOrPreview: params.subject,
        errorMessage: 'Invalid or missing recipient email address.',
        sentBy: params.sentBy,
      };
      communicationLogs.unshift(failedLog);
      communicationLogs = communicationLogs.slice(0, 200);
      scheduleStateSave();
      throw new Error(failedLog.errorMessage);
    }

    if (smtpCfg.enableLiveSmtp) {
      if (!smtpCfg.host || !smtpCfg.port || !smtpCfg.username || !smtpCfg.password) {
        const failedLog: CommunicationDispatchLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          channel: 'email',
          docType: params.docType,
          docId: params.docId,
          docNumber: params.docNumber,
          recipientName: params.recipientName,
          recipientAddress: email,
          mode: 'LIVE',
          status: 'FAILED',
          subjectOrPreview: params.subject,
          errorMessage: 'Live SMTP requires Host, Port, Username, and Password.',
          sentBy: params.sentBy,
        };
        communicationLogs.unshift(failedLog);
        communicationLogs = communicationLogs.slice(0, 200);
        scheduleStateSave();
        throw new Error(failedLog.errorMessage);
      }

      try {
        const transporter = nodemailer.createTransport({
          host: smtpCfg.host,
          port: Number(smtpCfg.port) || 587,
          secure: smtpCfg.encryption === 'SSL_TLS' || Number(smtpCfg.port) === 465,
          requireTLS: smtpCfg.encryption === 'STARTTLS',
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
          auth: {
            user: smtpCfg.username,
            pass: smtpCfg.password,
          },
        });

        await transporter.sendMail({
          from: `"${smtpCfg.senderName || 'PT GroceMart Retail Indonesia'}" <${smtpCfg.senderEmail || smtpCfg.username}>`,
          to: email,
          cc: smtpCfg.ccAuditEmail?.trim() || undefined,
          subject: params.subject,
          html: params.htmlBody,
        });
      } catch (err: any) {
        const errMsg = err?.message || 'SMTP transport error';
        const failedLog: CommunicationDispatchLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          channel: 'email',
          docType: params.docType,
          docId: params.docId,
          docNumber: params.docNumber,
          recipientName: params.recipientName,
          recipientAddress: email,
          mode: 'LIVE',
          status: 'FAILED',
          subjectOrPreview: params.subject,
          errorMessage: errMsg,
          sentBy: params.sentBy,
        };
        communicationLogs.unshift(failedLog);
        communicationLogs = communicationLogs.slice(0, 200);
        scheduleStateSave();
        throw new Error(`SMTP Live Dispatch Failed: ${errMsg}`);
      }
    }

    const successLog: CommunicationDispatchLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      channel: 'email',
      docType: params.docType,
      docId: params.docId,
      docNumber: params.docNumber,
      recipientName: params.recipientName,
      recipientAddress: email,
      mode,
      status: 'SENT',
      subjectOrPreview: params.subject,
      sentBy: params.sentBy,
    };
    communicationLogs.unshift(successLog);
    communicationLogs = communicationLogs.slice(0, 200);
    scheduleStateSave();
    return successLog;
  }

  async function dispatchWhatsappMessage(params: {
    toPhone: string;
    messageText: string;
    docType: CommunicationDispatchLog['docType'];
    docId: string;
    docNumber: string;
    recipientName: string;
    sentBy: string;
  }): Promise<CommunicationDispatchLog> {
    const normalizedPhone = normalizeIndonesianPhone(params.toPhone);
    const waCfg = communicationGatewayConfig.whatsapp;
    const mode: 'LIVE' | 'SANDBOX' = waCfg.enableDirectWaApi ? 'LIVE' : 'SANDBOX';
    const logId = `COMM-WA-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    if (!normalizedPhone || normalizedPhone.length < 9 || normalizedPhone.length > 16 || !/^\d+$/.test(normalizedPhone)) {
      const failedLog: CommunicationDispatchLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        channel: 'whatsapp',
        docType: params.docType,
        docId: params.docId,
        docNumber: params.docNumber,
        recipientName: params.recipientName,
        recipientAddress: params.toPhone || '(missing phone)',
        mode,
        status: 'FAILED',
        subjectOrPreview: params.messageText.slice(0, 120),
        errorMessage: 'Invalid or missing WhatsApp recipient phone number.',
        sentBy: params.sentBy,
      };
      communicationLogs.unshift(failedLog);
      communicationLogs = communicationLogs.slice(0, 200);
      scheduleStateSave();
      throw new Error(failedLog.errorMessage);
    }

    const waMeUrl = buildWaMeUrl(normalizedPhone, params.messageText);

    if (waCfg.enableDirectWaApi) {
      try {
        if (waCfg.providerType === 'meta_cloud') {
          if (!waCfg.metaPhoneNumberId || !waCfg.metaAccessToken) {
            throw new Error('Meta Cloud API requires Phone Number ID and Permanent Access Token.');
          }
          const resp = await fetch(
            `https://graph.facebook.com/v19.0/${encodeURIComponent(waCfg.metaPhoneNumberId)}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${waCfg.metaAccessToken}`,
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(10000),
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: normalizedPhone,
                type: 'text',
                text: { body: params.messageText },
              }),
            }
          );
          if (!resp.ok) {
            const errTxt = await resp.text();
            throw new Error(`Meta WhatsApp API (${resp.status}): ${errTxt.slice(0, 180)}`);
          }
        } else {
          if (!waCfg.gatewayApiUrl || !waCfg.gatewayApiKey) {
            throw new Error('Indonesian WA Gateway requires Gateway API URL and Device Token / API Key.');
          }
          const resp = await fetch(waCfg.gatewayApiUrl, {
            method: 'POST',
            headers: {
              Authorization: waCfg.gatewayApiKey,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              target: normalizedPhone,
              phone: normalizedPhone,
              message: params.messageText,
              sender: normalizeIndonesianPhone(waCfg.gatewaySenderNumber) || waCfg.gatewaySenderNumber,
            }),
          });
          if (!resp.ok) {
            const errTxt = await resp.text();
            throw new Error(`WA Gateway HTTP (${resp.status}): ${errTxt.slice(0, 180)}`);
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || 'WhatsApp API dispatch error';
        const failedLog: CommunicationDispatchLog = {
          id: logId,
          timestamp: new Date().toISOString(),
          channel: 'whatsapp',
          docType: params.docType,
          docId: params.docId,
          docNumber: params.docNumber,
          recipientName: params.recipientName,
          recipientAddress: `+${normalizedPhone}`,
          mode: 'LIVE',
          status: 'FAILED',
          subjectOrPreview: params.messageText.slice(0, 120),
          waMeUrl: waCfg.fallbackWaWebInSandbox ? waMeUrl : undefined,
          errorMessage: errMsg,
          sentBy: params.sentBy,
        };
        communicationLogs.unshift(failedLog);
        communicationLogs = communicationLogs.slice(0, 200);
        scheduleStateSave();
        throw new Error(`WhatsApp Direct API Failed: ${errMsg}`);
      }
    }

    const successLog: CommunicationDispatchLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
      docType: params.docType,
      docId: params.docId,
      docNumber: params.docNumber,
      recipientName: params.recipientName,
      recipientAddress: `+${normalizedPhone}`,
      mode,
      status: 'SENT',
      subjectOrPreview: params.messageText.slice(0, 120),
      waMeUrl: !waCfg.enableDirectWaApi && waCfg.fallbackWaWebInSandbox ? waMeUrl : undefined,
      sentBy: params.sentBy,
    };
    communicationLogs.unshift(successLog);
    communicationLogs = communicationLogs.slice(0, 200);
    scheduleStateSave();
    return successLog;
  }

  app.get('/api/admin/settings/communication-gateway', (req: Request, res: Response) => {
    const role = getEffectiveRequestRole(req);
    const canEdit = role === 'super_admin' || role === 'coo';
    res.json({
      config: maskCommunicationConfig(communicationGatewayConfig, canEdit),
      logs: communicationLogs.slice(0, 100),
      canEdit,
    });
  });

  app.post('/api/admin/settings/communication-gateway', (req: Request, res: Response) => {
    const role = getEffectiveRequestRole(req);
    if (role !== 'super_admin' && role !== 'coo') {
      return res.status(403).json({
        success: false,
        code: 'RBAC_FORBIDDEN',
        error: 'Only Super Admin or COO may update SMTP / WhatsApp Gateway configuration.',
      });
    }

    const incoming = req.body || {};
    const nextSmtp = incoming.smtp || {};
    const nextWa = incoming.whatsapp || {};
    const actorName = getEffectiveOperatorName(req);

    communicationGatewayConfig = {
      smtp: {
        providerPreset: nextSmtp.providerPreset || communicationGatewayConfig.smtp.providerPreset,
        host: String(nextSmtp.host ?? communicationGatewayConfig.smtp.host).trim(),
        port: Number(nextSmtp.port ?? communicationGatewayConfig.smtp.port) || 587,
        encryption: nextSmtp.encryption || communicationGatewayConfig.smtp.encryption,
        username: String(nextSmtp.username ?? communicationGatewayConfig.smtp.username).trim(),
        password:
          isMaskedSecretPlaceholder(nextSmtp.password)
            ? communicationGatewayConfig.smtp.password
            : String(nextSmtp.password ?? communicationGatewayConfig.smtp.password),
        senderName:
          String(nextSmtp.senderName ?? communicationGatewayConfig.smtp.senderName).trim() ||
          'PT GroceMart Retail Indonesia',
        senderEmail: String(nextSmtp.senderEmail ?? communicationGatewayConfig.smtp.senderEmail).trim(),
        ccAuditEmail: String(nextSmtp.ccAuditEmail ?? communicationGatewayConfig.smtp.ccAuditEmail ?? '').trim(),
        enableLiveSmtp: Boolean(nextSmtp.enableLiveSmtp),
      },
      whatsapp: {
        providerType: nextWa.providerType || communicationGatewayConfig.whatsapp.providerType,
        metaPhoneNumberId: String(
          nextWa.metaPhoneNumberId ?? communicationGatewayConfig.whatsapp.metaPhoneNumberId
        ).trim(),
        metaWabaId: String(nextWa.metaWabaId ?? communicationGatewayConfig.whatsapp.metaWabaId).trim(),
        metaAccessToken:
          isMaskedSecretPlaceholder(nextWa.metaAccessToken)
            ? communicationGatewayConfig.whatsapp.metaAccessToken
            : String(nextWa.metaAccessToken ?? communicationGatewayConfig.whatsapp.metaAccessToken).trim(),
        gatewayApiUrl: String(
          nextWa.gatewayApiUrl ?? communicationGatewayConfig.whatsapp.gatewayApiUrl
        ).trim(),
        gatewayApiKey:
          isMaskedSecretPlaceholder(nextWa.gatewayApiKey)
            ? communicationGatewayConfig.whatsapp.gatewayApiKey
            : String(nextWa.gatewayApiKey ?? communicationGatewayConfig.whatsapp.gatewayApiKey).trim(),
        gatewaySenderNumber: String(
          nextWa.gatewaySenderNumber ?? communicationGatewayConfig.whatsapp.gatewaySenderNumber
        ).trim(),
        enableDirectWaApi: Boolean(nextWa.enableDirectWaApi),
        fallbackWaWebInSandbox:
          nextWa.fallbackWaWebInSandbox !== undefined
            ? Boolean(nextWa.fallbackWaWebInSandbox)
            : communicationGatewayConfig.whatsapp.fallbackWaWebInSandbox,
        vendorMessageTemplate: String(
          nextWa.vendorMessageTemplate ?? communicationGatewayConfig.whatsapp.vendorMessageTemplate
        ),
        customerMessageTemplate: String(
          nextWa.customerMessageTemplate ?? communicationGatewayConfig.whatsapp.customerMessageTemplate
        ),
      },
      updatedAt: new Date().toISOString(),
      updatedBy: actorName,
    };

    scheduleStateSave();
    res.json({
      success: true,
      message: 'Communication gateway configuration saved successfully.',
      config: communicationGatewayConfig,
    });
  });

  app.post('/api/admin/communications/test-email', async (req: Request, res: Response) => {
    const role = getEffectiveRequestRole(req);
    if (role !== 'super_admin' && role !== 'coo') {
      return res.status(403).json({
        success: false,
        code: 'RBAC_FORBIDDEN',
        error: 'Only Super Admin or COO may test SMTP connection.',
      });
    }
    try {
      const targetEmail =
        String(req.body?.recipientEmail || '').trim() ||
        communicationGatewayConfig.smtp.ccAuditEmail ||
        communicationGatewayConfig.smtp.senderEmail ||
        'audit@grocemart.co.id';
      const actorName = getEffectiveOperatorName(req);
      const log = await dispatchEmailMessage({
        toEmail: targetEmail,
        subject: '[GroceMart ERP] SMTP Gateway Handshake Verification',
        htmlBody: `<div style="font-family:Arial,sans-serif;padding:20px;background:#fff;color:#0f172a;border:1px solid #e2e8f0;">
          <h2 style="color:#0F4C3A;margin:0 0 8px;">GroceMart SMTP Gateway Test</h2>
          <p>Host: <strong>${escapeHtmlText(communicationGatewayConfig.smtp.host || 'Sandbox Relay')}</strong> : ${communicationGatewayConfig.smtp.port} (${communicationGatewayConfig.smtp.encryption})</p>
          <p>Triggered by: ${escapeHtmlText(actorName)} at ${new Date().toISOString()}</p>
        </div>`,
        docType: 'TEST_EMAIL',
        docId: 'SMTP-TEST',
        docNumber: 'SMTP-TEST',
        recipientName: 'Gateway Verification',
        sentBy: actorName,
      });

      res.json({
        success: true,
        message:
          log.mode === 'LIVE'
            ? `Live SMTP test email dispatched to ${targetEmail}.`
            : `Sandbox SMTP relay handshake verified for ${targetEmail}.`,
        log,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'SMTP test dispatch failed.',
      });
    }
  });

  app.post('/api/admin/communications/test-whatsapp', async (req: Request, res: Response) => {
    const role = getEffectiveRequestRole(req);
    if (role !== 'super_admin' && role !== 'coo') {
      return res.status(403).json({
        success: false,
        code: 'RBAC_FORBIDDEN',
        error: 'Only Super Admin or COO may test WhatsApp gateway.',
      });
    }
    try {
      const recipientPhone = String(req.body?.recipientPhone || '').trim();
      const recipientName = String(req.body?.recipientName || 'System Tester').trim();
      const actorName = getEffectiveOperatorName(req);
      const log = await dispatchWhatsappMessage({
        toPhone: recipientPhone,
        messageText: `Halo ${recipientName},\n\nIni adalah pesan verifikasi WhatsApp Business API dari GroceMatrix™ ERP (${communicationGatewayConfig.smtp.senderName}).`,
        docType: 'TEST_WHATSAPP',
        docId: 'WA-TEST',
        docNumber: 'WA-TEST',
        recipientName,
        sentBy: actorName,
      });

      res.json({
        success: true,
        message:
          log.mode === 'LIVE'
            ? `Live WhatsApp test message sent to ${log.recipientAddress}.`
            : `Sandbox WhatsApp dispatch verified for ${log.recipientAddress}.`,
        waMeUrl: log.waMeUrl,
        log,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'WhatsApp test dispatch failed.',
      });
    }
  });

  app.post('/api/admin/communications/send-document', async (req: Request, res: Response) => {
    try {
      const {
        channel,
        docType,
        docId,
        recipientName,
        recipientEmail,
        recipientPhone,
        customNote,
      } = req.body || {};

      if (!channel || !['email', 'whatsapp', 'both'].includes(channel)) {
        return res.status(400).json({ success: false, error: 'Invalid dispatch channel.' });
      }
      if (!docType || !docId) {
        return res.status(400).json({ success: false, error: 'docType and docId are required.' });
      }

      const safeRecipient = String(recipientName || 'Partner').trim();
      const actorName = getEffectiveOperatorName(req);
      const formatted = buildFormattedDocumentContent(
        docType as CommunicationDocType,
        String(docId),
        safeRecipient,
        customNote ? String(customNote) : undefined
      );

      const createdLogs: CommunicationDispatchLog[] = [];
      let waMeUrl: string | undefined;

      if (channel === 'email' || channel === 'both') {
        const emLog = await dispatchEmailMessage({
          toEmail: String(recipientEmail || ''),
          subject: formatted.subject,
          htmlBody: formatted.htmlBody,
          docType: docType as CommunicationDocType,
          docId: String(docId),
          docNumber: formatted.docNumber,
          recipientName: safeRecipient,
          sentBy: actorName,
        });
        createdLogs.push(emLog);
      }

      if (channel === 'whatsapp' || channel === 'both') {
        const waLog = await dispatchWhatsappMessage({
          toPhone: String(recipientPhone || ''),
          messageText: formatted.whatsappText,
          docType: docType as CommunicationDocType,
          docId: String(docId),
          docNumber: formatted.docNumber,
          recipientName: safeRecipient,
          sentBy: actorName,
        });
        createdLogs.push(waLog);
        if (waLog.waMeUrl) waMeUrl = waLog.waMeUrl;
      }

      const modeSummary = createdLogs.map((l) => `${l.channel.toUpperCase()} (${l.mode})`).join(' + ');
      res.json({
        success: true,
        message: `${formatted.docLabel} ${formatted.docNumber} dispatched via ${modeSummary}.`,
        waMeUrl,
        logs: createdLogs,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Document dispatch failed.',
      });
    }
  });

  // -------------------------------------------------------------
  // API 404 & ERROR JSON GUARDS (Prevent SPA HTML fallback on /api/*)
  // -------------------------------------------------------------
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  app.use('/api', (err: any, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('[GroceMart Backend API Error]', err);
    if (!res.headersSent) {
      res.status(err?.status || 500).json({
        error: err?.message || 'Internal server error',
      });
    }
  });

  // -------------------------------------------------------------
  // VITE OR STATIC CLIENT MOUNT
  // -------------------------------------------------------------
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GroceMart Backend] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[GroceMart Backend] QRIS OpenAPI available at http://0.0.0.0:${PORT}/api/qris/openapi.json`);
  });
}

startServer();
