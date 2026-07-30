export type InvoiceType = 'petty_cash' | 'credit_card'
export type InvoiceStatus = 'needs_review' | 'approved' | 'rejected' | 'failed' | 'escalated'

export interface InvoiceLineItem {
  id: string
  description: string
  descriptionConfidence: number
  quantity: number
  quantityConfidence: number
  unitPrice: number
  unitPriceConfidence: number
}

export interface InvoiceField {
  value: string
  confidence: number
}

export interface Invoice {
  id: string
  invoiceType: InvoiceType
  status: InvoiceStatus
  vendor: InvoiceField
  invoiceNumber: InvoiceField
  invoiceDate: InvoiceField
  category: InvoiceField
  currency: InvoiceField
  totalAmount: InvoiceField
  vatAmount: InvoiceField
  lineItems: InvoiceLineItem[]
  receivedAt: string
  sourceFileName: string
  sourceDocumentUrl?: string
  archiveUrl?: string
  assignedTo?: string
  notes?: string
}

export interface FinanceUser {
  id: string
  email: string
  name: string
  role: 'finance_admin' | 'reviewer'
}
