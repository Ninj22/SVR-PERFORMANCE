import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { validateConfig } from '../validation/buildConfig.js'
import { makeSlug } from '../lib/slug.js'

export const buildsRouter = Router()
buildsRouter.use(requireAuth)

const MAX_BUILDS_PER_USER = 200
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS = 'id, name, slug, config, is_public, thumbnail_url, created_at, updated_at'

const cleanName = (name) => {
    const n = String(name ?? '').trim()
    return n.length >= 1 && n.length <= 60 ? n : null
}

// A malformed id would make Postgres throw; treat it as "not found" instead.
buildsRouter.param('id', (req, res, next, id) => (UUID_RE.test(id) ? next() : res.status(404).json({ error: 'Build not found' })))

buildsRouter.get('/', async (req, res, next) => {
    try {
        const { rows } = await query(`SELECT ${COLUMNS} FROM builds WHERE user_id = $1 ORDER BY updated_at DESC`, [req.user.id])
        res.json({ builds: rows })
    } catch (err) {
        next(err)
    }
})

buildsRouter.post('/', async (req, res, next) => {
    try {
        const name = cleanName(req.body.name)
        if (!name) return res.status(400).json({ error: 'name must be 1 to 60 characters' })

        const { config, error } = validateConfig(req.body.config)
        if (error) return res.status(400).json({ error })

        const { rows: count } = await query('SELECT count(*)::int AS n FROM builds WHERE user_id = $1', [req.user.id])
        if (count[0].n >= MAX_BUILDS_PER_USER) return res.status(409).json({ error: `You can save up to ${MAX_BUILDS_PER_USER} builds` })

        // Retry on the (very unlikely) slug collision. 23505 = unique_violation.
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const { rows } = await query(
                    `INSERT INTO builds (user_id, name, slug, config, is_public)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING ${COLUMNS}`,
                    [req.user.id, name, makeSlug(), config, Boolean(req.body.is_public)]
                )
                return res.status(201).json({ build: rows[0] })
            } catch (err) {
                if (err.code !== '23505') throw err
            }
        }
        throw new Error('Could not generate a unique slug')
    } catch (err) {
        next(err)
    }
})

// Every query below filters on user_id too, so you can only ever touch your own builds.
// Someone else's build answers 404, not 403, so ids can't be probed.
buildsRouter.get('/:id', async (req, res, next) => {
    try {
        const { rows } = await query(`SELECT ${COLUMNS} FROM builds WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
        if (!rows[0]) return res.status(404).json({ error: 'Build not found' })
        res.json({ build: rows[0] })
    } catch (err) {
        next(err)
    }
})

buildsRouter.patch('/:id', async (req, res, next) => {
    try {
        const sets = []
        const values = []
        const add = (column, value) => {
            values.push(value)
            sets.push(`${column} = $${values.length}`)
        }

        if ('name' in req.body) {
            const name = cleanName(req.body.name)
            if (!name) return res.status(400).json({ error: 'name must be 1 to 60 characters' })
            add('name', name)
        }
        if ('config' in req.body) {
            const { config, error } = validateConfig(req.body.config)
            if (error) return res.status(400).json({ error })
            add('config', config)
        }
        if ('is_public' in req.body) add('is_public', Boolean(req.body.is_public))
        if (!sets.length) return res.status(400).json({ error: 'Nothing to update' })

        values.push(req.params.id, req.user.id)
        const { rows } = await query(
            `UPDATE builds SET ${sets.join(', ')}, updated_at = now()
             WHERE id = $${values.length - 1} AND user_id = $${values.length}
             RETURNING ${COLUMNS}`,
            values
        )
        if (!rows[0]) return res.status(404).json({ error: 'Build not found' })
        res.json({ build: rows[0] })
    } catch (err) {
        next(err)
    }
})

buildsRouter.delete('/:id', async (req, res, next) => {
    try {
        const { rowCount } = await query('DELETE FROM builds WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
        if (!rowCount) return res.status(404).json({ error: 'Build not found' })
        res.status(204).end()
    } catch (err) {
        next(err)
    }
})
