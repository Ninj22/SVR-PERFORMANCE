import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, client, signedInClient } from './helpers.js'
import vehicleConfigs from '../../vehicleConfigs.js'

let srv
before(async () => (srv = await startServer()))
after(async () => srv.stop())

const config = () => structuredClone(vehicleConfigs.defaults)

test('builds need a signed-in user', async () => {
    assert.equal((await client(srv.base).get('/api/builds')).status, 401)
})

test('create, list, read, update, delete', async () => {
    const c = await signedInClient(srv.base)

    const created = await c.post('/api/builds', { name: 'Desert runner', config: config() })
    assert.equal(created.status, 201)
    const { id, slug } = created.body.build
    assert.match(slug, /^[A-Za-z0-9]{8}$/)
    assert.equal(created.body.build.is_public, false)

    const list = await c.get('/api/builds')
    assert.equal(list.body.builds.length, 1)

    assert.equal((await c.get(`/api/builds/${id}`)).body.build.name, 'Desert runner')

    const updated = await c.patch(`/api/builds/${id}`, { name: 'Trail rig', is_public: true, config: { ...config(), lift: '4' } })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.build.name, 'Trail rig')
    assert.equal(updated.body.build.is_public, true)
    assert.equal(updated.body.build.config.lift, 4) // string from the <select> stored as a number

    assert.equal((await c.delete(`/api/builds/${id}`)).status, 204)
    assert.equal((await c.get(`/api/builds/${id}`)).status, 404)
})

test("you can't see or change someone else's build", async () => {
    const owner = await signedInClient(srv.base)
    const other = await signedInClient(srv.base)
    const { id } = (await owner.post('/api/builds', { name: 'Mine', config: config() })).body.build

    assert.equal((await other.get(`/api/builds/${id}`)).status, 404)
    assert.equal((await other.patch(`/api/builds/${id}`, { name: 'Stolen' })).status, 404)
    assert.equal((await other.delete(`/api/builds/${id}`)).status, 404)
    assert.equal((await other.get('/api/builds')).body.builds.length, 0)
    assert.equal((await owner.get(`/api/builds/${id}`)).body.build.name, 'Mine')
})

test('invalid configs are rejected with a reason', async () => {
    const c = await signedInClient(srv.base)
    const bad = async (overrides) => (await c.post('/api/builds', { name: 'x', config: { ...config(), ...overrides } })).body.error

    assert.match(await bad({ body: 'tesla_cybertruck' }), /unknown vehicle body/)
    assert.match(await bad({ tire_diameter: 55 }), /tire_diameter must be between 30 and 40/)
    assert.match(await bad({ color: 'red' }), /hex colour/)
    assert.match(await bad({ addons: { bumper_f: 'stock' } }), /unknown addon/) // 5g has no addons
    assert.equal((await c.post('/api/builds', { name: '', config: config() })).status, 400)
    assert.equal((await c.post('/api/builds', { name: 'x', config: 'nope' })).status, 400)
})

test('addons are checked against the chosen body', async () => {
    const c = await signedInClient(srv.base)
    const body = 'toyota_4runner_3g'
    const ok = await c.post('/api/builds', { name: '3G', config: { ...config(), body, addons: { bumper_f: 'shrockworks', rack: '' } } })
    assert.equal(ok.status, 201)
    assert.deepEqual(ok.body.build.config.addons, { bumper_f: 'shrockworks', rack: '' })

    const bad = await c.post('/api/builds', { name: '3G', config: { ...config(), body, addons: { bumper_f: '' } } })
    assert.match(bad.body.error, /bumper_f/) // required addon can't be "None"
})

test('unknown fields are dropped and a malformed id is a 404', async () => {
    const c = await signedInClient(srv.base)
    const res = await c.post('/api/builds', { name: 'x', config: { ...config(), evil: '<script>' } })
    assert.equal(res.body.build.config.evil, undefined)
    assert.equal((await c.get('/api/builds/not-a-uuid')).status, 404)
})
