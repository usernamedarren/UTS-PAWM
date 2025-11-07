import express from 'express'
import db from '../db.js'

const router = express.Router()

// GET /api/appointments
router.get('/appointments', async (req, res) => {
  try {
    const rows = await db.getAppointments()
    return res.json({ data: rows })
  } catch (err) {
    console.error('GET /api/appointments error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/appointments
router.post('/appointments', async (req, res) => {
  try {
    const payload = req.body || {}
    const row = await db.addAppointment(payload)
    if (!row) return res.status(500).json({ error: 'Failed to create appointment' })

    // Auxiliary inserts: riwayat_pengguna & list_appointment (best-effort)
    const auxPayload = {
      appointment_id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      service: row.service,
      capster: payload.capsterName || null,
      date: row.date,
      time: row.time,
      status: row.status,
      notes: row.notes || payload.notes || null
    }
    // Fire-and-forget style; errors logged but not fatal.
    Promise.allSettled([
      db.addUserHistory?.(auxPayload),
      db.addListAppointment?.(auxPayload)
    ]).then(r=>{
      r.forEach((resObj,i)=>{ if(resObj.status==='rejected') console.warn('Aux insert failed', i, resObj.reason?.message) })
    })

    return res.status(201).json({ data: row })
  } catch (err) {
    console.error('POST /api/appointments error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/appointments/:id/status { status }
router.patch('/appointments/:id/status', async (req,res)=>{
  try {
    const { id } = req.params
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ error: 'status required' })
    await db.updateAppointmentStatus(id, status)
    return res.json({ data: { id, status } })
  } catch(err){
    console.error('PATCH /api/appointments/:id/status error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/appointments/:id
router.delete('/appointments/:id', async (req,res)=>{
  try {
    const { id } = req.params
    await db.deleteAppointment(id)
    return res.status(204).send()
  } catch(err){
    console.error('DELETE /api/appointments/:id error', err && err.message)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
