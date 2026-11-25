import express, { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

export const shareRouter = Router()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[A-Za-z0-9]{8}$/
const MAX_THUMBNAIL_BYTES = 300 * 1024

// Work out the real image type from the file's first bytes, not from what the client claims.
const sniffImage = (buf) => {
    if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
    return null
}

// Public share link: anyone can read a build by its slug, but only if it's public.
// Private builds answer 404, exactly like a slug that doesn't exist.
shareRouter.get('/b/:slug', async (req, res, next) => {
    try {
        if (!SLUG_RE.test(req.params.slug)) return res.status(404).json({ error: 'Build not found' })
        const { rows } = await query(
            `SELECT b.name, b.slug, b.config, b.thumbnail_url, b.created_at, b.updated_at,
                    u.display_name AS author
             FROM builds b JOIN users u ON u.id = b.user_id
             WHERE b.slug = $1 AND b.is_public`,
            [req.params.slug]
        )
        if (!rows[0]) return res.status(404).json({ error: 'Build not found' })
        res.json({ build: rows[0] })
    } catch (err) {
        next(err)
    }
})

// Upload or replace a build's thumbnail. The body is the raw image bytes, e.g.
// fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: blob })
shareRouter.put(
    '/builds/:id/thumbnail',
    requireAuth,
    express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_THUMBNAIL_BYTES }),
    async (req, res, next) => {
        try {
            if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Build not found' })
            if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(415).json({ error: 'Send a PNG, JPEG or WebP image' })
            const mime = sniffImage(req.body)
            if (!mime) return res.status(415).json({ error: 'Send a PNG, JPEG or WebP image' })

            const { rows } = await query('SELECT id FROM builds WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
            if (!rows[0]) return res.status(404).json({ error: 'Build not found' })

            await query(
                `INSERT INTO build_thumbnails (build_id, mime_type, data) VALUES ($1, $2, $3)
                 ON CONFLICT (build_id) DO UPDATE SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data, updated_at = now()`,
                [req.params.id, mime, req.body]
            )
            // ?v= changes on every upload so browsers and WhatsApp don't keep showing the old image.
            const url = `/api/thumbnails/${req.params.id}?v=${Date.now()}`
            await query('UPDATE builds SET thumbnail_url = $1 WHERE id = $2', [url, req.params.id])
            res.json({ thumbnail_url: url })
        } catch (err) {
            next(err)
        }
    }
)

// Serve a thumbnail: to anyone if the build is public, otherwise only to its owner.
shareRouter.get('/thumbnails/:id', async (req, res, next) => {
    try {
        if (!UUID_RE.test(req.params.id)) return res.status(404).end()
        const { rows } = await query(
            `SELECT t.mime_type, t.data, b.is_public, b.user_id
             FROM build_thumbnails t JOIN builds b ON b.id = t.build_id
             WHERE t.build_id = $1`,
            [req.params.id]
        )
        const thumb = rows[0]
        if (!thumb || (!thumb.is_public && thumb.user_id !== req.user?.id)) return res.status(404).end()

        res.set('Content-Type', thumb.mime_type)
        res.set('X-Content-Type-Options', 'nosniff')
        res.set('Cache-Control', thumb.is_public ? 'public, max-age=86400' : 'private, no-store')
        res.send(thumb.data)
    } catch (err) {
        next(err)
    }
})
