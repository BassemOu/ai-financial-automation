# Invoice workflow

- Users: initial group of two Finance administrators; integrations are SharePoint, Azure AI Document Intelligence, Power Automate, and Teams/email.
- Folder-driven lanes: petty cash `/InvoiceInbox/PettyCash/`; credit card `/InvoiceInbox/CreditCard/`. Never infer lane from AI output alone.
- Flow: scan/upload PDF/image → SharePoint new-file trigger → trained KU invoice model → field/confidence result → side-by-side Finance review/edit → approve/reject → matching tracking store → automatic calculations → tagged archive → notification.
- Extract vendor/supplier, invoice date/number, line-item description/quantity/unit price, total, tax/VAT, currency, category, and confidence for every field.
- Below 85% confidence on any required field must visibly flag manual review. Processing begins within five minutes; incomplete reviews escalate after 24 hours.
- Only Finance-approved entries post. Approved entries alone update running balance/total, VAT total, and month-to-date balance. Archive metadata: vendor, date, amount, invoice type; retain source-document links and a complete audit trail.