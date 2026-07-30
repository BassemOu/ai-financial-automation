// Authenticated Finance review endpoint.
// Keep this function JWT-protected (the Supabase default); do not deploy with --no-verify-jwt.
import { createClient } from '@supabase/supabase-js'

const jsonHeaders = { 'Content-Type': 'application/json' }
const editableColumns = {
  vendor: 'vendor_name',
  invoiceNumber: 'invoice_number',
  invoiceDate: 'invoice_date',
  category: 'category',
  currency: 'currency',
  totalAmount: 'total_amount',
  vatAmount: 'vat_amount',
} as const

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders })
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })

  const body = await request.json()
  if (!body.invoice_id || !['approved', 'rejected'].includes(body.decision)) {
    return new Response(JSON.stringify({ error: 'invoice_id and approved/rejected decision are required' }), { status: 400, headers: jsonHeaders })
  }
  if (body.decision === 'rejected' && !body.rejection_reason?.trim()) {
    return new Response(JSON.stringify({ error: 'A rejection reason is required' }), { status: 400, headers: jsonHeaders })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).single()
  if (!profile || !['finance_admin', 'reviewer'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Finance reviewer role required' }), { status: 403, headers: jsonHeaders })
  }

  const { data: existing, error: lookupError } = await admin.from('invoices').select('id,status').eq('id', body.invoice_id).single()
  if (lookupError || !existing) return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404, headers: jsonHeaders })
  if (!['needs_review', 'escalated'].includes(existing.status)) {
    return new Response(JSON.stringify({ error: 'This invoice is no longer awaiting review' }), { status: 409, headers: jsonHeaders })
  }

  const correctedFields = body.corrected_fields ?? {}
  const update: Record<string, unknown> = {
    status: body.decision,
    approved_at: body.decision === 'approved' ? new Date().toISOString() : null,
    approved_by: body.decision === 'approved' ? userData.user.id : null,
  }
  for (const [field, column] of Object.entries(editableColumns)) {
    if (typeof correctedFields[field] === 'string') update[column] = correctedFields[field].trim() || null
  }

  const { error: updateError } = await admin.from('invoices').update(update).eq('id', body.invoice_id)
  if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 422, headers: jsonHeaders })

  const { error: reviewError } = await admin.from('invoice_reviews').insert({
    invoice_id: body.invoice_id,
    reviewer_id: userData.user.id,
    decision: body.decision,
    corrected_fields: correctedFields,
    rejection_reason: body.decision === 'rejected' ? body.rejection_reason.trim() : null,
  })
  if (reviewError) return new Response(JSON.stringify({ error: reviewError.message }), { status:422, headers: jsonHeaders })

  await admin.from('invoice_audit_events').insert({
    invoice_id: body.invoice_id,
    actor_id: userData.user.id,
    event_type: `review_${body.decision}`,
    details: { corrected_fields: correctedFields, rejection_reason: body.rejection_reason ?? null },
  })

  return new Response(JSON.stringify({ invoice_id: body.invoice_id, status: body.decision }), { status: 200, headers: jsonHeaders })
})
