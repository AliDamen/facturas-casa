# Facturas de Casa

Monthly tracker for household bills, compared month by month.

## Files

- `index.html` – page structure
- `style.css` – look and layout (light and dark mode)
- `app.js` – all the logic: totals, comparison, add/remove, backup

## Run it

1. Open this folder in VS Code (**File → Open Folder**).
2. Easiest: install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.
   Or just double-click `index.html` to open it in your browser.

## How to use

- October 2026 is already loaded (5 receipts, 267,92 €).
- Add new bills with the form. Amounts can be written as `59,05` or `59.05`.
- Remove a bill with ✕ (click twice to confirm).
- The **Month by month** table shows each provider per month plus the total.

## Where the data lives

Bills are stored in your browser (localStorage), on this computer only.
Use **Export backup** regularly, and **Import backup** to restore or move to another computer.

To add more starting data, edit `SEED_BILLS` at the top of `app.js`
(it is only used the first time the app opens).
