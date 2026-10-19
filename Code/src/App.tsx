import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileSearch,
  Filter,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { demoInvoices } from './data/demoData'
import { currentDemoUser, demoAccountDetails, register, signIn, signOut } from './lib/demoAuth'
import { fetchAuditEvents, fetchInvoices, saveInvoiceDraft, submitReview, uploadInvoiceDocument } from './lib/invoices'
import { isSupabaseConfigured } from './lib/supabase'
import type { FinanceUser, Invoice, InvoiceLineItem, InvoiceStatus, InvoiceType } from './types'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

const registrationSchema = z.object({
  name: z.string().min(2, 'Enter your full name.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

type LoginValues = z.infer<typeof loginSchema>
type RegistrationValues = z.infer<typeof registrationSchema>
type Screen = 'queue' | 'tracking'

const statusStyles: Record<InvoiceStatus, string> = {
  needs_review: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
  failed: 'bg-rose-50 text-rose-800 ring-rose-200',
  escalated: 'bg-violet-50 text-violet-800 ring-violet-200',
}

const statusLabels: Record<InvoiceStatus, string> = {
  needs_review: 'Needs review',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
  escalated: 'Escalated',
}

function confidenceClass(confidence: number) {
  if (confidence < 85) return 'bg-rose-50 text-rose-700 ring-rose-200'
  if (confidence < 92) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
}

function typeLabel(type: InvoiceType) {
  return type === 'petty_cash' ? 'Petty cash' : 'Credit card'
}

function hasLowConfidence(invoice: Invoice) {
  const documentFields = [invoice.vendor, invoice.invoiceNumber, invoice.invoiceDate, invoice.category, invoice.currency, invoice.totalAmount, invoice.vatAmount]
  const lineItemFields = invoice.lineItems.flatMap((item) => [item.descriptionConfidence, item.quantityConfidence, item.unitPriceConfidence])
  return documentFields.some((field) => field.confidence < 85) || lineItemFields.some((confidence) => confidence < 85)
}

function formatMoney(amount: string, currency = 'KWD') {
  return `${currency} ${Number(amount).toLocaleString('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
}

function App() {
  const [user, setUser] = useState<FinanceUser | null>(() => currentDemoUser())

  return user ? <Dashboard user={user} onSignOut={() => void signOut().then(() => setUser(null))} /> : <AuthScreen onAuthenticated={setUser} />
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: FinanceUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [message, setMessage] = useState<string | null>(null)
  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const registerForm = useForm<RegistrationValues>({ resolver: zodResolver(registrationSchema), defaultValues: { name: '', email: '', password: '' } })

  async function submitLogin(values: LoginValues) {
    setMessage(null)
    try {
      onAuthenticated(await signIn(values.email, values.password))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in.')
    }
  }

  async function submitRegistration(values: RegistrationValues) {
    setMessage(null)
    try {
      onAuthenticated(await register(values.name, values.email, values.password))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create account.')
    }
  }

  function signInWithDemo(email: string, password: string) {
    setMode('login')
    loginForm.setValue('email', email)
    loginForm.setValue('password', password)
    void submitLogin({ email, password })
  }

  const activeForm = mode === 'login' ? loginForm : registerForm

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-900 sm:px-6 lg:py-12">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/30 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative overflow-hidden bg-linear-to-br from-blue-800 via-blue-700 to-cyan-700 p-8 text-white sm:p-12">
          <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-blue-300/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-3 text-sm font-semibold tracking-wide text-cyan-100">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"><CircleDollarSign size={23} /></span>
              FINANCE OPERATIONS
            </div>
            <h1 className="mt-14 max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">Financial<br />Automation</h1>
            <p className="mt-5 max-w-md text-lg leading-8 text-blue-100">Turn invoices into reviewed financial records—automatically.</p>

            <div className="mt-12 space-y-4">
              {[
                ['Separate workflows', 'Petty cash and credit card invoices remain in their correct lanes.'],
                ['Human approval', 'Finance staff validate AI results before an entry is posted.'],
                ['Full traceability', 'Source files, confidence scores, edits, and approvals stay connected.'],
              ].map(([title, description]) => (
                <div className="flex gap-3" key={title}>
                  <ShieldCheck className="mt-0.5 shrink-0 text-cyan-200" size={20} />
                  <div><p className="font-semibold">{title}</p><p className="mt-0.5 text-sm leading-6 text-blue-100">{description}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
            <button onClick={() => { setMode('login'); setMessage(null) }} className={`flex-1 rounded-lg px-4 py-2.5 transition ${mode === 'login' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500'}`}>Sign in</button>
            <button onClick={() => { setMode('register'); setMessage(null) }} className={`flex-1 rounded-lg px-4 py-2.5 transition ${mode === 'register' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500'}`}>Register</button>
          </div>

          <div className="mt-9">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">{isSupabaseConfigured ? 'Secure workspace' : 'Local demo workspace'}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create your finance account'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{isSupabaseConfigured ? 'Sign in with your configured Supabase account.' : 'Supabase is not connected yet. Registration and demo login run locally in this browser.'}</p>
          </div>

          {message && <div className="mt-5 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"><AlertCircle size={18} className="shrink-0" />{message}</div>}

          {mode === 'login' ? (
            <form className="mt-7 space-y-4" onSubmit={loginForm.handleSubmit(submitLogin)}>
              <Field label="Email address" error={loginForm.formState.errors.email?.message}><input {...loginForm.register('email')} type="email" placeholder="you@example.com" /></Field>
              <Field label="Password" error={loginForm.formState.errors.password?.message}><input {...loginForm.register('password')} type="password" placeholder="••••••••" /></Field>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? 'Signing in…' : <>Sign in <ArrowRight size={18} /></>}
              </button>
            </form>
          ) : (
            <form className="mt-7 space-y-4" onSubmit={registerForm.handleSubmit(submitRegistration)}>
              <Field label="Full name" error={registerForm.formState.errors.name?.message}><input {...registerForm.register('name')} placeholder="Finance team member" /></Field>
              <Field label="Email address" error={registerForm.formState.errors.email?.message}><input {...registerForm.register('email')} type="email" placeholder="you@example.com" /></Field>
              <Field label="Password" error={registerForm.formState.errors.password?.message}><input {...registerForm.register('password')} type="password" placeholder="At least 8 characters" /></Field>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60" disabled={registerForm.formState.isSubmitting}>
                {registerForm.formState.isSubmitting ? 'Creating account…' : <>Create account <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {!isSupabaseConfigured && <div className="mt-8 border-t border-slate-200 pt-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Demo accounts</p><div className="mt-3 grid gap-2">{demoAccountDetails.map((account) => <button key={account.email} type="button" onClick={() => signInWithDemo(account.email, account.password)} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"><span><span className="block font-medium text-slate-800">{account.role === 'finance_admin' ? 'Finance administrator' : 'Finance reviewer'}</span><span className="text-xs text-slate-500">{account.email}</span></span><ChevronRight size={17} className="text-slate-400" /></button>)}</div><p className="mt-2 text-xs text-slate-500">Password for both: <code className="rounded bg-slate-100 px-1.5 py-0.5">Demo123!</code></p></div>}
          {Object.keys(activeForm.formState.errors).length > 0 && <p className="mt-4 text-xs text-rose-600">Please correct the highlighted fields.</p>}
        </section>
      </div>
    </main>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700"><span>{label}</span><span className="mt-1.5 block [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-slate-900 [&>input]:outline-none [&>input]:transition [&>input:focus]:border-blue-600 [&>input:focus]:ring-4 [&>input:focus]:ring-blue-100">{children}</span>{error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}</label>
}

function Dashboard({ user, onSignOut }: { user: FinanceUser; onSignOut: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>(demoInvoices)
  const [selectedId, setSelectedId] = useState(demoInvoices[0].id)
  const [screen, setScreen] = useState<Screen>('queue')
  const [typeFilter, setTypeFilter] = useState<'all' | InvoiceType>('all')
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [reviewEvents, setReviewEvents] = useState<Record<string, string[]>>({})
  const [uploading, setUploading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)

  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0]
  const [draft, setDraft] = useState(selected)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    fetchInvoices()
      .then((loaded) => {
        setInvoices(loaded)
        if (loaded[0]) {
          setSelectedId(loaded[0].id)
          setDraft(loaded[0])
        }
      })
      .catch((error) => setWorkspaceError(error instanceof Error ? error.message : 'Unable to load invoices'))
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    fetchAuditEvents(selectedId)
      .then((events) => setReviewEvents((current) => ({ ...current, [selectedId]: events })))
      .catch(() => {})
  }, [selectedId])

  function selectInvoice(invoice: Invoice) {
    setSelectedId(invoice.id)
    setDraft(invoice)
  }

  async function handleUpload(file: File, invoiceType: InvoiceType) {
    setUploading(true)
    setWorkspaceError(null)
    try {
      await uploadInvoiceDocument(file, invoiceType)
      const loaded = await fetchInvoices()
      setInvoices(loaded)
      const created = loaded.find((invoice) => invoice.sourceFileName === file.name) ?? loaded[0]
      if (created) selectInvoice(created)
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to extract this document')
    } finally {
      setUploading(false)
    }
  }

  const queue = useMemo(() => invoices.filter((invoice) => {
    const lowConfidence = hasLowConfidence(invoice)
    return (typeFilter === 'all' || invoice.invoiceType === typeFilter) && (!attentionOnly || lowConfidence || invoice.status === 'escalated') && `${invoice.vendor.value} ${invoice.invoiceNumber.value}`.toLowerCase().includes(search.toLowerCase())
  }), [attentionOnly, invoices, search, typeFilter])

  const metrics = {
    pending: invoices.filter((invoice) => invoice.status === 'needs_review').length,
    attention: invoices.filter((invoice) => invoice.status === 'escalated' || hasLowConfidence(invoice)).length,
    approved: invoices.filter((invoice) => invoice.status === 'approved').length,
    monthTotal: invoices.filter((invoice) => invoice.status === 'approved').reduce((sum, invoice) => sum + Number(invoice.totalAmount.value), 0),
  }

  function updateDraft(field: 'vendor' | 'invoiceNumber' | 'invoiceDate' | 'category' | 'currency' | 'totalAmount' | 'vatAmount', value: string) {
    setDraft((current) => ({ ...current, [field]: { ...current[field], value } }))
  }

  function saveDraft() {
    setInvoices((current) => current.map((invoice) => invoice.id === draft.id ? draft : invoice))
    setReviewEvents((current) => ({ ...current, [draft.id]: [...(current[draft.id] ?? []), `Draft saved at ${new Date().toLocaleTimeString()}`] }))
    if (isSupabaseConfigured) void saveInvoiceDraft(draft).catch((error) => setWorkspaceError(error instanceof Error ? error.message : 'Unable to save draft'))
  }

  function updateLineItem(index: number, field: keyof Pick<InvoiceLineItem, 'description' | 'quantity' | 'unitPrice'>, value: string) {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return field === 'description' ? { ...item, description: value } : { ...item, [field]: Number(value) || 0 }
      }),
    }))
  }

  function commit(status: 'approved' | 'rejected') {
    const rejectionReason = status === 'rejected' ? window.prompt('Reason for rejection?')?.trim() : undefined
    if (status === 'rejected' && !rejectionReason) return

    const updated = { ...draft, status }
    setInvoices((current) => current.map((invoice) => invoice.id === updated.id ? updated : invoice))
    setDraft(updated)
    setReviewEvents((current) => ({ ...current, [updated.id]: [...(current[updated.id] ?? []), `Invoice ${status} at ${new Date().toLocaleTimeString()}`] }))
    if (isSupabaseConfigured) {
      const correctedFields = { vendor: draft.vendor.value, invoiceNumber: draft.invoiceNumber.value, invoiceDate: draft.invoiceDate.value, category: draft.category.value, currency: draft.currency.value, totalAmount: draft.totalAmount.value, vatAmount: draft.vatAmount.value }
      void submitReview(draft.id, status, correctedFields, rejectionReason).catch((error) => setWorkspaceError(error instanceof Error ? error.message : 'Unable to submit review'))
    }
  }

  const tabButton = (target: Screen, icon: React.ReactNode, label: string) => <button onClick={() => setScreen(target)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${screen === target ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{icon}{label}</button>

  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-950 p-4 text-white transition-transform lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-3 px-2 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600"><CircleDollarSign size={21} /></span><span className="font-semibold tracking-tight">Financial Automation</span></div>
      <div className="mt-9 space-y-1">{tabButton('queue', <LayoutDashboard size={18} />, 'Review queue')}{tabButton('tracking', <ReceiptText size={18} />, 'Tracking & reports')}</div>
      <div className="mt-7 border-t border-white/10 pt-5"><p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workflow lanes</p><div className="mt-2 space-y-1 text-sm"><div className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-amber-400" />Petty cash</div><div className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300"><span className="h-2 w-2 rounded-full bg-cyan-400" />Credit card</div></div></div>
      <div className="mt-auto rounded-xl bg-white/5 p-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-bold">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-slate-400">{user.role.replace('_', ' ')}</p></div></div><button onClick={onSignOut} className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white"><LogOut size={14} /> Sign out</button></div>
    </aside>
    {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-slate-950/50 lg:hidden" onClick={() => setMenuOpen(false)} />}

    <main className="lg:pl-64">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6"><div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-600 lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><div><p className="text-sm font-semibold text-slate-900">{screen === 'queue' ? 'Invoice review queue' : 'Tracking & reporting'}</p><p className="text-xs text-slate-500">{isSupabaseConfigured ? 'Supabase connected' : 'Demo mode · no AI connection yet'}</p></div></div><div className="flex items-center gap-2 text-sm text-slate-500"><UserRound size={17} /><span className="hidden sm:inline">{user.email}</span></div></header>
      <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
        {screen === 'queue' ? <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Inbox size={20} />} label="Awaiting review" value={metrics.pending} tone="blue" detail="New invoice records" />
            <Metric icon={<AlertCircle size={20} />} label="Needs attention" value={metrics.attention} tone="amber" detail="Low confidence or overdue" />
            <Metric icon={<CheckCircle2 size={20} />} label="Approved this month" value={metrics.approved} tone="emerald" detail="Ready for tracking" />
            <Metric icon={<CircleDollarSign size={20} />} label="Approved spend" value={formatMoney(String(metrics.monthTotal))} tone="violet" detail="Demo approved records" />
          </section>

          {isSupabaseConfigured && <UploadInvoicePanel uploading={uploading} error={workspaceError} onUpload={handleUpload} onDismissError={() => setWorkspaceError(null)} />}

          <section className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.48fr]">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Review queue</h2><p className="mt-1 text-sm text-slate-500">AI-extracted records awaiting Finance approval.</p></div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{queue.length} shown</span></div><div className="mt-4 flex gap-2"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendor or invoice" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label><button onClick={() => setAttentionOnly((value) => !value)} className={`rounded-lg border px-3 text-sm font-medium ${attentionOnly ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600'}`}><Filter size={16} /></button></div><div className="mt-3 flex gap-2"><button onClick={() => setTypeFilter('all')} className={`rounded-full px-3 py-1 text-xs font-medium ${typeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button><button onClick={() => setTypeFilter('petty_cash')} className={`rounded-full px-3 py-1 text-xs font-medium ${typeFilter === 'petty_cash' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800'}`}>Petty cash</button><button onClick={() => setTypeFilter('credit_card')} className={`rounded-full px-3 py-1 text-xs font-medium ${typeFilter === 'credit_card' ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-800'}`}>Credit card</button></div></div>
              <div className="max-h-162.5 overflow-y-auto p-2">{queue.map((invoice) => <button key={invoice.id} onClick={() => selectInvoice(invoice)} className={`mb-1 w-full rounded-xl p-3 text-left transition ${selected.id === invoice.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${invoice.invoiceType === 'petty_cash' ? 'bg-amber-400' : 'bg-cyan-500'}`} /><p className="truncate text-sm font-semibold text-slate-800">{invoice.vendor.value}</p></div><p className="mt-1 text-xs text-slate-500">{invoice.invoiceNumber.value} · {invoice.sourceFileName}</p></div><StatusBadge status={invoice.status} /></div><div className="mt-3 flex items-end justify-between"><p className="text-sm font-semibold text-slate-800">{formatMoney(invoice.totalAmount.value, invoice.currency.value)}</p><p className="text-xs text-slate-400">{new Date(invoice.receivedAt).toLocaleDateString()}</p></div></button>)}</div>
            </div>
            <ReviewWorkspace invoice={draft} auditEvents={reviewEvents[draft.id] ?? ['Invoice received from the demo intake queue.']} onChange={updateDraft} onLineItemChange={updateLineItem} onSaveDraft={saveDraft} onApprove={() => commit('approved')} onReject={() => commit('rejected')} />
          </section>
        </> : <TrackingView invoices={invoices} />}
      </div>
    </main>
  </div>
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string | number; detail: string; tone: 'blue' | 'amber' | 'emerald' | 'violet' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700' }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span></div><p className="mt-3 text-xs text-slate-400">{detail}</p></div>
}

function UploadInvoicePanel({ uploading, error, onUpload, onDismissError }: { uploading: boolean; error: string | null; onUpload: (file: File, invoiceType: InvoiceType) => void; onDismissError: () => void }) {
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('petty_cash')

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onUpload(file, invoiceType)
  }

  return <section className="mt-6 rounded-2xl border border-dashed border-blue-300 bg-blue-50/40 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold text-slate-900">Upload an invoice for live AI extraction</p><p className="mt-1 text-xs text-slate-500">Runs Azure AI Document Intelligence and adds the result to the review queue.</p></div>
      <div className="flex items-center gap-2">
        <select value={invoiceType} onChange={(event) => setInvoiceType(event.target.value as InvoiceType)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="petty_cash">Petty cash</option><option value="credit_card">Credit card</option></select>
        <label className={`flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
          {uploading ? 'Extracting…' : 'Upload invoice'}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" disabled={uploading} onChange={handleFileChange} />
        </label>
      </div>
    </div>
    {error && <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"><span>{error}</span><button onClick={onDismissError} className="text-xs font-semibold underline">Dismiss</button></div>}
  </section>
}

function StatusBadge({ status }: { status: InvoiceStatus }) { return <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusStyles[status]}`}>{statusLabels[status]}</span> }

function ReviewWorkspace({ invoice, auditEvents, onChange, onLineItemChange, onSaveDraft, onApprove, onReject }: { invoice: Invoice; auditEvents: string[]; onChange: (field: 'vendor' | 'invoiceNumber' | 'invoiceDate' | 'category' | 'currency' | 'totalAmount' | 'vatAmount', value: string) => void; onLineItemChange: (index: number, field: keyof Pick<InvoiceLineItem, 'description' | 'quantity' | 'unitPrice'>, value: string) => void; onSaveDraft: () => void; onApprove: () => void; onReject: () => void }) {
  const fields: { field: 'vendor' | 'invoiceNumber' | 'invoiceDate' | 'category' | 'currency' | 'totalAmount' | 'vatAmount'; label: string }[] = [
    { field: 'vendor', label: 'Vendor / supplier' }, { field: 'invoiceNumber', label: 'Invoice number' }, { field: 'invoiceDate', label: 'Invoice date' }, { field: 'category', label: 'Category' }, { field: 'totalAmount', label: 'Total amount' }, { field: 'vatAmount', label: 'VAT amount' }, { field: 'currency', label: 'Currency' },
  ]
  const lowConfidence = fields.filter(({ field }) => invoice[field].confidence < 85)
  const hasLowConfidenceLineItem = invoice.lineItems.some((item) => [item.descriptionConfidence, item.quantityConfidence, item.unitPriceConfidence].some((confidence) => confidence < 85))
  const isActionable = invoice.status === 'needs_review' || invoice.status === 'escalated'

  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4"><div><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${invoice.invoiceType === 'petty_cash' ? 'bg-amber-400' : 'bg-cyan-500'}`} /><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{typeLabel(invoice.invoiceType)} invoice</p></div><h2 className="mt-1 text-lg font-semibold text-slate-900">{invoice.sourceFileName}</h2><p className="mt-1 text-sm text-slate-500">Review extracted fields against the source document.</p></div><StatusBadge status={invoice.status} /></div>
    {(lowConfidence.length > 0 || hasLowConfidenceLineItem) && <div className="mx-4 mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200"><AlertCircle className="mt-0.5 shrink-0" size={17} /><span><strong>Manual attention required.</strong> {lowConfidence.map(({ label }) => label).join(' and ')} {lowConfidence.length === 1 ? 'is' : 'are'} below the 85% confidence threshold.</span></div>}
    <div className="grid gap-5 p-4 2xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileSearch size={17} className="text-blue-700" /> Source document</div><span className="text-xs text-slate-400">Demo preview</span></div><div className="mt-4 aspect-[0.72] rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><span className="font-bold tracking-tight text-slate-800">{invoice.vendor.value}</span><ReceiptText size={22} className="text-blue-700" /></div><div className="mt-6 space-y-3 text-xs text-slate-500"><p className="flex justify-between"><span>Invoice no.</span><span className="font-medium text-slate-700">{invoice.invoiceNumber.value}</span></p><p className="flex justify-between"><span>Date</span><span className="font-medium text-slate-700">{invoice.invoiceDate.value}</span></p><div className="border-y border-dashed border-slate-200 py-4"><p className="mb-3 font-medium text-slate-700">Items</p>{invoice.lineItems.map((item) => <p className="mb-2 flex justify-between" key={item.id}><span>{item.description} × {item.quantity}</span><span>{formatMoney(String(item.unitPrice * item.quantity), invoice.currency.value)}</span></p>)}</div><p className="flex justify-between text-sm font-bold text-slate-800"><span>Total</span><span>{formatMoney(invoice.totalAmount.value, invoice.currency.value)}</span></p><p className="flex justify-between"><span>VAT</span><span>{formatMoney(invoice.vatAmount.value, invoice.currency.value)}</span></p></div><div className="mt-8 rounded bg-blue-50 p-2 text-center text-[10px] text-blue-700">Source document preview is simulated until SharePoint is connected.</div></div><p className="mt-3 text-xs text-slate-500"><Archive size={13} className="mr-1 inline" />SharePoint archive: pending integration</p></section>
      <section><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">AI extraction</h3><p className="text-xs text-slate-500">Edit before approving. Confidence comes from the AI result.</p></div><span className="flex items-center gap-1 text-xs font-medium text-blue-700"><Sparkles size={14} /> AI pending setup</span></div><div className="grid gap-3 sm:grid-cols-2">{fields.map(({ field, label }) => <label key={field} className="block"><span className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">{label}<span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${confidenceClass(invoice[field].confidence)}`}>{invoice[field].confidence}%</span></span><input value={invoice[field].value} onChange={(event) => onChange(field, event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 ${invoice[field].confidence < 85 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`} /></label>)}</div><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-700">Line items</p><p className="mt-1 text-[11px] text-slate-500">Correct description, quantity, or unit price before approval.</p>{invoice.lineItems.map((item, index) => <div className="mt-3" key={item.id}><div className="grid grid-cols-[1fr_4rem_5.25rem] gap-2"><input aria-label={`Line item ${index + 1} description`} value={item.description} onChange={(event) => onLineItemChange(index, 'description', event.target.value)} className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-600" /><input aria-label={`Line item ${index + 1} quantity`} value={item.quantity} onChange={(event) => onLineItemChange(index, 'quantity', event.target.value)} type="number" min="0" step="0.001" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-600" /><input aria-label={`Line item ${index + 1} unit price`} value={item.unitPrice} onChange={(event) => onLineItemChange(index, 'unitPrice', event.target.value)} type="number" min="0" step="0.001" className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-600" /></div><p className="mt-1 text-[10px] text-slate-500">AI confidence: description <span className={item.descriptionConfidence < 85 ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{item.descriptionConfidence}%</span> · quantity <span className={item.quantityConfidence < 85 ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{item.quantityConfidence}%</span> · unit price <span className={item.unitPriceConfidence < 85 ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{item.unitPriceConfidence}%</span></p></div>)}</div><details className="mt-3 rounded-lg border border-slate-200 p-3 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-slate-700">Audit history ({auditEvents.length})</summary><ul className="mt-2 list-disc space-y-1 pl-4">{auditEvents.map((event, index) => <li key={`${event}-${index}`}>{event}</li>)}</ul></details>{invoice.notes && <p className="mt-3 text-xs leading-5 text-slate-500">{invoice.notes}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">{isActionable ? <><button onClick={onSaveDraft} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Save draft</button><button onClick={onReject} className="flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"><XCircle size={16} /> Reject</button><button onClick={onApprove} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><CheckCircle2 size={16} /> Approve & post</button></> : <span className="flex items-center gap-2 text-sm font-medium text-slate-500"><CheckCircle2 size={17} className="text-emerald-600" /> This review is complete.</span>}</div></section>
    </div>
  </div>
}

function TrackingView({ invoices }: { invoices: Invoice[] }) {
  const approved = invoices.filter((invoice) => invoice.status === 'approved').sort((left, right) => left.invoiceDate.value.localeCompare(right.invoiceDate.value))
  const total = approved.reduce((sum, invoice) => sum + Number(invoice.totalAmount.value), 0)
  const vat = approved.reduce((sum, invoice) => sum + Number(invoice.vatAmount.value), 0)
  let runningBalance = 0
  const rows = approved.map((invoice) => {
    runningBalance += Number(invoice.totalAmount.value)
    return { invoice, runningBalance }
  })

  return <><section className="rounded-2xl bg-linear-to-r from-blue-800 to-cyan-700 p-6 text-white"><p className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-100">Approved financial records</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Tracking & reporting</h1><p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Only Finance-approved invoices contribute to totals. The running balance is calculated from approved records; SharePoint List/Excel posting will become the authoritative financial tracker once configured.</p><div className="mt-6 grid gap-4 sm:grid-cols-3"><ReportMetric label="Approved total" value={formatMoney(String(total))} /><ReportMetric label="VAT total" value={formatMoney(String(vat))} /><ReportMetric label="Month-to-date balance" value={formatMoney(String(total))} /></div></section><section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4"><h2 className="font-semibold text-slate-900">Approved entries</h2><p className="mt-1 text-sm text-slate-500">Demo calculations update from approved records only. Archive references and metadata will be supplied by SharePoint.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">Lane</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 text-right font-semibold">Total</th><th className="px-4 py-3 text-right font-semibold">Running balance</th><th className="px-4 py-3 font-semibold">Archive metadata</th></tr></thead><tbody>{rows.map(({ invoice, runningBalance: balance }) => <tr className="border-t border-slate-100" key={invoice.id}><td className="px-4 py-3"><p className="font-medium text-slate-800">{invoice.vendor.value}</p><p className="text-xs text-slate-500">{invoice.invoiceNumber.value} · {invoice.invoiceDate.value}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${invoice.invoiceType === 'petty_cash' ? 'bg-amber-50 text-amber-800' : 'bg-cyan-50 text-cyan-800'}`}>{typeLabel(invoice.invoiceType)}</span></td><td className="px-4 py-3 text-slate-600">{invoice.category.value}</td><td className="px-4 py-3 text-right font-semibold text-slate-800">{formatMoney(invoice.totalAmount.value, invoice.currency.value)}</td><td className="px-4 py-3 text-right font-semibold text-slate-800">{formatMoney(String(balance), invoice.currency.value)}</td><td className="px-4 py-3 text-xs text-slate-500">{invoice.archiveUrl ?? 'Pending SharePoint archive'}</td></tr>)}</tbody></table></div></section></>
}
function ReportMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15"><p className="text-xs font-medium text-cyan-100">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div> }

export default App
