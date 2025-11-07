import express from 'express'
import db from '../db.js'

const router = express.Router()

// GET /api/capsters
router.get('/capsters', async (req, res) => {
  try {
    const rows = await db.getCapsters()
    return res.json({ data: rows })
  } catch (err) {
    console.error('GET /api/capsters error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/capsters  (create new capster) — accepts JSON { name, alias, description, instaacc }
router.post('/capsters', async (req, res) => {
  try {
    const payload = req.body || {}
    const row = await db.addCapster(payload)
    if (!row) return res.status(500).json({ error: 'Failed to create capster' })
    return res.status(201).json({ data: row })
  } catch (err) {
    console.error('POST /api/capsters error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
