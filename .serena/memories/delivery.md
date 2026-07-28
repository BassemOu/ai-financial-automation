# Dependencies and delivery

- Azure AI Document Intelligence subscription and KU-specific custom model are required; collect at least 20 petty-cash and 20 credit-card invoice samples.
- Power Automate may require a premium connector. SharePoint provides inbox/archive and possibly tracking storage; Teams/email handles notifications/escalation.
- Outstanding decisions: SharePoint List vs Excel Online tracking store; frontend/backend/API/database/auth stack; schema/line-item/category mapping; VAT/currency/rounding; retention/naming/permissions; escalation ownership; file constraints, retry/manual recovery and duplicate policies; DPO confirmation of data classification.
- Suggested sequence: confirm decisions → collect/label samples → define tracking schema/calculations and fixtures → mock frontend review flow in `Code/` → API/domain/audit model → Microsoft/Azure adapters → test low-confidence, invalid, duplicate, failed, rejected, and overdue scenarios.
- First-release acceptance: separate lanes; complete field/confidence extraction; low-confidence flagging; side-by-side review; approved-only posting; automated totals; metadata archive; tracking row traceable to source and decision.