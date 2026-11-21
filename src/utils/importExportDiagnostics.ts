import type {
  ImportExportDiagnosticIssue,
  ImportExportDiagnosticReport,
  ImportExportErrorType,
  InventoryImportDraftRow,
} from '../types/index.ts';

function buildReportId(prefix: string): string {
  return `DIAG-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function createDiagnosticReport(params: {
  operation: 'IMPORT' | 'EXPORT';
  source: string;
  totalRecords: number;
  issues: ImportExportDiagnosticIssue[];
  actorName?: string;
  summaryOverride?: string;
}): ImportExportDiagnosticReport {
  const errorCount = params.issues.filter((i) => i.severity === 'error').length;
  const warningCount = params.issues.filter((i) => i.severity === 'warning').length;
  const status: ImportExportDiagnosticReport['status'] =
    errorCount === 0
      ? 'SUCCESS'
      : params.totalRecords > 0 && errorCount < params.totalRecords
      ? 'PARTIAL_ERROR'
      : 'FAILED';

  const summary =
    params.summaryOverride ||
    (errorCount === 0
      ? `${params.operation} completed cleanly (${params.totalRecords} record(s), ${warningCount} warning(s)).`
      : `${params.operation} flagged ${errorCount} error(s) and ${warningCount} warning(s) across ${params.totalRecords} record(s).`);

  return {
    id: buildReportId(params.operation === 'IMPORT' ? 'IMP' : 'EXP'),
    timestamp: new Date().toISOString(),
    operation: params.operation,
    source: params.source,
    status,
    totalRecords: params.totalRecords,
    errorCount,
    warningCount,
    summary,
    issues: params.issues,
    actorName: params.actorName,
  };
}

/**
 * Analyzes an ERP JSON Snapshot payload (raw string or parsed object) and produces
 * structured diagnostics covering format, schema, required sections, duplicates, and ledger integrity.
 */
export function analyzeSnapshotRestorePayload(
  rawInput: string | Record<string, any> | null | undefined,
  sourceName: string = 'system_snapshot.json',
  actorName?: string
): { parsed: any | null; report: ImportExportDiagnosticReport } {
  const issues: ImportExportDiagnosticIssue[] = [];
  let parsed: any = rawInput;

  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      issues.push({
        errorType: 'INVALID_FILE_FORMAT',
        severity: 'error',
        reference: 'File Body',
        rootCause: 'Uploaded snapshot file is empty (0 bytes of JSON content).',
        remediationHint: 'Select a non-empty .json backup previously exported via "Download Backup (.JSON)".',
      });
      return {
        parsed: null,
        report: createDiagnosticReport({
          operation: 'IMPORT',
          source: sourceName,
          totalRecords: 0,
          issues,
          actorName,
        }),
      };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch (err: any) {
      const syntaxMsg = err?.message ? String(err.message) : 'Malformed JSON syntax';
      issues.push({
        errorType: 'INVALID_FILE_FORMAT',
        severity: 'error',
        reference: 'JSON Parser',
        rootCause: `File cannot be parsed as valid JSON (${syntaxMsg}).`,
        remediationHint: 'Verify the file is a valid UTF-8 .json snapshot and was not truncated or manually edited with syntax errors.',
      });
      return {
        parsed: null,
        report: createDiagnosticReport({
          operation: 'IMPORT',
          source: sourceName,
          totalRecords: 0,
          issues,
          actorName,
        }),
      };
    }
  }

  const snap =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.snapshot && typeof parsed.snapshot === 'object'
      ? parsed.snapshot
      : parsed;

  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
    issues.push({
      errorType: 'SCHEMA_MISMATCH',
      severity: 'error',
      reference: 'Root Payload',
      rootCause: 'Root JSON structure must be an object containing ERP snapshot collections, not an array or primitive.',
      remediationHint: 'Export a fresh snapshot from Enterprise Settings -> Backup & Restore and upload that file without wrapping it in an array.',
    });
    return {
      parsed: null,
      report: createDiagnosticReport({
        operation: 'IMPORT',
        source: sourceName,
        totalRecords: 0,
        issues,
        actorName,
      }),
    };
  }

  if (!Array.isArray(snap.generalLedger)) {
    issues.push({
      errorType: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      reference: 'generalLedger',
      field: 'generalLedger',
      rootCause: 'Required array field "generalLedger" is missing or not an array.',
      remediationHint: 'Include a valid "generalLedger": [...] array (empty array is valid for clean production snapshots).',
    });
  }

  if (!Array.isArray(snap.inventoryBatches)) {
    issues.push({
      errorType: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      reference: 'inventoryBatches',
      field: 'inventoryBatches',
      rootCause: 'Required array field "inventoryBatches" is missing or not an array.',
      remediationHint: 'Include a valid "inventoryBatches": [...] array in the snapshot JSON.',
    });
  }

  if (!Array.isArray(snap.chartOfAccounts) || snap.chartOfAccounts.length === 0) {
    issues.push({
      errorType: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      reference: 'chartOfAccounts',
      field: 'chartOfAccounts',
      rootCause: 'Required non-empty array "chartOfAccounts" is missing or empty.',
      remediationHint: 'Ensure Chart of Accounts entries (accountCode, accountName, balance) are present before restoring.',
    });
  } else {
    const seenCoa = new Set<string>();
    snap.chartOfAccounts.forEach((acc: any, idx: number) => {
      if (!acc || typeof acc.accountCode !== 'string' || !acc.accountCode.trim()) {
        issues.push({
          errorType: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
          reference: `chartOfAccounts[${idx}]`,
          field: 'accountCode',
          rowNumber: idx + 1,
          rootCause: `COA entry #${idx + 1} is missing a string "accountCode".`,
          remediationHint: 'Provide a valid string accountCode (e.g., "1010", "1040") for every COA record.',
        });
      } else {
        const code = acc.accountCode.trim();
        if (seenCoa.has(code)) {
          issues.push({
            errorType: 'DUPLICATE_KEY',
            severity: 'error',
            reference: `COA ${code}`,
            field: 'accountCode',
            rowNumber: idx + 1,
            rootCause: `Duplicate Chart of Accounts code "${code}" detected at entry #${idx + 1}.`,
            remediationHint: 'Remove or merge duplicate accountCode entries so each COA code is unique.',
          });
        }
        seenCoa.add(code);
      }

      if (typeof acc?.balance !== 'number' || !Number.isFinite(acc.balance)) {
        issues.push({
          errorType: 'INVALID_VALUE_TYPE',
          severity: 'error',
          reference: `COA ${acc?.accountCode || `#${idx + 1}`}`,
          field: 'balance',
          rowNumber: idx + 1,
          rootCause: `COA balance must be a finite numeric value (received ${typeof acc?.balance}).`,
          remediationHint: 'Replace non-numeric or string balance values with numbers (e.g., 0 or 1500000).',
        });
      }
    });
  }

  const resolvedErpSettings = snap.erpSettings || snap.enterpriseSettings?.erpSettings;
  if (!resolvedErpSettings || typeof resolvedErpSettings !== 'object' || Array.isArray(resolvedErpSettings)) {
    issues.push({
      errorType: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      reference: 'erpSettings',
      field: 'erpSettings',
      rootCause: 'Required object "erpSettings" (or "enterpriseSettings.erpSettings") is missing.',
      remediationHint: 'Ensure the snapshot includes tax/ERP configuration settings exported from GroceMart ERP.',
    });
  }

  // Non-blocking integrity check: warn if GL debits != credits in snapshot
  if (Array.isArray(snap.generalLedger) && snap.generalLedger.length > 0) {
    let totalDr = 0;
    let totalCr = 0;
    snap.generalLedger.forEach((entry: any) => {
      if (Array.isArray(entry?.lines)) {
        entry.lines.forEach((line: any) => {
          totalDr += Number(line?.debit || 0);
          totalCr += Number(line?.credit || 0);
        });
      } else {
        totalDr += Number(entry?.debit || 0);
        totalCr += Number(entry?.credit || 0);
      }
    });
    if (Math.abs(totalDr - totalCr) > 1) {
      issues.push({
        errorType: 'CONSTRAINT_RELATION_MISMATCH',
        severity: 'warning',
        reference: 'generalLedger',
        field: 'debit/credit',
        rootCause: `Snapshot General Ledger total Debit (${Math.round(totalDr)}) differs from Credit (${Math.round(totalCr)}) by ${Math.round(Math.abs(totalDr - totalCr))} IDR.`,
        remediationHint: 'Review General Ledger entries after restore or verify the backup source was not partially modified.',
      });
    }
  }

  const totalRecords =
    (Array.isArray(snap.generalLedger) ? snap.generalLedger.length : 0) +
    (Array.isArray(snap.inventoryBatches) ? snap.inventoryBatches.length : 0) +
    (Array.isArray(snap.chartOfAccounts) ? snap.chartOfAccounts.length : 0);

  return {
    parsed: snap,
    report: createDiagnosticReport({
      operation: 'IMPORT',
      source: sourceName,
      totalRecords,
      issues,
      actorName,
    }),
  };
}

/**
 * Analyzes inventory CSV/Excel/Draft rows for missing required fields, type violations,
 * duplicate SKU+Lot keys, expired dates, margin warnings, and Trial/Demo row cap breaches.
 */
export function analyzeInventoryImportRows(
  rows: Array<Partial<InventoryImportDraftRow> & Record<string, any>>,
  options: {
    sourceName?: string;
    maxAllowedRows?: number;
    actorName?: string;
    todayYmd?: string;
  } = {}
): ImportExportDiagnosticReport {
  const issues: ImportExportDiagnosticIssue[] = [];
  const source = options.sourceName || 'bulk_inventory_import.csv';
  const todayStr = options.todayYmd || new Date().toISOString().slice(0, 10);

  if (!Array.isArray(rows) || rows.length === 0) {
    issues.push({
      errorType: 'SCHEMA_MISMATCH',
      severity: 'error',
      reference: 'Dataset',
      rootCause: 'No importable data rows were detected after parsing headers.',
      remediationHint: 'Verify the file has a valid header row (SKU, Product Name, Stock, Unit Cost) plus at least 1 data row.',
    });
    return createDiagnosticReport({
      operation: 'IMPORT',
      source,
      totalRecords: 0,
      issues,
      actorName: options.actorName,
    });
  }

  if (typeof options.maxAllowedRows === 'number' && options.maxAllowedRows > 0 && rows.length > options.maxAllowedRows) {
    issues.push({
      errorType: 'TRIAL_LIMIT_EXCEEDED',
      severity: 'error',
      reference: `Batch Size (${rows.length} rows)`,
      rootCause: `Batch contains ${rows.length} rows, exceeding the active Trial/Demo governance limit of ${options.maxAllowedRows} rows per batch.`,
      remediationHint: `Split the file into batches of <= ${options.maxAllowedRows} rows or ask Super Admin to raise the batch limit in Enterprise Settings -> Trial & Demo Governance.`,
    });
  }

  const seenSkuLot = new Map<string, number>();

  rows.forEach((row, idx) => {
    const rowNo = idx + 1;
    const sku = String(row.sku || '').trim().toUpperCase();
    const productName = String(row.productName || row.product_name || '').trim();
    const qty = Number(row.physicalStock ?? row.initial_qty ?? row.stock);
    const unitCost = Number(row.unitCost ?? row.unit_cost_idr ?? row.costPrice);
    const sellingPrice = Number(row.sellingPrice ?? row.selling_price_idr);
    const rackLocation = String(row.rackLocation ?? row.rack_bin_code ?? '').trim();
    const lotNumber = String(row.lotNumber ?? row.batch_lot_no ?? '').trim();
    const expiryDate = String(row.expiryDate ?? row.expiry_date ?? '').trim();
    const refLabel = sku ? `Row ${rowNo} (${sku})` : `Row ${rowNo}`;

    if (!sku) {
      issues.push({
        errorType: 'MISSING_REQUIRED_FIELD',
        severity: 'error',
        reference: refLabel,
        field: 'sku',
        rowNumber: rowNo,
        rootCause: `Row ${rowNo} is missing a required SKU identifier.`,
        remediationHint: 'Populate a unique SKU code (e.g., SKU-PRD-001) in the SKU column.',
      });
    }
    if (!productName) {
      issues.push({
        errorType: 'MISSING_REQUIRED_FIELD',
        severity: 'error',
        reference: refLabel,
        field: 'productName',
        rowNumber: rowNo,
        rootCause: `${refLabel} is missing a Product Name.`,
        remediationHint: 'Enter a descriptive product name before staging or applying the draft.',
      });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      issues.push({
        errorType: 'INVALID_VALUE_TYPE',
        severity: 'error',
        reference: refLabel,
        field: 'physicalStock',
        rowNumber: rowNo,
        rootCause: `${refLabel} has invalid stock quantity (${String(row.physicalStock ?? row.initial_qty ?? '')}). Quantity must be a positive number.`,
        remediationHint: 'Use a numeric quantity greater than 0 (remove currency symbols or text units).',
      });
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      issues.push({
        errorType: 'INVALID_VALUE_TYPE',
        severity: 'error',
        reference: refLabel,
        field: 'unitCost',
        rowNumber: rowNo,
        rootCause: `${refLabel} has invalid unit cost (${String(row.unitCost ?? row.unit_cost_idr ?? '')}). Unit cost must be > 0 IDR.`,
        remediationHint: 'Provide a positive numeric IDR cost value (e.g., 14500 without "Rp" or commas).',
      });
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      issues.push({
        errorType: 'INVALID_VALUE_TYPE',
        severity: 'error',
        reference: refLabel,
        field: 'sellingPrice',
        rowNumber: rowNo,
        rootCause: `${refLabel} has invalid selling price (${String(row.sellingPrice ?? row.selling_price_idr ?? '')}).`,
        remediationHint: 'Set Selling Price to a valid non-negative number (0 is allowed for Fixed Assets/Consumables).',
      });
    } else if (
      Number.isFinite(unitCost) &&
      unitCost > 0 &&
      sellingPrice > 0 &&
      sellingPrice < unitCost &&
      (row.itemClassification === undefined || row.itemClassification === 'MERCHANDISE')
    ) {
      issues.push({
        errorType: 'CONSTRAINT_RELATION_MISMATCH',
        severity: 'warning',
        reference: refLabel,
        field: 'sellingPrice',
        rowNumber: rowNo,
        rootCause: `${refLabel} selling price (${sellingPrice} IDR) is lower than unit cost (${unitCost} IDR) — negative gross margin.`,
        remediationHint: 'Increase Selling Price above Unit Cost or verify if this item should be classified as Fixed Asset / Consumable.',
      });
    }

    if (expiryDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
        issues.push({
          errorType: 'INVALID_VALUE_TYPE',
          severity: 'error',
          reference: refLabel,
          field: 'expiryDate',
          rowNumber: rowNo,
          rootCause: `${refLabel} expiry date "${expiryDate}" does not match ISO format YYYY-MM-DD.`,
          remediationHint: 'Format expiry dates as YYYY-MM-DD (e.g., 2026-12-31).',
        });
      } else if (expiryDate < todayStr) {
        issues.push({
          errorType: 'CONSTRAINT_RELATION_MISMATCH',
          severity: 'error',
          reference: refLabel,
          field: 'expiryDate',
          rowNumber: rowNo,
          rootCause: `${refLabel} expiry date "${expiryDate}" is in the past (before ${todayStr}).`,
          remediationHint: 'Update expiry date to a future date or remove expired stock from inbound intake.',
        });
      }
    }

    if (sku && lotNumber) {
      const compositeKey = `${sku}::${lotNumber.toUpperCase()}::${rackLocation.toUpperCase()}`;
      const firstSeenRow = seenSkuLot.get(compositeKey);
      if (firstSeenRow !== undefined) {
        issues.push({
          errorType: 'DUPLICATE_KEY',
          severity: 'warning',
          reference: refLabel,
          field: 'sku+lotNumber',
          rowNumber: rowNo,
          rootCause: `Duplicate SKU + Lot + Rack combination "${sku} / ${lotNumber}" already appeared on Row ${firstSeenRow}.`,
          remediationHint: 'Consolidate quantities into a single row or assign distinct Lot Numbers / Rack Locations.',
        });
      } else {
        seenSkuLot.set(compositeKey, rowNo);
      }
    }
  });

  return createDiagnosticReport({
    operation: 'IMPORT',
    source,
    totalRecords: rows.length,
    issues,
    actorName: options.actorName,
  });
}

/**
 * Normalizes a caught client/server error from an Import or Export call into a structured diagnostic report.
 */
export function buildDiagnosticFromError(params: {
  operation: 'IMPORT' | 'EXPORT';
  source: string;
  error: any;
  totalRecords?: number;
  actorName?: string;
}): ImportExportDiagnosticReport {
  const errObj = params.error;
  if (errObj?.diagnosticReport && typeof errObj.diagnosticReport === 'object') {
    return errObj.diagnosticReport as ImportExportDiagnosticReport;
  }

  const rawMsg = String(errObj?.message || errObj?.error || 'Unexpected error during operation.');
  const code = String(errObj?.code || '').toUpperCase();

  let errorType: ImportExportErrorType = 'SERVER_ERROR';
  let remediationHint = 'Review the error details, verify your payload and permissions, and retry.';

  if (code === 'TRIAL_LOCKED' || /trial.*expired|suspended|trial_locked/i.test(rawMsg)) {
    errorType = 'TRIAL_LOCKED';
    remediationHint = 'Operational access is locked by Trial/Demo Governance. Contact Super Admin to extend or convert to Paid Production.';
  } else if (code === 'EXPORT_RESTRICTED' || /export.*restrict/i.test(rawMsg)) {
    errorType = 'EXPORT_RESTRICTED';
    remediationHint = 'External exports are restricted for non-owners under Trial/Demo Governance. Ask Super Admin to enable exports or export on your behalf.';
  } else if (code === 'TRIAL_LIMIT_EXCEEDED' || /exceed.*limit|max.*rows/i.test(rawMsg)) {
    errorType = 'TRIAL_LIMIT_EXCEEDED';
    remediationHint = 'Reduce the batch row count or increase Max Import Rows in Enterprise Settings -> Trial & Demo Governance.';
  } else if (code === 'INVALID_SNAPSHOT_SCHEMA' || /schema|missing or invalid/i.test(rawMsg)) {
    errorType = 'SCHEMA_MISMATCH';
    remediationHint = 'Ensure required fields (generalLedger, inventoryBatches, chartOfAccounts, erpSettings) match the expected ERP backup schema.';
  } else if (/not valid json|parse|xlsx|csv|format/i.test(rawMsg)) {
    errorType = 'INVALID_FILE_FORMAT';
    remediationHint = 'Check that the uploaded file uses a valid .json, .csv, or .xlsx format without corruption.';
  } else if (/duplicate/i.test(rawMsg)) {
    errorType = 'DUPLICATE_KEY';
    remediationHint = 'Remove or rename duplicate keys (SKU, Lot, or COA code) before retrying.';
  } else if (/permission|403|akses ditolak|super admin|forbidden/i.test(rawMsg)) {
    errorType = params.operation === 'EXPORT' ? 'EXPORT_RESTRICTED' : 'CONSTRAINT_RELATION_MISMATCH';
    remediationHint = 'Your active role or governance policy does not permit this action. Sign in with an authorized role or adjust sub-role governance.';
  }

  return createDiagnosticReport({
    operation: params.operation,
    source: params.source,
    totalRecords: params.totalRecords ?? 0,
    actorName: params.actorName,
    issues: [
      {
        errorType,
        severity: 'error',
        reference: params.source,
        rootCause: rawMsg,
        remediationHint,
      },
    ],
  });
}
