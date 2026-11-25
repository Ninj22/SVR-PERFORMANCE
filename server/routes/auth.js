import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

export const authRouter = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 })

// Used when the email doesn't exist, so a wrong email takes as long as a wrong password
// and nobody can tell which accounts exist by timing the response.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

const publicUser = (u) => ({ id: u.id, email: u.email, display_name: u.display_name, created_at: u.created_at })

authRouter.post('/register', limiter, async (req, res, next) => {
    try {
        const email = String(req.body.email ?? '').trim().toLowerCase()
        const password = String(req.body.password ?? '')
        const displayName = req.body.display_name ? String(req.body.display_name).trim().slice(0, 50) : null

        if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email' })
        if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8 to 72 characters' })

        const hash = await bcrypt.hash(password, 12)
        const { rows } = await query(
            `INSERT INTO users (email, password_hash, display_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email, display_name, created_at`,
            [email, hash, displayName]
        )
        if (!rows[0]) return res.status(409).json({ error: 'An account with that email already exists' })

        setAuthCookie(res, rows[0].id)
        res.status(201).json({ user: publicUser(rows[0]) })
    } catch (err) {
        next(err)
    }
})

authRouter.post('/login', limiter, async (req, res, next) => {
    try {
        const email = String(req.body.email ?? '').trim().toLowerCase()
        const password = String(req.body.password ?? '')

        const { rows } = await query('SELECT * FROM users WHERE email = $1', [email])
        const user = rows[0]
        const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH)
        if (!user || !ok) return res.status(401).json({ error: 'Wrong email or password' })

        setAuthCookie(res, user.id)
        res.json({ user: publicUser(user) })
    } catch (err) {
        next(err)
    }
})

authRouter.post('/logout', (req, res) => {
    clearAuthCookie(res)
    res.status(204).end()
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
    try {
        const { rows } = await query('SELECT id, email, display_name, created_at FROM users WHERE id = $1', [req.user.id])
        if (!rows[0]) {
            // Token is valid but the account was deleted.
            clearAuthCookie(res)
            return res.status(401).json({ error: 'Sign in required' })
        }
        res.json({ user: publicUser(rows[0]) })
    } catch (err) {
        next(err)
    }
})
