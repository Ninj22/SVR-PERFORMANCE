// Small in-memory rate limiter: at most `max` requests per `windowMs` per IP.
// Fine for a single server. If you ever run several instances, move this to Redis.
export const rateLimit = ({ windowMs, max }) => {
    const hits = new Map()

    setInterval(() => {
        const now = Date.now()
        for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key)
    }, windowMs).unref()

    return (req, res, next) => {
        const now = Date.now()
        const entry = hits.get(req.ip)
        if (!entry || entry.resetAt <= now) {
            hits.set(req.ip, { count: 1, resetAt: now + windowMs })
            return next()
        }
        if (++entry.count > max) {
            res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000))
            return res.status(429).json({ error: 'Too many attempts, try again later' })
        }
        next()
    }
}
