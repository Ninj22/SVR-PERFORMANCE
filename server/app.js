import express from 'express'
import cookieParser from 'cookie-parser'
import { fileURLToPath } from 'node:url'
import { query } from './db.js'
import { readUser } from './middleware/auth.js'
import { authRouter } from './routes/auth.js'
import { buildsRouter } from './routes/builds.js'
import { shareRouter } from './routes/share.js'

export const app = express()

// Behind Render/Railway's proxy, req.ip should be the visitor's IP, not the proxy's.
app.set('trust proxy', 1)

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use(readUser)

app.get('/api/health', async (req, res, next) => {
    try {
        await query('SELECT 1')
        res.json({ status: 'ok', db: 'up' })
    } catch (err) {
        next(err)
    }
})

app.use('/api/auth', authRouter)
app.use('/api/builds', buildsRouter)
app.use('/api', shareRouter)

// Unknown /api routes get JSON, not the SPA.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

// In production, Express serves the built React app from dist/.
if (process.env.NODE_ENV === 'production') {
    const dist = fileURLToPath(new URL('../dist/', import.meta.url))
    app.use(express.static(dist))
    app.get('*', (req, res) => res.sendFile(dist + 'index.html'))
}

// Central error handler: log the real error, send a safe message.
app.use((err, req, res, next) => {
    // Malformed JSON body from express.json()
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' })
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' })
    console.error(err)
    const status = err.status || 500
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message })
})
