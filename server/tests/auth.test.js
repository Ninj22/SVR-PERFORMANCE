import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, client, uniqueEmail } from './helpers.js'

let srv
before(async () => (srv = await startServer()))
after(async () => srv.stop())

test('register sets an httpOnly cookie and returns the user without the hash', async () => {
    const c = client(srv.base)
    const email = uniqueEmail()
    const res = await c.post('/api/auth/register', { email, password: 'longenough', display_name: 'Austin' })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.email, email)
    assert.equal(res.body.user.password_hash, undefined)
    assert.match(res.setCookie, /HttpOnly/i)
})

test('register rejects bad input and duplicate emails', async () => {
    const c = client(srv.base)
    assert.equal((await c.post('/api/auth/register', { email: 'nope', password: 'longenough' })).status, 400)
    assert.equal((await c.post('/api/auth/register', { email: uniqueEmail(), password: 'short' })).status, 400)

    const email = uniqueEmail()
    await c.post('/api/auth/register', { email, password: 'longenough' })
    const dup = await client(srv.base).post('/api/auth/register', { email: email.toUpperCase(), password: 'longenough' })
    assert.equal(dup.status, 409)
})

test('login, me, logout round trip', async () => {
    const email = uniqueEmail()
    await client(srv.base).post('/api/auth/register', { email, password: 'longenough' })

    const c = client(srv.base)
    assert.equal((await c.get('/api/auth/me')).status, 401)
    assert.equal((await c.post('/api/auth/login', { email, password: 'wrongpass' })).status, 401)
    assert.equal((await c.post('/api/auth/login', { email, password: 'longenough' })).status, 200)

    const me = await c.get('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.user.email, email)

    assert.equal((await c.post('/api/auth/logout')).status, 204)
    assert.equal((await c.get('/api/auth/me')).status, 401)
})

test('a tampered token is treated as signed out', async () => {
    const res = await fetch(srv.base + '/api/auth/me', { headers: { Cookie: 'svr_token=not.a.jwt' } })
    assert.equal(res.status, 401)
})
