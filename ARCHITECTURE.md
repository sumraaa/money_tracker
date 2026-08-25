# Zero Friction Mobile Expense Tracker - System Architecture & Setup Guide

## 1. System Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     HARDWARE TRIGGER                        │
 │  (Samsung Side Key Double-Press / iOS Action Button)         │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Intent / Deep Link (exp-tracker://quick-log)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                 REACT NATIVE (EXPO) APP                     │
 │                                                             │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │        ZERO-FRICTION BOTTOM SHEET POP-UP MODAL        │  │
 │  │   - Quick Category Grid (+ Add Custom)                │  │
 │  │   - Custom Numpad & Amount Format                     │  │
 │  │   - Optional Message Input                            │  │
 │  │   - "Upload Expense" CTA                              │  │
 │  └───────────────────────────┬───────────────────────────┘  │
 │                              │ Instant Save                 │
 │                              ▼                              │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │                 EXPO SQLITE DATABASE                  │  │
 │  │   (Offline Storage with sync_status: 0 [Queued])      │  │
 │  └───────────────────────────┬───────────────────────────┘  │
 │                              │ Background Sync Trigger      │
 │                              ▼                              │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │             BACKGROUND SYNC MANAGER                   │  │
 │  │   (NetInfo connection listener & retry queue)         │  │
 │  └───────────────────────────┬───────────────────────────┘  │
 └──────────────────────────────┼──────────────────────────────┘
                                │ HTTPS POST Payload
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                GOOGLE APPS SCRIPT BACKEND                   │
 │                                                             │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │                  doPost(e) WEB APP                    │  │
 │  │   - Appends JSON payload to empty row in Google Sheet │  │
 │  └───────────────────────────┬───────────────────────────┘  │
 │                              │ Auto-Appends                 │
 │                              ▼                              │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │             GOOGLE SHEETS DATABASE                    │  │
 │  └───────────────────────────┬───────────────────────────┘  │
 │                              │ Weekly Cron (Sunday 8 AM)    │
 │                              ▼                              │
 │  ┌───────────────────────────────────────────────────────┐  │
 │  │         HUMOROUS HTML WEEKLY EMAIL GENERATOR          │  │
 │  │   (MailApp.sendEmail with total & category stats)     │  │
 │  └───────────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 2. Offline-First SQLite Data Schema

Table Name: `expenses`

| Column Name   | Type    | Constraint                    | Description                                  |
|---------------|---------|-------------------------------|----------------------------------------------|
| `id`          | INTEGER | PRIMARY KEY AUTOINCREMENT     | Local unique expense ID                      |
| `category`    | TEXT    | NOT NULL                      | Category name (e.g. Food, Transport, Custom) |
| `expense`     | REAL    | NOT NULL                      | Numeric expense amount                       |
| `date_time`   | TEXT    | NOT NULL                      | ISO 8601 Timestamp                           |
| `message`     | TEXT    | NULLABLE                      | Optional note or comment                     |
| `sync_status` | INTEGER | DEFAULT 0                     | 0 = Local Queue (Unsynced), 1 = Synced       |
| `created_at`  | DATETIME| DEFAULT CURRENT_TIMESTAMP    | DB Insert timestamp                          |

Table Name: `custom_categories`

| Column Name   | Type    | Constraint                    | Description                                  |
|---------------|---------|-------------------------------|----------------------------------------------|
| `id`          | INTEGER | PRIMARY KEY AUTOINCREMENT     | Category ID                                  |
| `name`        | TEXT    | UNIQUE NOT NULL               | Category Name                                |
| `icon`        | TEXT    | NULLABLE                      | Emoji / Icon String                          |
| `color`       | TEXT    | NULLABLE                      | Hex color code                               |

---

## 3. Step-by-Step Google Apps Script Setup (Phase 3)

1. Open a new Google Sheet at [sheets.new](https://sheets.new).
2. Rename the Google Sheet to `My Expense Tracker`.
3. In the top menu, click **Extensions** -> **Apps Script**.
4. Erase all default code in `Code.gs` and paste the exact contents of `GoogleAppsScript.gs` (provided in this project repository).
5. Click **Save** (💾 icon).
6. Deploy Web App Endpoint:
   - Click **Deploy** -> **New deployment**.
   - Select type: **Web app**.
   - Set **Description**: `Zero Friction Expense Backend`.
   - Set **Execute as**: `Me`.
   - Set **Who has access**: `Anyone`.
   - Click **Deploy** and authorize permissions.
   - Copy the generated **Web App URL** (e.g. `https://script.google.com/macros/s/.../exec`).
7. Enable Sunday Email Trigger:
   - In the Apps Script dropdown menu, select `setupWeeklyTrigger`.
   - Click **Run**.
   - This sets an automated cron trigger every Sunday at 8:00 AM to send a weekly summary email to your Google email.
8. Paste the Web App URL into the React Native app by opening **⚙️ Script URL** in the app header!

---

## 4. Hardware Button & Deep Link Configuration (Phase 4)

### Deep Link URL Scheme
The app listens for: `exp-tracker://quick-log`

### Android (Samsung Side Key / Power Button / Bixby Routines)
1. **Direct Side Key Mapping**:
   - Go to **Settings** -> **Advanced Features** -> **Side Key**.
   - Enable **Double press** -> Select **Open app** -> Select **Zero Friction Expense**.
2. **Advanced Intent Launch (Bixby Routines / MacroDroid / Tasker)**:
   - Trigger: Hardware Button double-press or Shake Device.
   - Action: Open URL / Web Link -> `exp-tracker://quick-log`.

### iOS (iPhone Action Button / Back Tap)
1. Open the Apple **Shortcuts** app on iOS.
2. Tap **+** to create a new shortcut.
3. Add action: **Open URL**.
4. Set URL to: `exp-tracker://quick-log`.
5. Save the shortcut as `Quick Expense`.
6. Go to **Settings** -> **Action Button** (on iPhone 15 Pro/16) or **Settings** -> **Accessibility** -> **Touch** -> **Back Tap** -> **Double Tap**.
7. Assign the **Quick Expense** shortcut. Now double tapping or pressing the Action Button instantly presents the bottom sheet modal!
