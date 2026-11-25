import 'dotenv/config'
import { app } from '../app.js'
import { pool } from '../db.js'

// Starts the app on a random free port and returns a tiny client that keeps cookies,
// like a browser would.
export const startServer = async () => {
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s))
    })
    const base = `http://127.0.0.1:${server.address().port}`
    const stop = async () => {
        await new Promise((resolve) => server.close(resolve))
        await pool.end()
    }
    return { base, stop }
}

export const client = (base) => {
    let cookie = ''
    const request = async (method, path, body) => {
        const res = await fetch(base + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
        const setCookie = res.headers.get('set-cookie')
        if (setCookie) cookie = setCookie.split(';')[0]
        const text = await res.text()
        return { status: res.status, body: text ? JSON.parse(text) : null, setCookie }
    }
    return {
        get: (p) => request('GET', p),
        post: (p, b) => request('POST', p, b ?? {}),
        patch: (p, b) => request('PATCH', p, b ?? {}),
        delete: (p) => request('DELETE', p),
    }
}

export const uniqueEmail = () => `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`
