/**
 * ZERO FRICTION EXPENSE TRACKER - GOOGLE APPS SCRIPT BACKEND
 * 
 * INSTRUCTIONS:
 * 1. Open Google Sheets (sheets.new)
 * 2. Go to Extensions -> Apps Script
 * 3. Replace all default code with this file
 * 4. Click "Deploy" -> "New deployment" -> Select "Web app"
 * 5. Set Execute as: "Me"
 * 6. Set Who has access: "Anyone"
 * 7. Copy Web App URL into your React Native app!
 */

// ==========================================
// 1. WEB APP POST ENDPOINT (RECEIVE EXPENSES)
// ==========================================

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = getOrCreateSheet();
    var postData = JSON.parse(e.postData.contents);
    
    var expenses = [];
    if (Array.isArray(postData.expenses)) {
      expenses = postData.expenses;
    } else if (postData.category) {
      expenses = [postData];
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "No expense data provided"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var rowsToAdd = [];
    var now = new Date();

    for (var i = 0; i < expenses.length; i++) {
      var item = expenses[i];
      rowsToAdd.push([
        item.category || 'Uncategorized',
        Number(item.expense) || 0,
        item.date_time || now.toISOString(),
        item.message || '',
        now.toISOString()
      ]);
    }

    if (rowsToAdd.length > 0) {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 5).setValues(rowsToAdd);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      count: rowsToAdd.length,
      timestamp: now.toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "Zero Friction Expense Sync Backend"
  })).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Expenses");
  if (!sheet) {
    sheet = ss.insertSheet("Expenses");
    // Add Header Row
    sheet.appendRow(["Category", "Expense", "Date_Time", "Message", "Sync_Timestamp"]);
    
    // Format Header Row
    var headerRange = sheet.getRange(1, 1, 1, 5);
    headerRange.setBackground("#0F172A");
    headerRange.setFontColor("#38BDF8");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ==========================================
// 2. SUNDAY HUMOROUS WEEKLY SUMMARY EMAIL
// ==========================================

/**
 * Setup Time-Driven Weekly Trigger (Runs Every Sunday 8:00 AM - 9:00 AM)
 * Run this function once manually in Apps Script Editor to set up!
 */
function setupWeeklyTrigger() {
  // Clear existing triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendWeeklySummaryReport") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create Sunday Trigger
  ScriptApp.newTrigger("sendWeeklySummaryReport")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(8)
    .create();

  Logger.log("Weekly Sunday Trigger successfully created!");
}

/**
 * Weekly Summary Generator & Email Sender
 */
function sendWeeklySummaryReport() {
  var sheet = getOrCreateSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return; // No data besides header

  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  var categoryTotals = {};
  var grandTotal = 0;
  var itemCount = 0;

  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var category = row[0];
    var amount = Number(row[1]);
    var dateTimeStr = row[2];
    var itemDate = new Date(dateTimeStr);

    if (itemDate >= sevenDaysAgo && itemDate <= now) {
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      categoryTotals[category] += amount;
      grandTotal += amount;
      itemCount++;
    }
  }

  if (itemCount === 0) {
    Logger.log("No expenses recorded in the past 7 days.");
    return;
  }

  // Find top category
  var topCategory = "";
  var topCategoryAmount = 0;
  for (var cat in categoryTotals) {
    if (categoryTotals[cat] > topCategoryAmount) {
      topCategoryAmount = categoryTotals[cat];
      topCategory = cat;
    }
  }

  // Humorous Quotes based on total spending
  var humorQuote = "";
  if (grandTotal > 500) {
    humorQuote = "🚨 Financial Alert: Your bank account is requesting a restraining order against your credit card.";
  } else if (grandTotal > 200) {
    humorQuote = "☕ You survived another week! Mostly funded by caffeine and retail therapy.";
  } else {
    humorQuote = "🏆 Impressive restraint! Warren Buffett is currently taking notes on your frugality.";
  }

  // User Email
  var recipientEmail = Session.getActiveUser().getEmail();

  // HTML Email Template
  var htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #1e293b;">
      <div style="text-align: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="color: #38bdf8; margin: 0; font-size: 24px;">📊 Weekly Financial Reality Check</h1>
        <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Zero Friction Expense Tracker</p>
      </div>

      <div style="background-color: #1e293b; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 20px; border: 1px solid #334155;">
        <span style="color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Total Spent This Week</span>
        <h2 style="color: #f8fafc; font-size: 36px; margin: 6px 0; font-weight: 800;">$${grandTotal.toFixed(2)}</h2>
        <p style="color: #cbd5e1; font-size: 13px; font-style: italic; margin: 8px 0 0 0;">${humorQuote}</p>
      </div>

      <h3 style="color: #cbd5e1; font-size: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px;">Breakdown by Category</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
  `;

  for (var categoryName in categoryTotals) {
    var catAmount = categoryTotals[categoryName];
    var percentage = ((catAmount / grandTotal) * 100).toFixed(1);
    var isTop = categoryName === topCategory;

    htmlBody += `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 10px 0; color: ${isTop ? '#38bdf8' : '#e2e8f0'}; font-weight: ${isTop ? 'bold' : 'normal'};">
          ${isTop ? '👑 ' : ''}${categoryName}
        </td>
        <td style="padding: 10px 0; text-align: right; color: #f8fafc; font-weight: bold;">
          $${catAmount.toFixed(2)} <span style="color: #64748b; font-weight: normal; font-size: 12px;">(${percentage}%)</span>
        </td>
      </tr>
    `;
  }

  htmlBody += `
      </table>

      <div style="background-color: #0f172a; padding: 12px; border-radius: 8px; text-align: center; border: 1px dashed #38bdf8;">
        <p style="color: #38bdf8; font-size: 13px; margin: 0;">⚡ Top Crime Scene: <b>${topCategory}</b> at $${topCategoryAmount.toFixed(2)}</p>
      </div>

      <div style="margin-top: 24px; text-align: center; color: #64748b; font-size: 11px;">
        Sent automatically by Zero Friction Expense Tracker Apps Script • ${now.toDateString()}
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: recipientEmail,
    subject: "💸 Your Weekly Expense Report: $" + grandTotal.toFixed(2) + " Spent",
    htmlBody: htmlBody
  });

  Logger.log("Weekly report email successfully sent to: " + recipientEmail);
}
