import express from 'express'
import db from '../db.js'

const router = express.Router()

// GET /api/appointment
router.get('/appointment', async (req, res) => {
  try {
    const rows = await db.getAppointments()
    return res.json({ data: rows })
  } catch (err) {
    console.error('GET /api/appointment error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/appointment
router.post('/appointment', async (req, res) => {
  try {
    const payload = req.body || {}
    // expected: { name, email, phone, date, time, service, capsterId?, capster?, notes? }
    const row = await db.addAppointment(payload)
    if (!row) return res.status(500).json({ error: 'Failed to create appointment' })

    // Best-effort auxiliary inserts (do not block response)
    ;(async () => {
      try {
        await db.addRiwayatPengguna({
          email: row.email,
          name: row.name,
          service: row.service,
          capster: payload.capster || null,
          date: row.date,
          time: row.time
        })
      } catch (e) {
        console.warn('Failed to write riwayat_pengguna:', e && e.message)
      }
      try {
        await db.addListAppointment({ appointment_id: row.id, status: row.status || 'pending' })
      } catch (e) {
        console.warn('Failed to write list_appointment:', e && e.message)
      }
    })()

    return res.status(201).json({ data: row })
  } catch (err) {
    console.error('POST /api/appointment error', err && err.message)
    // Surface Supabase error message to client to ease debugging
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
})

// PATCH /api/appointment/:id/status { status }
router.patch('/appointment/:id/status', async (req,res)=>{
  try {
    const { id } = req.params
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ error: 'status required' })
    await db.updateAppointmentStatus(id, status)
    return res.json({ data: { id, status } })
  } catch(err){
    console.error('PATCH /api/appointment/:id/status error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/appointment/:id
router.delete('/appointment/:id', async (req,res)=>{
  try {
    const { id } = req.params
    await db.deleteAppointment(id)
    return res.status(204).send()
  } catch(err){
    console.error('DELETE /api/appointment/:id error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
