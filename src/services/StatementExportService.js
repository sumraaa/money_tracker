import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { exportAllExpenses } from '../database/db';
import { formatINR } from '../utils/money';

/**
 * Calculates financial metrics for the statement header/summary grid.
 */
function calculateStatementMetrics(expenses) {
  const totalOutflow = expenses.reduce((sum, item) => sum + (parseFloat(item.expense) || 0), 0);
  const totalTransactions = expenses.length;

  if (totalTransactions === 0) {
    return {
      totalOutflow: 0,
      totalTransactions: 0,
      dailyAverage: 0,
      topCategory: 'N/A',
      startDate: 'N/A',
      endDate: 'N/A',
    };
  }

  // Calculate top category by cumulative spend
  const categoryTotals = {};
  expenses.forEach((item) => {
    const cat = item.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(item.expense) || 0);
  });

  let topCategory = 'N/A';
  let maxCatAmount = -1;
  Object.keys(categoryTotals).forEach((cat) => {
    if (categoryTotals[cat] > maxCatAmount) {
      maxCatAmount = categoryTotals[cat];
      topCategory = cat;
    }
  });

  // Calculate unique days or date range for daily average
  const uniqueDays = new Set(
    expenses.map((e) => (e.date_time ? e.date_time.substring(0, 10) : ''))
  );
  uniqueDays.delete('');

  const dayCount = uniqueDays.size > 0 ? uniqueDays.size : 1;
  const dailyAverage = totalOutflow / dayCount;

  // Date range
  const dates = expenses
    .map((e) => (e.date_time ? new Date(e.date_time) : null))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const startDate = dates.length > 0 ? dates[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const endDate = dates.length > 0 ? dates[dates.length - 1].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  return {
    totalOutflow,
    totalTransactions,
    dailyAverage,
    topCategory,
    startDate,
    endDate,
  };
}

/**
 * Builds high-resolution, publication-grade HTML content for PDF & Word exports.
 */
function buildHtmlStatement(expenses, metrics, isWord = false, userName = 'User') {
  const generatedTime = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const statementPeriod = metrics.startDate === metrics.endDate
    ? metrics.startDate
    : `${metrics.startDate} – ${metrics.endDate}`;

  const rowsHtml = expenses.map((item, idx) => {
    const d = item.date_time ? new Date(item.date_time) : new Date();
    const formattedDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const merchantOrDesc = item.merchant || item.message || item.category || 'Expense';
    const bgStyle = idx % 2 === 1 ? 'background-color: #eeebe3;' : 'background-color: #ffffff;';

    return `
      <tr style="${bgStyle}">
        <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #e0ded7;">${formattedDate}</td>
        <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e0ded7;">${merchantOrDesc}</td>
        <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #e0ded7;">${item.category || 'Other'}</td>
        <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #e0ded7;">${item.payment_method || 'UPI'}</td>
        <td style="padding: 10px 12px; font-size: 12px; font-weight: 800; text-align: right; border-bottom: 1px solid #e0ded7;">${formatINR(item.expense || 0, { showPaise: false })}</td>
      </tr>
    `;
  }).join('');

  const wordDocHeader = isWord
    ? `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>`
    : `<!DOCTYPE html><html>`;

  const wordXml = isWord
    ? `<!--[if gte mso 9]>
       <xml>
        <w:WordDocument>
         <w:View>Print</w:View>
         <w:Zoom>100</w:Zoom>
         <w:DoNotOptimizeForCustomXSL/>
        </w:WordDocument>
       </xml>
       <![endif]-->`
    : '';

  return `
    ${wordDocHeader}
    <head>
      <meta charset="utf-8">
      <title>Pace — Official Financial Statement</title>
      ${wordXml}
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 24px;
          background-color: #f8f7f3;
          color: #171e19;
          -webkit-print-color-adjust: exact;
        }
        .header-card {
          background-color: #171e19;
          color: #ffffff;
          padding: 24px 28px;
          border-radius: 16px;
          margin-bottom: 24px;
        }
        .brand-title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin: 0 0 4px 0;
          color: #ffffff;
        }
        .brand-sub {
          font-size: 12px;
          color: #b7c6c2;
          margin: 0;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .header-meta-table {
          width: 100%;
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
        }
        .header-meta-td {
          vertical-align: top;
          width: 33.33%;
        }
        .meta-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #b7c6c2;
        }
        .meta-value {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin-top: 3px;
        }
        .metrics-table {
          width: 100%;
          border-spacing: 12px 0;
          margin-left: -12px;
          margin-right: -12px;
          margin-bottom: 24px;
        }
        .metric-cell {
          width: 25%;
          background-color: #ffffff;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid rgba(183, 198, 194, 0.4);
          vertical-align: top;
        }
        .metric-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #6c7772;
          margin-bottom: 6px;
        }
        .metric-value {
          font-size: 18px;
          font-weight: 800;
          color: #171e19;
        }
        .metric-accent {
          color: #ca0013;
        }
        .section-header {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #171e19;
          margin-bottom: 12px;
          padding-bottom: 6px;
          border-bottom: 2px solid #ca0013;
        }
        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(183, 198, 194, 0.4);
        }
        .ledger-table th {
          background-color: #171e19;
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 12px;
          text-align: left;
        }
        .footer {
          margin-top: 32px;
          text-align: center;
          font-size: 11px;
          color: #6c7772;
          line-height: 18px;
        }
      </style>
    </head>
    <body>
      <div class="header-card">
        <div class="brand-title">Pace — Official Financial Statement</div>
        <div class="brand-sub">Personal Financial Operating System</div>

        <table class="header-meta-table">
          <tr>
            <td class="header-meta-td">
              <div class="meta-label">Account Holder</div>
              <div class="meta-value">${userName}</div>
            </td>
            <td class="header-meta-td">
              <div class="meta-label">Statement Period</div>
              <div class="meta-value">${statementPeriod}</div>
            </td>
            <td class="header-meta-td">
              <div class="meta-label">Generated Timestamp</div>
              <div class="meta-value">${generatedTime}</div>
            </td>
          </tr>
        </table>
      </div>

      <table class="metrics-table">
        <tr>
          <td class="metric-cell">
            <div class="metric-label">Total Outflow</div>
            <div class="metric-value metric-accent">${formatINR(metrics.totalOutflow, { showPaise: false })}</div>
          </td>
          <td class="metric-cell">
            <div class="metric-label">Transactions</div>
            <div class="metric-value">${metrics.totalTransactions}</div>
          </td>
          <td class="metric-cell">
            <div class="metric-label">Daily Avg Spend</div>
            <div class="metric-value">${formatINR(metrics.dailyAverage, { showPaise: false })}</div>
          </td>
          <td class="metric-cell">
            <div class="metric-label">Top Category</div>
            <div class="metric-value">${metrics.topCategory}</div>
          </td>
        </tr>
      </table>

      <div class="section-header">Transaction Ledger</div>

      <table class="ledger-table">
        <thead>
          <tr>
            <th style="width: 18%;">Date</th>
            <th style="width: 32%;">Merchant / Description</th>
            <th style="width: 20%;">Category</th>
            <th style="width: 15%;">Method</th>
            <th style="width: 15%; text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">
        Confidential Document · Generated by Pace Financial OS<br/>
        All calculations performed locally on-device.
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates and shares executive PDF statement.
 */
export async function exportPDFStatement() {
  try {
    const expenses = await exportAllExpenses();
    if (!expenses || expenses.length === 0) {
      throw new Error('No expenses available to export.');
    }

    const metrics = calculateStatementMetrics(expenses);
    const statementHtml = buildHtmlStatement(expenses, metrics, false);

    const file = await Print.printToFileAsync({ html: statementHtml });
    if (!file || !file.uri) {
      throw new Error("Failed to generate PDF file: file URI is undefined.");
    }
    let pdfUri = file.uri;
    if (!pdfUri.startsWith('file://')) {
      pdfUri = `file://${pdfUri}`;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is unavailable on this device.");
    }

    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Pace Statement (PDF)',
      UTI: '.pdf',
    });

    return { success: true };
  } catch (error) {
    console.error('[StatementExportService] PDF export error:', error);
    throw new Error(`PDF Statement Export Failed: ${error?.message || 'Unknown error'}`);
  }
}

// Alias for backwards compatibility if needed
export const exportPdfStatement = exportPDFStatement;

/**
 * Generates and shares formatted Microsoft Word (.doc) statement.
 */
export async function exportWordStatement() {
  try {
    const expenses = await exportAllExpenses();
    if (!expenses || expenses.length === 0) {
      throw new Error('No expenses available to export.');
    }

    const metrics = calculateStatementMetrics(expenses);
    const statementHtml = buildHtmlStatement(expenses, metrics, true);

    const docPath = `${FileSystem.cacheDirectory}Pace_Statement.doc`;
    await FileSystem.writeAsStringAsync(docPath, statementHtml, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const shareDocUri = docPath.startsWith('file://') ? docPath : `file://${docPath}`;

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is unavailable on this device.");
    }

    await Sharing.shareAsync(shareDocUri, {
      mimeType: 'application/msword',
      dialogTitle: 'Share Pace Statement (Word)',
      UTI: '.doc',
    });

    return { success: true };
  } catch (error) {
    console.error('[StatementExportService] Word export error:', error);
    throw new Error(`Word Statement Export Failed: ${error?.message || 'Unknown error'}`);
  }
}

