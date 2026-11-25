import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, client, signedInClient } from './helpers.js'
import vehicleConfigs from '../../vehicleConfigs.js'

let srv
before(async () => (srv = await startServer()))
after(async () => srv.stop())

// Smallest valid PNG (1×1 transparent pixel)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

const newBuild = async (c, isPublic) =>
    (await c.post('/api/builds', { name: 'Shared rig', config: structuredClone(vehicleConfigs.defaults), is_public: isPublic })).body.build

test('a public build is readable by slug without signing in', async () => {
    const owner = await signedInClient(srv.base)
    const { slug } = await newBuild(owner, true)

    const res = await client(srv.base).get(`/api/b/${slug}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.build.name, 'Shared rig')
    assert.equal(res.body.build.config.body, vehicleConfigs.defaults.body)
    assert.equal(res.body.build.id, undefined) // internal ids and user ids stay private
    assert.equal(res.body.build.user_id, undefined)
})

test('a private build is a 404 by slug, until it is made public', async () => {
    const owner = await signedInClient(srv.base)
    const { id, slug } = await newBuild(owner, false)
    const visitor = client(srv.base)

    assert.equal((await visitor.get(`/api/b/${slug}`)).status, 404)
    await owner.patch(`/api/builds/${id}`, { is_public: true })
    assert.equal((await visitor.get(`/api/b/${slug}`)).status, 200)
    assert.equal((await visitor.get('/api/b/doesnotx')).status, 404)
})

test('owner uploads a thumbnail; who can see it follows is_public', async () => {
    const owner = await signedInClient(srv.base)
    const stranger = client(srv.base)
    const { id } = await newBuild(owner, false)
    const path = `/api/builds/${id}/thumbnail`

    assert.equal((await stranger.put(path, PNG, 'image/png')).status, 401)
    assert.equal((await owner.put(path, Buffer.from('not an image'), 'image/png')).status, 415)

    const up = await owner.put(path, PNG, 'image/png')
    assert.equal(up.status, 200)
    const url = up.body.thumbnail_url
    assert.match(url, new RegExp(`^/api/thumbnails/${id}\\?v=\\d+$`))

    // Private build: the owner sees it, a stranger doesn't.
    const mine = await owner.get(url)
    assert.equal(mine.status, 200)
    assert.equal(mine.type, 'image/png')
    assert.deepEqual(mine.body, PNG)
    assert.equal((await stranger.get(url)).status, 404)

    // Make it public: now anyone can load it.
    await owner.patch(`/api/builds/${id}`, { is_public: true })
    assert.equal((await stranger.get(url)).status, 200)
})

test("you can't upload a thumbnail to someone else's build", async () => {
    const owner = await signedInClient(srv.base)
    const other = await signedInClient(srv.base)
    const { id } = await newBuild(owner, true)
    assert.equal((await other.put(`/api/builds/${id}/thumbnail`, PNG, 'image/png')).status, 404)
})

test('thumbnails over 300 KB are refused', async () => {
    const c = await signedInClient(srv.base)
    const { id } = await newBuild(c, false)
    const big = Buffer.concat([PNG, Buffer.alloc(301 * 1024)])
    assert.equal((await c.put(`/api/builds/${id}/thumbnail`, big, 'image/png')).status, 413)
})
