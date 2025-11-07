import express from 'express'
import db from '../db.js'

const router = express.Router()

// POST /api/account - create account { email, password }
router.post('/account', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    const row = await db.createAccount({ email, password })
    if (!row) return res.status(500).json({ error: 'Failed to create account' })
    // row tidak mengandung password_hash (db.createAccount sudah filter)
    return res.status(201).json({ data: row })
  } catch (err) {
    const code = err && err.status || 500
    console.error('POST /api/account error', err && err.message)
    return res.status(code).json({ error: err.message || 'Server error' })
  }
})

// GET /api/accounts?email=abc - find account by email (dev)
router.get('/account', async (req, res) => {
  try {
    const email = req.query.email
    if (!email) return res.status(400).json({ error: 'email query required' })
    const row = await db.findAccountByEmail(email)
    if (!row) return res.json({ data: null })
    // Jangan expose password_hash
    const { id, email: em, created_at } = row
    return res.json({ data: { id, email: em, created_at } })
  } catch (err) {
    console.error('GET /api/account error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
