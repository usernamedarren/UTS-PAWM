import dotenv from 'dotenv'
dotenv.config()

import pg from 'pg'
import bcrypt from 'bcryptjs'

// Prefer the global fetch (Node 18+). If not available, attempt dynamic import of node-fetch
let fetchImpl = globalThis.fetch
if (!fetchImpl) {
  try {
    const mod = await import('node-fetch')
    fetchImpl = mod.default ?? mod
  } catch (e) {
    // leave fetchImpl null; errors will be thrown when attempting network calls
    fetchImpl = null
  }
}

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL || null
const SUPABASE_URL = process.env.SUPABASE_URL || null
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null
// Service role key (never expose to client). If provided, we'll use it for server-side writes to bypass RLS safely.
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

let pool = null
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL })
}

async function query(text, params) {
  if (!pool) throw new Error('No Postgres pool configured')
  const res = await pool.query(text, params)
  return res
}

async function getCapsters() {
  // If a Postgres DATABASE_URL is provided, use it. Otherwise use Supabase REST API.
  if (pool) {
    const res = await pool.query('SELECT id, name, alias, description, instaacc FROM capster ORDER BY id')
    return res.rows
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('No database configured: set DATABASE_URL or SUPABASE_URL + SUPABASE_ANON_KEY')
  }

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/capster?select=*`
  if (!fetchImpl) throw new Error('No fetch implementation available (Node 18+ has global fetch, or install node-fetch)')

  const resp = await fetchImpl(url, { method: 'GET', headers: buildHeaders() })

  if (!resp.ok) {
    const text = await resp.text()
    const err = new Error(`Supabase REST error: ${resp.status} ${resp.statusText} - ${text}`)
    err.status = resp.status
    throw err
  }

  const data = await resp.json()
  return data
}

async function addCapster(payload = {}) {
  // payload expected: { name, alias, description, instaAcc } (case-insensitive handled by Supabase)
  const body = {
    name: payload.name || payload.name || null,
    alias: payload.alias || payload.alias || null,
    description: payload.description || payload.description || null,
    instaacc: payload.instaacc || payload.instaAcc || payload.insta || null
  }

  if (pool) {
    const text = `INSERT INTO capster (name, alias, description, instaacc) VALUES ($1,$2,$3,$4) RETURNING id, name, alias, description, instaacc`
    const vals = [body.name, body.alias, body.description, body.instaacc]
    const res = await pool.query(text, vals)
    return res.rows[0]
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('No database configured: set DATABASE_URL or SUPABASE_URL + SUPABASE_ANON_KEY')
  }

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/capster`
  if (!fetchImpl) throw new Error('No fetch implementation available (Node 18+ has global fetch, or install node-fetch)')

  const resp = await fetchImpl(url, { method: 'POST', headers: buildHeaders({ write: true, json: true, preferReturn: true }), body: JSON.stringify(body) })

  if (!resp.ok) {
    const text = await resp.text()
    const err = new Error(`Supabase REST insert error: ${resp.status} ${resp.statusText} - ${text}`)
    err.status = resp.status
    throw err
  }

  const data = await resp.json()
  // Supabase returns an array of inserted rows
  return Array.isArray(data) ? data[0] : data
}

async function close() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

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
  addUserHistory,
  addListAppointment,
  close
}

// ===================== Accounts Helpers =====================
// Create account with email + password (hashed). Returns { id, email, created_at } (no hash).
async function createAccount({ email, password, isAdmin = false }) {
  if (!email || !password) throw new Error('email and password required')

  if (pool) {
    // Check duplicate
    const existing = await pool.query('SELECT id FROM accounts WHERE email=$1 LIMIT 1', [email])
    if (existing.rows.length) {
      const err = new Error('Email already exists')
      err.status = 409
      throw err
    }
    const hash = await bcrypt.hash(password, 10)
  const ins = await pool.query('INSERT INTO accounts (email, password_hash, is_admin) VALUES ($1,$2,$3) RETURNING id, email, is_admin, created_at', [email, hash, !!isAdmin])
    return ins.rows[0]
  }

  // Supabase REST fallback — matches Supabase tables described by user
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('No database configured: set DATABASE_URL or SUPABASE_URL + SUPABASE_ANON_KEY')
  }
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
  if (pool) {
  const res = await pool.query('SELECT id, email, password_hash, is_admin, created_at FROM accounts WHERE email=$1 LIMIT 1', [email])
    return res.rows[0] || null
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('No database configured: set DATABASE_URL or SUPABASE_URL + SUPABASE_ANON_KEY')
  }
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
  if (pool) {
    await pool.query('UPDATE accounts SET password_hash=$1 WHERE email=$2', [hash, email])
    return true
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('No database configured: set SUPABASE_URL + keys')
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
  if (pool) {
    const res = await pool.query('SELECT id, name, description, price, type FROM service ORDER BY id')
    return res.rows
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('No database configured for service')
  // User's schema: table "service" (singular)
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/service?select=*`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method: 'GET', headers: buildHeaders() })
  if (!resp.ok) throw new Error(`Supabase service fetch error: ${resp.status}`)
  return await resp.json()
}

async function addService({ name, description, price, type }) {
  if (!name) throw new Error('service name required')
  if (pool) {
    const res = await pool.query('INSERT INTO service (name, description, price, type) VALUES ($1,$2,$3,$4) RETURNING id, name, description, price, type', [name, description || null, price ?? null, type || null])
    return res.rows[0]
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('No database configured for service')
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
  if (pool) {
    const res = await pool.query('SELECT id, name, email, phone, date, time, service, capster_id AS "capsterId", status, created_at AS "timestamp" FROM appointment ORDER BY created_at DESC')
    return res.rows
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('No database configured for appointment')
  // User's schema: table "appointment" (singular)
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment?select=*`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'GET', headers: buildHeaders() })
  if (!resp.ok) throw new Error(`Supabase appointment fetch error: ${resp.status}`)
  return await resp.json()
}

async function addAppointment({ name, email, phone, date, time, service, capsterId, status = 'pending', notes }) {
  if (!name || !phone || !date || !time || !service) throw new Error('Missing required appointment fields')
  if (pool) {
    const res = await pool.query('INSERT INTO appointment (name, email, phone, date, time, service, capster_id, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name, email, phone, date, time, service, capster_id AS "capsterId", status, notes, created_at AS "timestamp"', [name, email || null, phone, date, time, service, capsterId || null, status, notes || null])
    return res.rows[0]
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('No database configured for appointment')
  // User's schema: table "appointment" (singular). Column may be camelCase `capsterId`.
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const body = { name, email, phone, date, time, service, capsterId, status, notes }
  const resp = await fetchImpl(url, { method:'POST', headers: buildHeaders({ write: true, json: true, preferReturn: true }), body: JSON.stringify(body) })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Supabase appointment insert error: ${resp.status} ${txt}`)
  const data = JSON.parse(txt)
  const row = Array.isArray(data) ? data[0] : data
  // Normalize field names
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, date: row.date, time: row.time, service: row.service, capsterId: row.capsterId ?? row.capster_id, status: row.status, notes: row.notes, timestamp: row.timestamp ?? row.created_at }
}

// ============ Auxiliary Tables ============
// riwayat_pengguna: simple log of user bookings
async function addUserHistory({ appointment_id, name, email, phone, service, capster, date, time, status, notes }) {
  if (!appointment_id) throw new Error('appointment_id required for history')
  if (pool) {
    const res = await pool.query('INSERT INTO riwayat_pengguna (appointment_id, name, email, phone, service, capster, date, time, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id', [appointment_id, name||null, email||null, phone||null, service||null, capster||null, date||null, time||null, status||null, notes||null])
    return res.rows[0]
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('No database configured for riwayat_pengguna')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/riwayat_pengguna`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const body = { appointment_id, name, email, phone, service, capster, date, time, status, notes }
  const resp = await fetchImpl(url, { method:'POST', headers: buildHeaders({ write:true, json:true, preferReturn:true }), body: JSON.stringify(body) })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Supabase riwayat_pengguna insert error: ${resp.status} ${txt}`)
  const data = JSON.parse(txt); return Array.isArray(data)? data[0] : data
}

// list_appointment: mirror for admin listing / analytics
async function addListAppointment({ appointment_id, name, email, phone, service, capster, date, time, status, notes }) {
  if (!appointment_id) throw new Error('appointment_id required for list_appointment')
  if (pool) {
    const res = await pool.query('INSERT INTO list_appointment (appointment_id, name, email, phone, service, capster, date, time, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id', [appointment_id, name||null, email||null, phone||null, service||null, capster||null, date||null, time||null, status||null, notes||null])
    return res.rows[0]
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('No database configured for list_appointment')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/list_appointment`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const body = { appointment_id, name, email, phone, service, capster, date, time, status, notes }
  const resp = await fetchImpl(url, { method:'POST', headers: buildHeaders({ write:true, json:true, preferReturn:true }), body: JSON.stringify(body) })
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`Supabase list_appointment insert error: ${resp.status} ${txt}`)
  const data = JSON.parse(txt); return Array.isArray(data)? data[0] : data
}

// Update appointment status (e.g., pending -> accepted/rejected)
async function updateAppointmentStatus(id, status){
  if (!id) throw new Error('appointment id required')
  if (pool){
    const res = await pool.query('UPDATE appointment SET status=$1 WHERE id=$2 RETURNING id, status', [status, id])
    return res.rows[0]
  }
  if (!SUPABASE_URL) throw new Error('No database configured')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment?id=eq.${encodeURIComponent(id)}`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'PATCH', headers: buildHeaders({ write:true, json:true }), body: JSON.stringify({ status }) })
  if (!resp.ok){ const t=await resp.text(); throw new Error(`Supabase appointment update error: ${resp.status} ${t}`) }
  return true
}

// Delete appointment
async function deleteAppointment(id){
  if (!id) throw new Error('appointment id required')
  if (pool){ await pool.query('DELETE FROM appointment WHERE id=$1', [id]); return true }
  if (!SUPABASE_URL) throw new Error('No database configured')
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/appointment?id=eq.${encodeURIComponent(id)}`
  if (!fetchImpl) throw new Error('No fetch implementation available')
  const resp = await fetchImpl(url, { method:'DELETE', headers: buildHeaders({ write:true }) })
  if (!resp.ok){ const t=await resp.text(); throw new Error(`Supabase appointment delete error: ${resp.status} ${t}`) }
  return true
}
