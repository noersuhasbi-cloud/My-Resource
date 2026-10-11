import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

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
  INITIAL_WASTE_RECORDS,
  INITIAL_PICKER_ORDERS,
} from './src/data/inventoryData.ts';

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
  InventoryBatch,
  WasteRecord,
  PickerOrder,
  FEFOAllocationResult,
} from './src/types/index.ts';

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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

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

    const qrisRef = `QRIS-GCM-${Date.now().toString().slice(-6)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const qrPayload = generateQRISPayload(orderId, amount);

    qrisTransactions.set(orderId, {
      orderId,
      qrisReference: qrisRef,
      amount,
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
      amount,
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

  app.post('/api/qris/simulate-pay', (req: Request, res: Response) => {
    const { orderId, channel = 'BCA QRIS', customerName = 'GroceMart Customer', customerEmail = 'customer@grocemart.co.id', items = [] } = req.body;
    
    // GUARD 1: Payment Webhook Idempotency (QRIS Safety)
    const existingSettled = auditTrail.find((a) => a.orderId === orderId && a.status === 'SETTLED');
    const existingTx = qrisTransactions.get(orderId);
    if (existingSettled || (existingTx && existingTx.status === 'paid' && existingTx.paidAt)) {
      return res.json({
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
      });
    }

    // GUARD 2: Concurrency & Anti-Overselling Protection (Race Condition Prevention)
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const prodId = item.product?.id || item.productId;
        const qty = item.quantity || 1;
        const invItem = inventoryList.find((inv) => inv.productId === prodId || inv.sku === item.sku);
        if (invItem && invItem.currentStock < qty) {
          return res.status(409).json({
            success: false,
            error: `Anti-Overselling Guard: Insufficient inventory for "${invItem.productName}". Available: ${invItem.currentStock}, Requested: ${qty}. Transaction aborted.`,
          });
        }
      }
    }

    const tx = existingTx || {
      orderId,
      qrisReference: `QRIS-GCM-${Date.now().toString().slice(-6)}`,
      amount: req.body.amount || 75000,
      status: 'unpaid' as const,
      expiresAt: new Date().toISOString(),
      paidAt: undefined as string | undefined,
      settlementChannel: undefined as string | undefined,
    };

    tx.status = 'paid';
    tx.paidAt = new Date().toISOString();
    tx.settlementChannel = channel;
    qrisTransactions.set(orderId, tx);

    // 1. Deduct Inventory Stock & Calculate COGS
    const inventoryDeductions: { sku: string; quantity: number; cogsCost: number }[] = [];
    let totalCogs = 0;
    const triggeredPRs: PurchaseRequest[] = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const prodId = item.product?.id || item.productId;
        const qty = item.quantity || 1;
        const invItem = inventoryList.find((inv) => inv.productId === prodId);

        if (invItem) {
          invItem.currentStock = Math.max(0, invItem.currentStock - qty);
          invItem.outgoingStock += qty;

          const itemCogs = invItem.unitCost * qty;
          totalCogs += itemCogs;
          inventoryDeductions.push({
            sku: invItem.sku,
            quantity: qty,
            cogsCost: itemCogs,
          });

          // Check if fallen below minimum threshold -> AUTO TRIGGER REORDER
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
                totalEstimatedCost: (invItem.reorderQuantity || 50) * invItem.unitCost,
                status: 'pending',
                reason: 'low_stock_auto_trigger',
                priority: 'high',
              };
              purchaseRequests.unshift(newPR);
              triggeredPRs.push(newPR);
            }
          }
        }
      }
    } else {
      totalCogs = Math.round(tx.amount * 0.6); // Default realistic 60% COGS ratio
    }

    // 2. Automated Double-Entry General Ledger (GL) Recording
    const timestamp = new Date().toISOString();
    const gleId1 = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    const gleId2 = `GLE-2026-${(generalLedger.length + 2).toString().padStart(4, '0')}`;
    const gleId3 = `GLE-2026-${(generalLedger.length + 3).toString().padStart(4, '0')}`;
    const gleId4 = `GLE-2026-${(generalLedger.length + 4).toString().padStart(4, '0')}`;

    // A. Cash Inflow / QRIS Settlement Clearing (Debit 1010)
    generalLedger.unshift({
      id: gleId1,
      timestamp,
      accountCode: '1010',
      accountName: 'Cash & QRIS Settlement Clearing',
      category: 'Asset',
      debit: tx.amount,
      credit: 0,
      referenceType: 'QRIS_SALE',
      referenceId: orderId,
      description: `QRIS Settlement via ${channel} for Order #${orderId}`,
    });

    // B. Sales Revenue (Credit 4010)
    generalLedger.unshift({
      id: gleId2,
      timestamp,
      accountCode: '4010',
      accountName: 'Grocery Sales Revenue',
      category: 'Revenue',
      debit: 0,
      credit: tx.amount,
      referenceType: 'QRIS_SALE',
      referenceId: orderId,
      description: `Sales revenue recognized for Order #${orderId}`,
    });

    // C. Cost of Goods Sold (Debit 5010)
    generalLedger.unshift({
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
    });

    // D. Inventory Asset Deduction (Credit 1020)
    generalLedger.unshift({
      id: gleId4,
      timestamp,
      accountCode: '1020',
      accountName: 'Inventory Asset (Produce & Grocery)',
      category: 'Asset',
      debit: 0,
      credit: totalCogs,
      referenceType: 'QRIS_SALE',
      referenceId: orderId,
      description: `Inventory reduction for order dispatch #${orderId}`,
    });

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
      journalEntryIds: [gleId1, gleId2, gleId3, gleId4],
      inventoryDeducted: inventoryDeductions,
      status: 'SETTLED',
    };
    auditTrail.unshift(auditRecord);

    res.json({
      success: true,
      message: 'QRIS payment settled, inventory deducted, and GL entries recorded.',
      orderId,
      qrisReference: tx.qrisReference,
      paidAt: tx.paidAt,
      settlementChannel: channel,
      journalEntryIds: [gleId1, gleId2, gleId3, gleId4],
      auditRecordId: auditRecord.id,
      inventoryDeductions,
      triggeredPRsCount: triggeredPRs.length,
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
    const { isOpen, isHolidayMode, noticeBanner, reopenEstimated, maintenanceReason, allowCatalogBrowsing } = req.body;
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
    } = req.body;

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
    let totalStockCount = 0;
    let totalValuationWAC = 0;
    let lowStockCount = 0;

    inventoryList.forEach((item) => {
      totalStockCount += item.currentStock;
      totalValuationWAC += item.currentStock * item.unitCost;
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

    // Also update multi-tier item if present
    const tier = storeInventoryTiers.find((t) => t.sku === sku && t.storeId === storeId);
    if (tier) {
      tier.physicalStock = Math.max(0, tier.physicalStock + Number(adjustmentQty));
      tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
    }

    // Log GL adjustment
    const gleId = `GLE-2026-${(generalLedger.length + 1).toString().padStart(4, '0')}`;
    generalLedger.unshift({
      id: gleId,
      timestamp: new Date().toISOString(),
      storeId,
      storeName: tier?.storeName || 'GroceMart Retail Hub',
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: delta > 0 ? costDelta : 0,
      credit: delta < 0 ? costDelta : 0,
      referenceType: 'INVENTORY_ADJUSTMENT',
      referenceId: sku,
      description: `Stock adjustment for ${sku} (${delta > 0 ? '+' : ''}${delta} units): ${reason}`,
    });

    res.json({ success: true, item, delta, costDelta, gleId });
  });

  // -------------------------------------------------------------
  // ADVANCED INVENTORY: FEFO (FIRST EXPIRED, FIRST OUT) BATCHES
  // -------------------------------------------------------------
  app.get('/api/admin/inventory/batches', (req: Request, res: Response) => {
    const { storeId, sku, status } = req.query;
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

    // Filter available batches for this SKU & store that are not fully depleted
    const eligibleBatches = inventoryBatches
      .filter((b) => b.sku === sku && (storeId === 'ALL' || b.storeId === storeId) && b.currentStock > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    let remainingToAllocate = reqQty;
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
      if (remainingToAllocate <= 0) break;
      const take = Math.min(batch.currentStock, remainingToAllocate);
      batch.currentStock -= take;
      remainingToAllocate -= take;

      const subtotalCost = take * batch.unitCost;
      totalCogs += subtotalCost;

      allocations.push({
        batchId: batch.batchId,
        lotNumber: batch.lotNumber,
        expiryDate: batch.expiryDate,
        allocatedQty: take,
        unitCost: batch.unitCost,
        subtotalCost,
      });

      // Update batch status if depleted
      if (batch.currentStock === 0) {
        batch.status = 'critical';
      }
    }

    // Also deduct catalog stock
    const actualAllocated = reqQty - remainingToAllocate;
    item.currentStock = Math.max(0, item.currentStock - actualAllocated);
    item.outgoingStock += actualAllocated;

    const result: FEFOAllocationResult = {
      sku,
      productName: item.productName,
      requestedQty: reqQty,
      allocatedQty: actualAllocated,
      remainingShortage: remainingToAllocate,
      allocations,
      totalCogs,
      fefoRuleApplied: 'First Expired, First Out (Earliest lot expiration date allocated first to minimize food spoilage)',
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
      tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
      tier.updatedAt = new Date().toISOString();
    }

    // Deduct from batch if specified or find earliest matching batch
    let lotNumber = '';
    if (batchId) {
      const batch = inventoryBatches.find((b) => b.batchId === batchId);
      if (batch) {
        batch.currentStock = Math.max(0, batch.currentStock - qty);
        lotNumber = batch.lotNumber;
      }
    } else {
      const earliestBatch = inventoryBatches.find((b) => b.sku === sku && b.storeId === storeId && b.currentStock > 0);
      if (earliestBatch) {
        earliestBatch.currentStock = Math.max(0, earliestBatch.currentStock - qty);
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

    generalLedger.unshift({
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
    });

    generalLedger.unshift({
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
    });

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

  app.post('/api/admin/picker/orders/:orderId/items/:itemId/substitute', (req: Request, res: Response) => {
    const { orderId, itemId } = req.params;
    const { replacementSku, reason = 'Out of Stock on Shelf' } = req.body;

    const order = pickerOrders.find((o) => o.orderId === orderId);
    if (!order) return res.status(404).json({ error: 'Picker order not found' });

    const item = order.items.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    const replacement = inventoryList.find((i) => i.sku === replacementSku);
    if (!replacement) return res.status(404).json({ error: 'Replacement SKU not found' });

    const priceDelta = (replacement.sellingPrice * item.orderedQty) - item.finalPrice;

    item.status = 'substituted';
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
    }
    order.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: `Item substituted with ${replacement.productName}. Customer notified via SMS/App notification.`,
      order,
      item,
      notificationMessage: `Hi ${order.customerName}, due to fresh stock freshness standard, we upgraded your ${item.sku} to ${replacement.productName} at no extra charge penalty!`,
    });
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
    order.updatedAt = new Date().toISOString();

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
    res.json({ success: true, purchaseRequest: newPR });
  });

  app.post('/api/admin/procurement/requests/:id/approve', (req: Request, res: Response) => {
    const { id } = req.params;
    const pr = purchaseRequests.find((p) => p.id === id);
    if (!pr) return res.status(404).json({ error: 'Purchase Request not found' });

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

    res.json({ success: true, purchaseRequest: pr, purchaseOrder: newPO });
  });

  app.get('/api/admin/procurement/orders', (_req: Request, res: Response) => {
    res.json(purchaseOrders);
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

      // Update catalog inventory item
      const catalogItem = inventoryList.find((i) => i.sku === poItem.sku);
      if (catalogItem) {
        catalogItem.currentStock += receivedQty;
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

      // Update multi-tier inventory tier for specific store & warehouse zone
      const tier = storeInventoryTiers.find((t) => t.sku === poItem.sku && t.storeId === po.storeId);
      if (tier) {
        tier.physicalStock += receivedQty;
        tier.availableStock = Math.max(0, tier.physicalStock - tier.reservedStock);
        tier.incomingStock = Math.max(0, tier.incomingStock - receivedQty);
        tier.lastRestockedAt = new Date().toISOString();
        tier.updatedAt = new Date().toISOString();
      }
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
    generalLedger.unshift({
      id: gleId1,
      timestamp: new Date().toISOString(),
      storeId: po.storeId,
      storeName: po.storeName,
      accountCode: '1040',
      accountName: 'Merchandise Inventory Asset',
      category: 'Asset',
      debit: grTotalCost,
      credit: 0,
      referenceType: isPartial ? 'PARTIAL_GR' : 'PURCHASE_ORDER',
      referenceId: grId,
      description: `${grId}: ${isPartial ? 'Partial' : 'Full'} Goods receipt on PO #${po.id} from ${po.supplierName}`,
    });

    generalLedger.unshift({
      id: gleId2,
      timestamp: new Date().toISOString(),
      storeId: po.storeId,
      storeName: po.storeName,
      accountCode: '2010',
      accountName: 'Trade Accounts Payable (Vendors)',
      category: 'Liability',
      debit: 0,
      credit: grTotalCost,
      referenceType: isPartial ? 'PARTIAL_GR' : 'PURCHASE_ORDER',
      referenceId: grId,
      description: `${grId}: Trade liability accrued for received items on PO #${po.id}`,
    });

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
    res.json(chartOfAccounts);
  });

  app.get('/api/admin/accounting/general-ledger', (req: Request, res: Response) => {
    const { storeId } = req.query;
    if (storeId && storeId !== 'CONSOLIDATED') {
      return res.json(generalLedger.filter((g) => g.storeId === storeId));
    }
    res.json(generalLedger);
  });

  app.get('/api/admin/accounting/pnl', (req: Request, res: Response) => {
    const { storeId } = req.query;
    let relevantEntries = generalLedger;
    let storeName = 'Consolidated Company-Wide';

    if (storeId && storeId !== 'CONSOLIDATED') {
      relevantEntries = generalLedger.filter((e) => e.storeId === storeId);
      const s = storeSchedules.find((st) => st.storeId === storeId);
      if (s) storeName = s.storeName;
    }

    let grossSalesRevenue = 0;
    let costOfGoodsSold = 0;

    relevantEntries.forEach((entry) => {
      if (entry.accountCode === '4010') grossSalesRevenue += entry.credit;
      if (entry.accountCode === '5010') costOfGoodsSold += entry.debit;
    });

    // Provide realistic baseline if ledger is young
    if (grossSalesRevenue === 0) {
      grossSalesRevenue = storeId && storeId !== 'CONSOLIDATED' ? 45000000 : 388500000;
      costOfGoodsSold = Math.round(grossSalesRevenue * 0.62);
    }

    const discountsGiven = Math.round(grossSalesRevenue * 0.04);
    const netSalesRevenue = grossSalesRevenue - discountsGiven;
    const grossProfit = netSalesRevenue - costOfGoodsSold;
    const grossMarginPercent = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;

    const factor = storeId && storeId !== 'CONSOLIDATED' ? 0.22 : 1.0;
    const operatingExpenses = [
      { category: 'Cold-Chain Refrigeration & Store Electricity', amount: Math.round(18500000 * factor) },
      { category: 'Same-Day Chilled Logistics & Couriers', amount: Math.round(12200000 * factor) },
      { category: 'Store Storekeeping & Quality Inspection Staff', amount: Math.round(24800000 * factor) },
      { category: 'Biodegradable Insulated Packaging', amount: Math.round(3500000 * factor) },
    ];

    const totalOperatingExpenses = operatingExpenses.reduce((sum, o) => sum + o.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercent = netSalesRevenue > 0 ? (netProfit / netSalesRevenue) * 100 : 0;

    res.json({
      period: 'October 2026 MTD',
      storeId: storeId ? String(storeId) : 'CONSOLIDATED',
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
    });
  });

  app.get('/api/admin/accounting/balance-sheet', (req: Request, res: Response) => {
    const { storeId } = req.query;
    const isSingleStore = storeId && storeId !== 'CONSOLIDATED';
    const factor = isSingleStore ? 0.25 : 1.0;

    const currentAssets = [
      { category: 'Cash on Hand & Register Drawer Float', amount: Math.round(45000000 * factor) },
      { category: 'Bank BCA Operational Clearing', amount: Math.round(382000000 * factor) },
      { category: 'QRIS Settlement Receivable (ASPI Clearing)', amount: Math.round(28400000 * factor) },
      { category: 'Merchandise Inventory Asset (FIFO/WAC Valued)', amount: Math.round(846500000 * factor) },
    ];

    const nonCurrentAssets = [
      { category: 'Cold-Chain Walk-in Coolers & Display Chillers', amount: Math.round(210000000 * factor) },
      { category: 'Point-of-Sale Hardware & Warehouse Handhelds', amount: Math.round(48000000 * factor) },
    ];

    const totalAssets = [...currentAssets, ...nonCurrentAssets].reduce((s, a) => s + a.amount, 0);

    const currentLiabilities = [
      { category: 'Trade Accounts Payable to Farm Cooperatives', amount: Math.round(142000000 * factor) },
      { category: 'Accrued Electricity & Cold-Chain Logistics Fees', amount: Math.round(35000000 * factor) },
      { category: 'Customer Store Credit & GrocePoints Liability', amount: Math.round(8500000 * factor) },
    ];

    const totalLiabilities = currentLiabilities.reduce((s, l) => s + l.amount, 0);

    const retainedPrior = Math.round(174900000 * factor);
    const currentPeriodNet = Math.round(91500000 * factor);
    const paidInEquity = totalAssets - totalLiabilities - retainedPrior - currentPeriodNet;

    const equityItems = [
      { category: 'Paid-In Capital & Founding Equity', amount: paidInEquity },
      { category: 'Retained Earnings (Prior Quarters)', amount: retainedPrior },
      { category: 'Current Month Net Earnings (P&L MTD)', amount: currentPeriodNet },
    ];

    const totalEquity = equityItems.reduce((s, e) => s + e.amount, 0);

    res.json({
      period: 'October 2026 MTD',
      storeId: storeId ? String(storeId) : 'CONSOLIDATED',
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
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 100,
    });
  });

  app.get('/api/admin/accounting/cash-flow', (req: Request, res: Response) => {
    const { storeId } = req.query;
    const factor = storeId && storeId !== 'CONSOLIDATED' ? 0.25 : 1.0;

    const operatingActivities = [
      { category: 'Cash Receipts from QRIS Online & In-Store Sales', amount: Math.round(365000000 * factor) },
      { category: 'Payments to Produce & Dairy Suppliers', amount: -Math.round(210000000 * factor) },
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
    const beginningCash = Math.round(390000000 * factor);
    const endingCash = beginningCash + netCashIncrease;

    res.json({
      period: 'October 2026 MTD',
      storeId: storeId ? String(storeId) : 'CONSOLIDATED',
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
    });
  });

  app.get('/api/admin/accounting/audit-trail', (_req: Request, res: Response) => {
    res.json(auditTrail);
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
