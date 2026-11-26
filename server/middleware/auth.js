import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'svr_token'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export const signToken = (userId) => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' })

// httpOnly: page JavaScript can't read it, so an XSS bug can't steal the session.
// sameSite lax: the browser won't send it on cross-site POSTs (basic CSRF protection).
export const setAuthCookie = (res, userId) =>
    res.cookie(COOKIE_NAME, signToken(userId), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: MAX_AGE_MS,
    })

export const clearAuthCookie = (res) =>
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })

// Puts { id } on req.user if the cookie holds a valid token, otherwise leaves it undefined.
export const readUser = (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME]
    if (token) {
        try {
            req.user = { id: jwt.verify(token, process.env.JWT_SECRET).sub }
        } catch {
            // Expired or tampered token: treat as signed out.
        }
    }
    next()
}

export const requireAuth = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in required' })
    next()
}
