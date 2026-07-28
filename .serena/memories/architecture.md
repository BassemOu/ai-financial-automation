# Architecture and invariants

- Logical shape: frontend review app → application API → workflow/audit persistence; SharePoint inbox/archive → automation/workflow adapter → Azure AI Document Intelligence → API; API adapters for tracking store and Teams/email.
- Keep external integrations behind replaceable adapters.
- Domain records: Invoice (source/type/status/timestamps/archive ref), Extraction (model/raw result/confidence/line items/error), Review (proposed/final values/decision/reviewer/rejection/escalation), Posting (target ref/time/calculation version), immutable Audit Event.
- Status progression: `received → extracting → needs_review → approved → posted → archived`; exception states include `rejected`, `failed`, `escalated`. Low confidence is a review flag, not terminal.
- Safety rules: no post before approval; source + original extraction + corrections + decision must be traceable; validate dates/amounts/currency/VAT/invoice format before approval when rules exist; failures visible/retryable; design duplicate detection from invoice number/vendor/amount/date/type.