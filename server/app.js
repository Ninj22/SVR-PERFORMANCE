import express from 'express'
import cookieParser from 'cookie-parser'
import { fileURLToPath } from 'node:url'
import { query } from './db.js'

export const app = express()

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', async (req, res, next) => {
    try {
        await query('SELECT 1')
        res.json({ status: 'ok', db: 'up' })
    } catch (err) {
        next(err)
    }
})

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
    console.error(err)
    const status = err.status || 500
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message })
})
