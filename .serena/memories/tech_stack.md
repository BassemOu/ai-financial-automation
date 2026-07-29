# Tech stack

- Application root: `Code/`.
- Frontend: React 19 + TypeScript + Vite 8 + Tailwind CSS 4; UI utilities: Lucide React, React Hook Form, Zod, and TanStack Query.
- Backend foundation: Supabase PostgreSQL, Auth, Row Level Security, and Edge Functions. Schema migration: `Code/supabase/migrations/0001_initial_financial_automation.sql`; secure Power Automate ingestion function: `Code/supabase/functions/ingest-invoice/index.ts`.
- Deployment target: Vercel frontend + hosted Supabase. Future workflow integrations: Power Automate Cloud Flows, SharePoint, Azure AI Document Intelligence, and Teams/email.
- Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the React app intentionally runs local demo authentication and mock invoice data. Do not use demo mode for production.