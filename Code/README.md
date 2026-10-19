# Financial Automation

Frontend-first invoice review application for petty-cash and credit-card invoices. It implements the UI/workflow required by UC-01 while Azure AI Document Intelligence, Power Automate, and SharePoint remain unconnected.

## Stack

- React 19, TypeScript, and Vite
- Tailwind CSS
- React Hook Form + Zod
- Supabase Auth, PostgreSQL, and Edge Functions (ready to configure)
- Local demo mode when Supabase environment variables are absent

## Run locally

**Prerequisite:** Node.js and npm. This project was created and tested with Node `26.5.0` and npm `11.17.0` on macOS.

```sh
cd Code
npm install
npm run dev
```

Open the local URL Vite prints, normally `http://localhost:5173`.

## Demo accounts

Until Supabase is configured, sign in using either account:

| Role | Email | Password |
|---|---|---|
| Finance administrator | `finance.admin@demo.com` | `Demo123!` |
| Finance reviewer | `reviewer@demo.com` | `Demo123!` |

Registration works locally too. Local demo users and the active session are stored only in the browser's `localStorage`; they are not real accounts and must not be used for production.

## Current demo capabilities

- Login and registration screen
- Invoice review queue with petty-cash and credit-card lanes
- Low-confidence (below 85%) and overdue-review indicators
- Side-by-side simulated document evidence and editable AI extraction fields, including line-item description, quantity, and unit price
- Field-level confidence for invoice and line-item values, with below-85% review flags
- Save-draft, audit-history, approve, and reject actions that update the dashboard locally
- Approved-record tracking view with VAT, month-to-date, and running-balance calculations
- Supabase schema plus secure ingestion and authenticated review-function scaffolds
- When Supabase and Azure AI Document Intelligence are configured: direct invoice upload, live extraction via `extract-invoice`, and real persistence of invoices, drafts, approvals, and audit events

SharePoint links, Power Automate intake, notifications, and posting to the SharePoint tracker are still pending integrations. The UI does not claim those services are connected.

## Configure Supabase later

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Apply `supabase/migrations/0001_initial_financial_automation.sql` and `supabase/migrations/0002_invoice_documents_storage.sql` in the Supabase SQL Editor, or use the Supabase CLI migration workflow.
4. In Supabase Authentication, enable the desired sign-in provider. Email/password is sufficient for initial development; use KU Microsoft/Azure AD SSO if required later.
5. Add RLS role management before any production use. The initial policies are deliberately broad for an internal prototype and must be reviewed with the Finance/KU security owner.
6. Deploy `supabase/functions/review-invoice` with standard JWT verification for authenticated Finance approvals.
7. For live AI extraction, create an Azure AI Document Intelligence resource, then deploy `supabase/functions/extract-invoice` and set its `AZURE_DOC_INTEL_ENDPOINT` and `AZURE_DOC_INTEL_KEY` secrets. This enables the in-app "Upload invoice" action.
8. For the future Power Automate/SharePoint intake, deploy `supabase/functions/ingest-invoice` and set the `POWER_AUTOMATE_WEBHOOK_SECRET` secret. Never expose any of these secrets, Azure keys, or the Supabase service-role key in the Vite frontend.

### Optional Supabase CLI on macOS

The app does not need the CLI to run in demo mode. Install it later if you want local Supabase development, migration deployment, or Edge Function deployment:

```sh
brew install supabase/tap/supabase
supabase login
```

Running Supabase fully locally also requires Docker Desktop. You can use a hosted Supabase project instead and skip Docker initially.

## Available commands

```sh
npm run dev      # Start Vite development server
npm run build               # Type-check frontend and create a production build
npm run typecheck:functions # Type-check Supabase Edge Functions with Deno runtime declarations
npm run lint                # Run Oxlint
npm run preview  # Preview a production build
```

## Next integrations

1. ~~Replace demo invoice data with Supabase queries.~~ Done when Supabase is configured.
2. ~~Wire approvals, reviews, and audit events to Supabase.~~ Done when Supabase is configured.
3. ~~Connect live extraction to Azure AI Document Intelligence.~~ Done via `extract-invoice` when Azure is configured.
4. Create Power Automate cloud flows for SharePoint inbox triggers, as an alternative intake path to direct upload.
5. Send normalized extraction output to the secure Supabase `ingest-invoice` Edge Function.
6. Post approved entries to the confirmed SharePoint List/Excel tracking store, archive source files, and send Teams/email notifications.
