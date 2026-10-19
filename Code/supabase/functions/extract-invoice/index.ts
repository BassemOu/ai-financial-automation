// Authenticated endpoint: uploads are analyzed live by Azure AI Document Intelligence.
// Requires AZURE_DOC_INTEL_ENDPOINT and AZURE_DOC_INTEL_KEY secrets to be set.
import { createClient } from '@supabase/supabase-js'

const jsonHeaders = { 'Content-Type': 'application/json' }
const API_VERSION = '2024-11-30'

interface AzureField {
  valueString?: string
  valueDate?: string
  valueCurrency?: { amount?: number; currencyCode?: string }
  valueArray?: { valueObject?: Record<string, AzureField> }[]
  content?: string
  confidence?: number
}

function pct(field: AzureField | undefined) {
  return field?.confidence ? Math.round(field.confidence * 100) : 70
}

function textValue(field: AzureField | undefined) {
  return field?.valueString ?? field?.content ?? ''
}

async function analyzeWithAzure(endpoint: string, key: string, documentUrl: string) {
  const analyzeResponse = await fetch(`${endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=${API_VERSION}`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ urlSource: documentUrl }),
  })
  if (!analyzeResponse.ok) throw new Error(`Azure analyze request failed: ${analyzeResponse.status} ${await analyzeResponse.text()}`)

  const operationLocation = analyzeResponse.headers.get('operation-location')
  if (!operationLocation) throw new Error('Azure did not return an operation-location header')

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const pollResponse = await fetch(operationLocation, { headers: { 'Ocp-Apim-Subscription-Key': key } })
    const result = await pollResponse.json()
    if (result.status === 'succeeded') return result.analyzeResult
    if (result.status === 'failed') throw new Error(`Azure analysis failed: ${JSON.stringify(result.error ?? result)}`)
  }
  throw new Error('Azure analysis timed out')
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders })

  const azureEndpoint = Deno.env.get('AZURE_DOC_INTEL_ENDPOINT')
  const azureKey = Deno.env.get('AZURE_DOC_INTEL_KEY')
  if (!azureEndpoint || !azureKey) {
    return new Response(JSON.stringify({ error: 'Azure AI Document Intelligence is not configured on this project' }), { status: 503, headers: jsonHeaders })
  }

  const body = await request.json()
  const { storage_path: storagePath, invoice_type: invoiceType, source_file_name: sourceFileName } = body
  if (!storagePath || (invoiceType !== 'petty_cash' && invoiceType !== 'credit_card') || !sourceFileName) {
    return new Response(JSON.stringify({ error: 'storage_path, invoice_type, and source_file_name are required' }), { status: 400, headers: jsonHeaders })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: signedUrlData, error: signedUrlError } = await admin.storage.from('invoice-documents').createSignedUrl(storagePath, 3600)
  if (signedUrlError || !signedUrlData) return new Response(JSON.stringify({ error: signedUrlError?.message ?? 'Unable to read uploaded document' }), { status: 422, headers: jsonHeaders })

  let analyzeResult: { documents?: { fields?: Record<string, AzureField> }[] }
  try {
    analyzeResult = await analyzeWithAzure(azureEndpoint, azureKey, signedUrlData.signedUrl)
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Azure extraction failed' }), { status: 502, headers: jsonHeaders })
  }

  const azureFields = analyzeResult.documents?.[0]?.fields ?? {}
  const currency = azureFields.InvoiceTotal?.valueCurrency?.currencyCode ?? 'KWD'
  const fields = {
    vendor: { value: textValue(azureFields.VendorName), confidence: pct(azureFields.VendorName) },
    invoice_number: { value: textValue(azureFields.InvoiceId), confidence: pct(azureFields.InvoiceId) },
    invoice_date: { value: azureFields.InvoiceDate?.valueDate ?? '', confidence: pct(azureFields.InvoiceDate) },
    category: { value: 'Uncategorized', confidence: 70 },
    currency: { value: currency, confidence: 99 },
    total_amount: { value: String(azureFields.InvoiceTotal?.valueCurrency?.amount ?? 0), confidence: pct(azureFields.InvoiceTotal) },
    vat_amount: { value: String(azureFields.TotalTax?.valueCurrency?.amount ?? 0), confidence: pct(azureFields.TotalTax) },
  }
  const lineItems = (azureFields.Items?.valueArray ?? []).map((item) => {
    const object = item.valueObject ?? {}
    return {
      description: textValue(object.Description),
      description_confidence: pct(object.Description),
      quantity: object.Quantity?.content ? Number(object.Quantity.content) || 1 : 1,
      quantity_confidence: pct(object.Quantity),
      unit_price: object.UnitPrice?.valueCurrency?.amount ?? 0,
      unit_price_confidence: pct(object.UnitPrice),
    }
  })

  const hasLowConfidence = Object.values(fields).some((field) => field.confidence < 85) || lineItems.some((item) => item.description_confidence < 85 || item.quantity_confidence < 85 || item.unit_price_confidence < 85)

  const { data: invoice, error: insertError } = await admin.from('invoices').insert({
    invoice_type: invoiceType,
    status: 'needs_review',
    source_file_name: sourceFileName,
    source_document_url: signedUrlData.signedUrl,
    vendor_name: fields.vendor.value,
    invoice_number: fields.invoice_number.value,
    invoice_date: fields.invoice_date.value || null,
    category: fields.category.value,
    currency: fields.currency.value,
    total_amount: fields.total_amount.value,
    vat_amount: fields.vat_amount.value,
  }).select('id').single()
  if (insertError) return new Response(JSON.stringify({ error: insertError.message }), { status: 422, headers: jsonHeaders })

  await admin.from('invoice_extractions').insert({ invoice_id: invoice.id, model_id: 'azure-prebuilt-invoice', raw_response: analyzeResult, fields, has_low_confidence: hasLowConfidence })
  if (lineItems.length > 0) {
    await admin.from('invoice_line_items').insert(lineItems.map((item) => ({
      invoice_id: invoice.id,
      description: item.description,
      description_confidence: item.description_confidence,
      quantity: item.quantity,
      quantity_confidence: item.quantity_confidence,
      unit_price: item.unit_price,
      unit_price_confidence: item.unit_price_confidence,
    })))
  }
  await admin.from('invoice_audit_events').insert({ invoice_id: invoice.id, actor_id: userData.user.id, event_type: 'extraction_received', details: { has_low_confidence: hasLowConfidence, model_id: 'azure-prebuilt-invoice' } })

  return new Response(JSON.stringify({ invoice_id: invoice.id, status: 'needs_review', has_low_confidence: hasLowConfidence }), { status: 201, headers: jsonHeaders })
})
