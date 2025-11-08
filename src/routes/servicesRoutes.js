import express from 'express'
import db from '../db.js'

const router = express.Router()

// GET /api/service
router.get('/service', async (req, res) => {
  try {
    const rows = await db.getServices()
    return res.json({ data: rows })
  } catch (err) {
    console.error('GET /api/service error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/service
router.post('/service', async (req, res) => {
  try {
    const payload = req.body || {}
    const row = await db.addService(payload)
    if (!row) return res.status(500).json({ error: 'Failed to create service' })
    return res.status(201).json({ data: row })
  } catch (err) {
    console.error('POST /api/service error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
