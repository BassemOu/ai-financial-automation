// Called by a secured Power Automate flow after Azure AI Document Intelligence finishes.
// Deploy with `supabase functions deploy ingest-invoice --no-verify-jwt` only after
// setting a separate shared webhook secret and validating it below.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Content-Type': 'application/json' }

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })

  const expectedSecret = Deno.env.get('POWER_AUTOMATE_WEBHOOK_SECRET')
  if (!expectedSecret || request.headers.get('x-webhook-secret') !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const payload = await request.json()
  const invoiceType = payload.invoice_type
  if (invoiceType !== 'petty_cash' && invoiceType !== 'credit_card') {
    return new Response(JSON.stringify({ error: 'invoice_type must be petty_cash or credit_card' }), { status: 400, headers: corsHeaders })
  }

  const fields = payload.fields ?? {}
  const hasLowConfidence = Object.values(fields).some((field: unknown) => {
    const confidence = (field as { confidence?: number }).confidence
    return typeof confidence === 'number' && confidence < 85
  })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: invoice, error } = await supabase.from('invoices').insert({
    invoice_type: invoiceType,
    status: 'needs_review',
    source_file_name: payload.source_file_name,
    source_document_url: payload.source_document_url,
    vendor_name: fields.vendor?.value,
    invoice_number: fields.invoice_number?.value,
    invoice_date: fields.invoice_date?.value || null,
    category: fields.category?.value,
    currency: fields.currency?.value ?? 'KWD',
    total_amount: fields.total_amount?.value || null,
    vat_amount: fields.vat_amount?.value || null,
  }).select('id').single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 422, headers: corsHeaders })

  await supabase.from('invoice_extractions').insert({
    invoice_id: invoice.id,
    model_id: payload.model_id ?? 'azure-document-intelligence',
    raw_response: payload.raw_response ?? {},
    fields,
    has_low_confidence: hasLowConfidence,
  })
  await supabase.from('invoice_audit_events').insert({ invoice_id: invoice.id, event_type: 'extraction_received', details: { has_low_confidence: hasLowConfidence } })

  return new Response(JSON.stringify({ invoice_id: invoice.id, status: 'needs_review', has_low_confidence: hasLowConfidence }), { status: 201, headers: corsHeaders })
})
