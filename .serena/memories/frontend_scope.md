# Frontend-first scope

- Build the review experience before live integrations; use realistic mocks but never imply Azure extraction/posting/archive completion without backend confirmation. The initial React implementation exists in `Code/src/App.tsx` and labels document previews, archive links, and AI connection as demo/pending.
- Review queue: pending, low-confidence, overdue, approved, rejected counts; filters for invoice type/status/confidence/vendor/date/overdue.
- Invoice review workspace: PDF/image evidence beside editable structured fields; field confidence badges and warnings; editable line items/totals; validation; save draft, approve, reject, audit-history actions.
- Tracking/reporting: approved-only data; running total, VAT, month-to-date views; searchable source-archive link.
- Operational exceptions: failed processing, duplicate candidates, low-confidence cases, and impending/escalated 24-hour reviews.
- Maintain a clear visual distinction between petty-cash and credit-card records.