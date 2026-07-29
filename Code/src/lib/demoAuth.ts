import type { FinanceUser } from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

const SESSION_KEY = 'financial-automation-demo-session'
const REGISTERED_USERS_KEY = 'financial-automation-registered-users'

const demoAccounts = [
  { id: 'demo-admin', email: 'finance.admin@demo.com', password: 'Demo123!', name: 'Aisha Finance', role: 'finance_admin' as const },
  { id: 'demo-reviewer', email: 'reviewer@demo.com', password: 'Demo123!', name: 'Omar Reviewer', role: 'reviewer' as const },
]

export const demoAccountDetails = demoAccounts.map(({ email, password, role }) => ({ email, password, role }))

function savedUsers() {
  return JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) ?? '[]') as typeof demoAccounts
}

function toUser(account: (typeof demoAccounts)[number]): FinanceUser {
  return { id: account.id, email: account.email, name: account.name, role: account.role }
}

export async function signIn(email: string, password: string): Promise<FinanceUser> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) throw new Error(error?.message ?? 'Unable to sign in.')
    return { id: data.user.id, email: data.user.email ?? email, name: data.user.user_metadata.full_name ?? email, role: 'reviewer' }
  }

  const account = [...demoAccounts, ...savedUsers()].find(
    (candidate) => candidate.email.toLowerCase() === email.toLowerCase() && candidate.password === password,
  )
  if (!account) throw new Error('Use a demo account below, or register a new local demo account.')
  const user = toUser(account)
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  return user
}

export async function register(name: string, email: string, password: string): Promise<FinanceUser> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    if (error || !data.user) throw new Error(error?.message ?? 'Unable to register.')
    return { id: data.user.id, email, name, role: 'reviewer' }
  }

  if ([...demoAccounts, ...savedUsers()].some((candidate) => candidate.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with that email already exists.')
  }
  const account = { id: crypto.randomUUID(), email, password, name, role: 'reviewer' as const }
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify([...savedUsers(), account]))
  const user = toUser(account)
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  return user
}

export function currentDemoUser(): FinanceUser | null {
  const raw = localStorage.getItem(SESSION_KEY)
  return raw ? (JSON.parse(raw) as FinanceUser) : null
}

export async function signOut() {
  if (isSupabaseConfigured && supabase) await supabase.auth.signOut()
  localStorage.removeItem(SESSION_KEY)
}
