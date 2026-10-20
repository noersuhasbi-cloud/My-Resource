// Auto-Replenishment & Min-Max Stock Planning Engine
// Calculates predictive restock requirements, safety stock buffers, sales velocity, and generates draft Purchase Orders (PO)

import type {
  StoreInventoryStock,
  AutoReplenishmentItemPlan,
  AutoReplenishmentConsolidatedPlan,
  PurchaseOrder,
} from '../types/index.ts';

/**
 * Standard lead times by category (in days)
 */
export const CATEGORY_LEAD_TIME_DAYS: Record<string, number> = {
  produce: 2,
  bakery: 1,
  meat_seafood: 3,
  dairy: 3,
  pantry: 5,
  beverages: 4,
  frozen: 3,
};

/**
 * Category-based typical daily velocity baseline
 */
export const CATEGORY_DAILY_VELOCITY_BASELINE: Record<string, number> = {
  produce: 8,
  bakery: 12,
  dairy: 10,
  meat_seafood: 6,
  pantry: 5,
  beverages: 9,
  frozen: 4,
};

/**
 * Evaluates auto-replenishment plans across store inventory tiers
 */
export function calculateAutoReplenishmentPlan(
  inventoryTiers: StoreInventoryStock[],
  selectedStoreId: string = 'CONSOLIDATED'
): AutoReplenishmentConsolidatedPlan {
  const filteredTiers =
    selectedStoreId === 'CONSOLIDATED' || selectedStoreId === 'ALL'
      ? inventoryTiers
      : inventoryTiers.filter((t) => t.storeId === selectedStoreId);

  const items: AutoReplenishmentItemPlan[] = filteredTiers.map((tier) => {
    const leadTimeDays = CATEGORY_LEAD_TIME_DAYS[tier.category] || 3;
    const baseVelocity = CATEGORY_DAILY_VELOCITY_BASELINE[tier.category] || 6;
    
    // Calculate pseudo-realistic sales velocity derived from minimum threshold and reorder frequency
    const calculatedVelocity = Math.max(1, Math.round((tier.reorderQuantity / 7) || baseVelocity));
    const reorderPoint = tier.safetyStockBuffer + calculatedVelocity * leadTimeDays;
    
    // If available stock + incoming is at or below reorder point, trigger restock
    const effectiveStock = tier.availableStock + (tier.incomingStock || 0);
    const isReorderTriggered = effectiveStock <= reorderPoint;

    let urgencyLevel: AutoReplenishmentItemPlan['urgencyLevel'] = 'HEALTHY_STOCK';
    if (tier.availableStock <= 0) {
      urgencyLevel = 'CRITICAL_OUT_OF_STOCK';
    } else if (isReorderTriggered) {
      urgencyLevel = 'BELOW_SAFETY_STOCK';
    } else if (tier.availableStock >= tier.maxCapacity * 0.95) {
      urgencyLevel = 'OVERSTOCKED';
    }

    const suggestedOrderQty = isReorderTriggered
      ? Math.max(tier.reorderQuantity, tier.maxCapacity - tier.availableStock)
      : 0;

    const daysOfInventoryLeft = calculatedVelocity > 0
      ? Number((tier.availableStock / calculatedVelocity).toFixed(1))
      : 99;

    const estimatedOrderCostIDR = suggestedOrderQty * tier.unitCost;

    return {
      sku: tier.sku,
      productName: tier.productName,
      category: tier.category,
      storeId: tier.storeId,
      storeName: tier.storeName,
      warehouseZoneId: tier.warehouseZoneId,
      physicalStock: tier.physicalStock,
      availableStock: tier.availableStock,
      reservedStock: tier.reservedStock,
      incomingStock: tier.incomingStock || 0,
      minimumThreshold: tier.minimumThreshold,
      safetyStockBuffer: tier.safetyStockBuffer,
      maxCapacity: tier.maxCapacity,
      reorderQuantity: tier.reorderQuantity,
      dailySalesVelocity: calculatedVelocity,
      daysOfInventoryLeft,
      supplierLeadTimeDays: leadTimeDays,
      reorderPoint,
      isReorderTriggered,
      urgencyLevel,
      suggestedOrderQty,
      unitCost: tier.unitCost,
      estimatedOrderCostIDR,
      supplierId: tier.supplierId || 'SUP-01',
      supplierName: tier.supplierName || 'Primary Agro Supplier Hub',
    };
  });

  const skusNeedingRestock = items.filter((it) => it.isReorderTriggered);
  const criticalSkus = items.filter((it) => it.urgencyLevel === 'CRITICAL_OUT_OF_STOCK');
  const totalSuggestedCostIDR = skusNeedingRestock.reduce((sum, it) => sum + it.estimatedOrderCostIDR, 0);

  // Group by supplier
  const supplierMap: Record<
    string,
    {
      supplierId: string;
      supplierName: string;
      skuCount: number;
      totalOrderQty: number;
      totalAmountIDR: number;
      suggestedPoId: string;
    }
  > = {};

  skusNeedingRestock.forEach((item) => {
    if (!supplierMap[item.supplierId]) {
      supplierMap[item.supplierId] = {
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        skuCount: 0,
        totalOrderQty: 0,
        totalAmountIDR: 0,
        suggestedPoId: `PO-AUTO-${item.supplierId.replace(/[^a-zA-Z0-9]/g, '')}`,
      };
    }
    supplierMap[item.supplierId].skuCount += 1;
    supplierMap[item.supplierId].totalOrderQty += item.suggestedOrderQty;
    supplierMap[item.supplierId].totalAmountIDR += item.estimatedOrderCostIDR;
  });

  return {
    storeId: selectedStoreId,
    storeName: selectedStoreId === 'CONSOLIDATED' ? 'All GroceMart Hubs' : items[0]?.storeName || selectedStoreId,
    calculatedAt: new Date().toISOString(),
    totalSkusEvaluated: items.length,
    skusNeedingRestockCount: skusNeedingRestock.length,
    criticalSkusCount: criticalSkus.length,
    totalSuggestedCostIDR,
    items,
    bySupplier: Object.values(supplierMap),
  };
}

/**
 * Generate Draft Purchase Orders from replenishment plan
 */
export function generateDraftPOsFromReplenishment(
  itemsToRestock: AutoReplenishmentItemPlan[],
  targetStoreId: string = 'store-jkt-senopati',
  currentPoCount: number = 100
): PurchaseOrder[] {
  const bySupplier: Record<string, AutoReplenishmentItemPlan[]> = {};
  itemsToRestock.forEach((item) => {
    if (!bySupplier[item.supplierId]) {
      bySupplier[item.supplierId] = [];
    }
    bySupplier[item.supplierId].push(item);
  });

  const now = new Date();
  const createdPOs: PurchaseOrder[] = [];
  let counter = currentPoCount;

  Object.entries(bySupplier).forEach(([supplierId, planItems]) => {
    counter += 1;
    const poNumber = `PO-2026-${counter.toString().padStart(4, '0')}`;
    const totalAmount = planItems.reduce((acc, it) => acc + it.estimatedOrderCostIDR, 0);
    const maxLeadTime = Math.max(...planItems.map((it) => it.supplierLeadTimeDays));
    const estDelivery = new Date(now.getTime() + maxLeadTime * 86400000).toISOString();

    const po: PurchaseOrder = {
      id: poNumber,
      createdAt: now.toISOString(),
      storeId: targetStoreId,
      storeName: planItems[0]?.storeName || 'GroceMart Senopati Flagship Hub',
      warehouseZoneId: planItems[0]?.warehouseZoneId || 'WH-JKT-SEN-COLD',
      supplierName: planItems[0].supplierName,
      supplierContact: '+62 21-555-8901 (Procurement Desk)',
      status: 'Draft',
      subtotalCost: totalAmount,
      taxPercent: 11,
      taxAmount: Math.round(totalAmount * 0.11),
      totalCost: Math.round(totalAmount * 1.11),
      expectedDeliveryDate: estDelivery,
      paymentTerms: 'Net 30',
      notes: `Automated replenishment order triggered by min-max predictive threshold analysis. Total ${planItems.length} SKUs below safety stock.`,
      items: planItems.map((it) => ({
        sku: it.sku,
        productName: it.productName,
        orderedQuantity: it.suggestedOrderQty,
        receivedQuantity: 0,
        remainingBackorder: it.suggestedOrderQty,
        unitCost: it.unitCost,
        totalCost: it.estimatedOrderCostIDR,
        handlingNotes: `Target Zone: ${it.warehouseZoneId}`,
      })),
    };

    createdPOs.push(po);
  });

  return createdPOs;
}
