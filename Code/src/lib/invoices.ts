import { supabase } from './supabase'
import type { Invoice, InvoiceLineItem, InvoiceStatus, InvoiceType } from '../types'

interface InvoiceRow {
  id: string
  invoice_type: InvoiceType
  status: string
  vendor_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  category: string | null
  currency: string
  total_amount: string | null
  vat_amount: string | null
  received_at: string
  source_file_name: string
  source_document_url: string | null
  archive_url: string | null
  invoice_extractions: { fields: Record<string, { value: string; confidence: number }> }[]
  invoice_line_items: { id: string; description: string; description_confidence: number; quantity: string; quantity_confidence: number; unit_price: string; unit_price_confidence: number }[]
}

function mapStatus(status: string): InvoiceStatus {
  if (status === 'received' || status === 'extracting') return 'needs_review'
  if (status === 'posted' || status === 'archived') return 'approved'
  return status as InvoiceStatus
}

function mapRow(row: InvoiceRow): Invoice {
  const fields = row.invoice_extractions[0]?.fields ?? {}
  const field = (key: string, dbValue: string | null) => ({ value: dbValue ?? fields[key]?.value ?? '', confidence: fields[key]?.confidence ?? 90 })
  const lineItems: InvoiceLineItem[] = row.invoice_line_items.map((item) => ({
    id: item.id,
    description: item.description,
    descriptionConfidence: item.description_confidence,
    quantity: Number(item.quantity),
    quantityConfidence: item.quantity_confidence,
    unitPrice: Number(item.unit_price),
    unitPriceConfidence: item.unit_price_confidence,
  }))

  return {
    id: row.id,
    invoiceType: row.invoice_type,
    status: mapStatus(row.status),
    vendor: field('vendor', row.vendor_name),
    invoiceNumber: field('invoice_number', row.invoice_number),
    invoiceDate: field('invoice_date', row.invoice_date),
    category: field('category', row.category),
    currency: field('currency', row.currency),
    totalAmount: field('total_amount', row.total_amount),
    vatAmount: field('vat_amount', row.vat_amount),
    lineItems,
    receivedAt: row.received_at,
    sourceFileName: row.source_file_name,
    sourceDocumentUrl: row.source_document_url ?? undefined,
    archiveUrl: row.archive_url ?? undefined,
  }
}

export async function fetchInvoices(): Promise<Invoice[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_extractions(fields), invoice_line_items(*)')
    .order('received_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as InvoiceRow[]).map(mapRow)
}

export async function fetchAuditEvents(invoiceId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('invoice_audit_events')
    .select('event_type, created_at')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data.map((event) => `${event.event_type.replace(/_/g, ' ')} at ${new Date(event.created_at).toLocaleString()}`)
}

const draftColumns = {
  vendor: 'vendor_name',
  invoiceNumber: 'invoice_number',
  invoiceDate: 'invoice_date',
  category: 'category',
  currency: 'currency',
  totalAmount: 'total_amount',
  vatAmount: 'vat_amount',
} as const

export async function saveInvoiceDraft(invoice: Invoice): Promise<void> {
  if (!supabase) return
  const update: Record<string, string> = {}
  for (const [field, column] of Object.entries(draftColumns)) update[column] = invoice[field as keyof typeof draftColumns].value
  const { error } = await supabase.from('invoices').update(update).eq('id', invoice.id)
  if (error) throw new Error(error.message)

  await supabase.from('invoice_line_items').delete().eq('invoice_id', invoice.id)
  if (invoice.lineItems.length > 0) {
    const { error: lineItemError } = await supabase.from('invoice_line_items').insert(
      invoice.lineItems.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        description_confidence: item.descriptionConfidence,
        quantity: item.quantity,
        quantity_confidence: item.quantityConfidence,
        unit_price: item.unitPrice,
        unit_price_confidence: item.unitPriceConfidence,
      })),
    )
    if (lineItemError) throw new Error(lineItemError.message)
  }
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('You must be signed in to do this')

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? `${name} failed`)
  return result as T
}

export async function submitReview(invoiceId: string, decision: 'approved' | 'rejected', correctedFields: Record<string, string>, rejectionReason?: string): Promise<void> {
  await callFunction('review-invoice', { invoice_id: invoiceId, decision, corrected_fields: correctedFields, rejection_reason: rejectionReason })
}

export async function uploadInvoiceDocument(file: File, invoiceType: InvoiceType): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('You must be signed in to upload an invoice')

  const storagePath = `${userId}/${crypto.randomUUID()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from('invoice-documents').upload(storagePath, file)
  if (uploadError) throw new Error(uploadError.message)

  const result = await callFunction<{ invoice_id: string }>('extract-invoice', { storage_path: storagePath, invoice_type: invoiceType, source_file_name: file.name })
  return result.invoice_id
}
