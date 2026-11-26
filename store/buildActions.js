// Everything that saves, deletes, shares or loads builds goes through here.
// Signed out: builds live in localStorage, exactly as before.
// Signed in: builds live in your account via the API, and localStorage is left alone.
import useGameStore from './gameStore'
import { api } from '../lib/api'

const MIGRATED_FLAG = 'svr_local_builds_migrated'

const readLocalBuilds = () => {
    try {
        return JSON.parse(localStorage.getItem('savedVehicles')) || { current: null }
    } catch {
        return { current: null }
    }
}

// The shape VehicleSwitcher already expects ({ name, config }), plus the server's extra fields.
const toEntry = (build) => ({
    name: build.name,
    config: build.config,
    slug: build.slug,
    is_public: build.is_public,
    thumbnail_url: build.thumbnail_url,
})

const notifyError = (err) => useGameStore.getState().showNotification({ title: 'Error', text: err.message || 'Something went wrong.', type: 'error' })

// The first time anyone signs in on this browser, copy the localStorage builds into that account.
// The flag is set before posting, so a double-run (React StrictMode in dev) can't copy them twice.
// The local copy is kept as a backup.
const migrateLocalBuilds = async () => {
    if (localStorage.getItem(MIGRATED_FLAG)) return 0
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString())

    let moved = 0
    for (const [id, vehicle] of Object.entries(readLocalBuilds())) {
        if (id === 'current' || !vehicle?.config) continue
        try {
            const name = String(vehicle.name || 'Untitled build').slice(0, 60)
            await api('/builds', { method: 'POST', body: { name, config: vehicle.config } })
            moved++
        } catch (err) {
            console.warn(`Skipped local build "${vehicle.name}":`, err.message)
        }
    }
    return moved
}

// Called after sign-in: switch the vehicle list over to the account's builds.
// setState (not setSavedVehicles) so the truck on screen doesn't reset.
export const loadAccountBuilds = async () => {
    const moved = await migrateLocalBuilds()
    const { builds } = await api('/builds')

    const savedVehicles = { current: null }
    for (const build of builds) savedVehicles[build.id] = toEntry(build)
    useGameStore.setState({ remoteBuilds: true, savedVehicles })

    if (moved) {
        useGameStore.getState().showNotification({
            title: 'Builds moved',
            text: `${moved} build${moved === 1 ? '' : 's'} saved on this browser ${moved === 1 ? 'is' : 'are'} now in your account.`,
            type: 'success',
        })
    }
}

// Called after sign-out: back to localStorage.
export const switchToLocalBuilds = () => useGameStore.setState({ remoteBuilds: false, savedVehicles: readLocalBuilds() })

// Same rule as before: same name as the current build updates it, a new name saves a new build.
export const saveBuild = async (name) => {
    const { savedVehicles, currentVehicle, remoteBuilds, setSavedVehicles } = useGameStore.getState()
    const currentId = savedVehicles.current
    const isUpdate = currentId && savedVehicles[currentId]?.name === name

    if (!remoteBuilds) {
        const id = isUpdate ? currentId : Date.now()
        setSavedVehicles({ ...savedVehicles, current: id, [id]: { name, config: currentVehicle } })
        return
    }

    const { build } = isUpdate
        ? await api(`/builds/${currentId}`, { method: 'PATCH', body: { config: currentVehicle } })
        : await api('/builds', { method: 'POST', body: { name, config: currentVehicle } })

    setSavedVehicles({ ...useGameStore.getState().savedVehicles, current: build.id, [build.id]: toEntry(build) })
}

export const deleteBuild = async (id) => {
    const { remoteBuilds, deleteSavedVehicle } = useGameStore.getState()
    try {
        if (remoteBuilds) await api(`/builds/${id}`, { method: 'DELETE' })
        deleteSavedVehicle(id)
    } catch (err) {
        notifyError(err)
    }
}

// Asks <Screenshot /> (inside the 3D canvas) for a JPEG of the current view.
// Gives up after 10 seconds so sharing never hangs on it.
const captureThumbnail = () =>
    Promise.race([
        new Promise((resolve) => window.dispatchEvent(new CustomEvent('captureThumbnail', { detail: { resolve } }))),
        new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
    ])

// Signed in with a saved build: make it public with its latest changes, upload a thumbnail,
// and return a short /b/slug link. Otherwise fall back to the old ?config= link.
export const shareBuild = async () => {
    const { savedVehicles, currentVehicle, remoteBuilds, setSavedVehicles } = useGameStore.getState()
    const id = savedVehicles.current

    if (!remoteBuilds || !id) {
        return { url: `${window.location.origin}/?config=${encodeURIComponent(JSON.stringify(currentVehicle))}`, short: false }
    }

    const { build } = await api(`/builds/${id}`, { method: 'PATCH', body: { is_public: true, config: currentVehicle } })

    try {
        const blob = await captureThumbnail()
        if (blob) build.thumbnail_url = (await api(`/builds/${id}/thumbnail`, { method: 'PUT', body: blob })).thumbnail_url
    } catch (err) {
        // A missing thumbnail shouldn't stop the share.
        console.warn('Thumbnail upload failed:', err.message)
    }

    setSavedVehicles({ ...useGameStore.getState().savedVehicles, [id]: toEntry(build) })
    return { url: `${window.location.origin}/b/${build.slug}`, short: true }
}

// Opening a /b/slug link: show that build without touching the visitor's own saves.
export const loadSharedBuild = async (slug) => {
    const { build } = await api(`/b/${slug}`)
    useGameStore.setState((state) => ({
        currentVehicle: build.config,
        savedVehicles: { ...state.savedVehicles, current: null },
    }))
    return build
}
