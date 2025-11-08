import dotenv from 'dotenv'
dotenv.config()

import bcrypt from 'bcryptjs'

// Node 18+ provides global fetch. If missing (older runtime), throw an explicit error instead of dynamic import.
const fetchImpl = globalThis.fetch || (() => { throw new Error('fetch API not available: please use Node 18+ or add a fetch polyfill.') })()

// We are Supabase-only now: remove Postgres pool logic.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || null
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null
// Optional service role key for writes under RLS
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null

// Helper: choose appropriate key (service role preferred for mutations to avoid RLS blocking inserts)
function supabaseKey(forWrite = false) {
  if (forWrite && SUPABASE_SERVICE_ROLE_KEY) return SUPABASE_SERVICE_ROLE_KEY
  return SUPABASE_ANON_KEY
}

function buildHeaders({ write = false, json = false, preferReturn = false } = {}) {
  const key = supabaseKey(write)
  if (!key) throw new Error('Supabase key missing. Set SUPABASE_ANON_KEY (and optionally SUPABASE_SERVICE_ROLE_KEY).')
  const h = {
    apikey: key,
    Authorization: `Bearer ${key}`
  }
  if (json) h['Content-Type'] = 'application/json'
  if (preferReturn) h['Prefer'] = 'return=representation'
  return h
}

// Removed Postgres pool; stub query for compatibility if accidentally called.
async function query() { throw new Error('query() not available: Postgres disabled, using Supabase only') }

async function getCapsters() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for capster')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/capster?select=*`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method: 'GET', headers: buildHeaders() })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Supabase capster fetch error: ${resp.status} ${text}`)
  }
  return await resp.json()
}

async function addCapster(payload = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for capster insert')
  const body = {
    name: payload.name || null,
    alias: payload.alias || null,
    description: payload.description || null,
    instaAcc: payload.instaAcc || payload.instaacc || payload.insta || null
  }
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/capster`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method: 'POST', headers: buildHeaders({ write: true, json: true, preferReturn: true }), body: JSON.stringify(body) })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`Supabase capster insert error: ${resp.status} ${text}`)
  const data = JSON.parse(text)
  return Array.isArray(data) ? data[0] : data
}

async function close() { /* no-op: Postgres disabled */ }

export default {
  query,
  getCapsters,
  addCapster,
  getServices,
  addService,
  getAppointments,
  addAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  createAccount,
  findAccountByEmail,
  updateAccountPasswordWithHash,
  addRiwayatPengguna,
  addListAppointment,
  close
}

// ===================== Accounts Helpers =====================
// Create account with email + password (hashed). Returns { id, email, created_at } (no hash).
async function createAccount({ email, password, isAdmin = false }) {
  if (!email || !password) throw new Error('email and password required')

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for account create')
  const hash = await bcrypt.hash(password, 10)
  // User's schema: table "account" with fields: email, password, isAdmin
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/account`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method: 'POST', headers: buildHeaders({ write: true, json: true, preferReturn: true }), body: JSON.stringify({ email, password: hash, isAdmin: !!isAdmin }) })
  const bodyText = await resp.text()
  if (!resp.ok) {
    const err = new Error(`Supabase account insert error: ${resp.status} ${resp.statusText} - ${bodyText}`)
    err.status = resp.status
    throw err
  }
  const data = JSON.parse(bodyText)
  const row = Array.isArray(data) ? data[0] : data
  return { id: row.id, email: row.email, is_admin: !!(row.is_admin ?? row.isAdmin), created_at: row.created_at }
}

// Find account by email, returns full row including password_hash (for auth internal).
async function findAccountByEmail(email) {
  if (!email) throw new Error('email required')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for account fetch')
  // User's schema: table "account" (singular)
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/account?email=eq.${encodeURIComponent(email)}&select=*`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method: 'GET', headers: buildHeaders() })
  if (!resp.ok) {
    const text = await resp.text()
    const err = new Error(`Supabase account fetch error: ${resp.status} ${resp.statusText} - ${text}`)
    err.status = resp.status
    throw err
  }
  const rows = await resp.json()
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

// Update an account's password hash.
// For Postgres (local/Railway): updates accounts.password_hash by email.
// For Supabase REST: updates account.password (hash) by email.
async function updateAccountPasswordWithHash(email, hash) {
  if (!email || !hash) throw new Error('email and hash required')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for password update')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/account?email=eq.${encodeURIComponent(email)}`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method: 'PATCH', headers: buildHeaders({ write: true, json: true, preferReturn: false }), body: JSON.stringify({ password: hash }) })
  if (!resp.ok) {
    const text = await resp.text()
    const err = new Error(`Supabase account update error: ${resp.status} ${resp.statusText} - ${text}`)
    err.status = resp.status
    throw err
  }
  return true
}

// ===================== Services Helpers =====================
// Schema service: name, description, price, type
async function getServices() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for service fetch')
  // User's schema: table "service" (singular)
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/service?select=*`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method: 'GET', headers: buildHeaders() })
  if (!resp.ok) throw new Error(`Supabase service fetch error: ${resp.status}`)
  return await resp.json()
}

async function addService({ name, description, price, type }) {
  if (!name) throw new Error('service name required')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for service insert')
  // User's schema: table "service" (singular)
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/service`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const body = { name, description, price, type }
  const resp = await fetchImpl(url, { method: 'POST', headers: buildHeaders({ write: true, json: true, preferReturn: true }), body: JSON.stringify(body) })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Supabase service insert error: ${resp.status} ${txt}`)
  const data = JSON.parse(txt)
  return Array.isArray(data) ? data[0] : data
}

// ===================== Appointments Helpers =====================
// Schema appointment: name, email, phone, date, time, service, capsterId, status, notes, timestamp
async function getAppointments() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for appointment fetch')
  // User's schema: table "appointment" (singular)
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment?select=*`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'GET', headers: buildHeaders() })
  if (!resp.ok) throw new Error(`Supabase appointment fetch error: ${resp.status}`)
  return await resp.json()
}

async function addAppointment({ name, email, phone, date, time, service, capsterId, status = 'pending', notes, timestamp }) {
  if (!name || !phone || !date || !time || !service) throw new Error('Missing required appointment fields')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for appointment insert')
  // User's schema: table "appointment" (singular). Column may be camelCase `capsterId`.
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  // Allow passing client timestamp; fallback to server time if not provided
  const body = { name, email, phone, date, time, service, capsterId, status, notes, timestamp: timestamp || new Date().toISOString() }
  const resp = await fetchImpl(url, { method:'POST', headers: buildHeaders({ write: true, json: true, preferReturn: true }), body: JSON.stringify(body) })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Supabase appointment insert error: ${resp.status} ${txt}`)
  const data = JSON.parse(txt)
  const row = Array.isArray(data) ? data[0] : data
  // Normalize field names
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, date: row.date, time: row.time, service: row.service, capsterId: row.capsterId ?? row.capster_id, status: row.status, notes: row.notes, timestamp: row.timestamp ?? row.created_at }
}

// Insert a row into riwayat_pengguna (user history). Accepts { email, name, service, capster, date, time }
async function addRiwayatPengguna({ email, name, service, capster, date, time }){
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for riwayat_pengguna insert')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/riwayat_pengguna`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'POST', headers: buildHeaders({ write:true, json:true, preferReturn:true }), body: JSON.stringify({ email, name, service, capster, date, time }) })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Supabase riwayat_pengguna insert error: ${resp.status} ${txt}`)
  const data = JSON.parse(txt)
  return Array.isArray(data) ? data[0] : data
}

// Insert a row into list_appointment. Accepts { appointment_id, status }
async function addListAppointment({ appointment_id, status }){
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for list_appointment insert')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/list_appointment`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'POST', headers: buildHeaders({ write:true, json:true, preferReturn:true }), body: JSON.stringify({ appointment_id, status }) })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Supabase list_appointment insert error: ${resp.status} ${txt}`)
  const data = JSON.parse(txt)
  return Array.isArray(data) ? data[0] : data
}

// ============ Auxiliary Tables ============
// riwayat_pengguna: simple log of user bookings
// Removed legacy addUserHistory/addListAppointment variants with full appointment details.

// Update appointment status (e.g., pending -> accepted/rejected)
async function updateAppointmentStatus(id, status){
  if (!id) throw new Error('appointment id required')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for status update')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment?id=eq.${encodeURIComponent(id)}`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'PATCH', headers: buildHeaders({ write:true, json:true, preferReturn: true }), body: JSON.stringify({ status }) })
  if (!resp.ok){ const t=await resp.text(); throw new Error(`Supabase appointment update error: ${resp.status} ${t}`) }
  // If Prefer return=representation is honored, return the updated row for convenience
  try {
    const data = await resp.json()
    return Array.isArray(data) ? data[0] : data
  } catch(_) { return true }
}

// Delete appointment
async function deleteAppointment(id){
  if (!id) throw new Error('appointment id required')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing for appointment delete')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment?id=eq.${encodeURIComponent(id)}`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'DELETE', headers: buildHeaders({ write:true }) })
  if (!resp.ok){ const t=await resp.text(); throw new Error(`Supabase appointment delete error: ${resp.status} ${t}`) }
  return true
}
