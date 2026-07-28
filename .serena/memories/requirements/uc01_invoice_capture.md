# UC-01 — Invoice Data Capture and Financial Sheet Automation

- **Priority:** High. Direct actors: Finance Admin Staff (two users), Azure AI Document Intelligence, Power Automate, SharePoint petty-cash/credit-card tracking sheets. Trigger: a paper scan or digital PDF reaches the invoice inbox/shared folder.
- **Current problem:** Finance manually reads vendor, date, amount, description, and category from petty-cash and credit-card invoices into separate tracking sheets. About 12 hours/week per sheet, 24 hours/week total; susceptible to entry/calculation errors.
- **Primary flow:**
  1. Staff scan paper invoices through mobile scanning/Power Apps camera flow or save digital PDFs to the designated SharePoint invoice inbox.
  2. Power Automate detects the new file and routes by folder: `Petty Cash Invoices` vs `Credit Card Invoices`.
  3. Azure AI Document Intelligence processes PDF/image with a custom KU-trained invoice model; extracts vendor/supplier, invoice date/number, line-item description/quantity/unit price, total, tax, currency, and KU-specific custom fields.
  4. Power Automate adds a row to the matching SharePoint/Excel tracking sheet, maps extracted fields to sheet columns, calculates running totals/balance, and attaches a source-invoice link.
  5. Finance receives a Teams/email notification listing added rows for review/approval.
  6. Staff compare AI data to invoice in a review interface, approve correct records or edit errors.
  7. Approved records lock in the tracking sheet; low-confidence AI extraction is flagged for manual review.
- **Expected outcome:** petty-cash and credit-card sheets populated from invoice data; totals/balance automatic; invoice link retained; manual work reduced from about 24 to about two hours/week of exception review; no manual calculation/formula entry; month-end reporting can consume the tracking-sheet data (feeds UC-02).
- **Notes/dependencies:** Azure AI Document Intelligence procurement; likely Power Automate premium connector depending on M365 license; SharePoint site/folders and tracking sheets; model training set around 20–30 KU sample invoices per category; confirm with DPO that this is financial operational rather than personal data.