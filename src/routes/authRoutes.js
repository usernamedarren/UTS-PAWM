import express from 'express'
import db from '../db.js'
import bcrypt from 'bcryptjs'
const router = express.Router()

// POST /api/login { email, password }
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body || {}
	if (!email || !password) return res.status(400).json({ error: 'email and password required' })

	const row = await db.findAccountByEmail(email)
	if (!row || (!row.password_hash && !row.password)) return res.status(401).json({ error: 'Invalid credentials' })
	const stored = row.password_hash || row.password
	let ok = false
	// If stored value looks like bcrypt hash, use bcrypt.compare; otherwise compare plaintext (for legacy rows)
	if (typeof stored === 'string' && stored.startsWith('$2')) {
		ok = await bcrypt.compare(password, stored)
	} else {
		ok = password === stored
		// If login succeeds with plaintext, migrate to bcrypt hash silently
		if (ok) {
			try {
				const newHash = await bcrypt.hash(password, 10)
				await db.updateAccountPasswordWithHash(email, newHash)
			} catch (mErr) {
				console.warn('Password migration failed for', email, mErr && mErr.message)
			}
		}
	}
	if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
	const isAdmin = !!(row.is_admin ?? row.isAdmin)
	return res.json({ data: { role: isAdmin ? 'admin' : 'user', email: row.email, id: row.id } })
	} catch (err) {
		console.error('POST /api/login error', err && err.message)
		return res.status(500).json({ error: 'Server error' })
	}
})

// POST /api/register { email, password }
router.post('/register', async (req, res) => {
	try {
		const { email, password, isAdmin } = req.body || {}
	if (!email || !password) return res.status(400).json({ error: 'email and password required' })
	const row = await db.createAccount({ email, password, isAdmin })
	return res.status(201).json({ data: { id: row.id, email: row.email, is_admin: !!(row.is_admin ?? row.isAdmin) } })
	} catch (err) {
		const code = err && err.status || 500
		console.error('POST /api/register error', err && err.message)
		return res.status(code).json({ error: err.message || 'Server error' })
	}
})

export default router
