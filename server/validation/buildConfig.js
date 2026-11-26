// Checks a vehicle config against vehicleConfigs.js — the same file the 3D app uses —
// and returns a clean copy containing only known fields with the right types.
// The editor's <select>s send numbers as strings ("2", "0.6"), so numbers are coerced.
import vehicleConfigs from '../../vehicleConfigs.js'

const RIM_COLORS = ['flat_black', 'gloss_black', 'silver', 'chrome', 'body']
const ROUGHNESS = [0, 0.2, 0.6]
const HEX_COLOR = /^#[0-9a-f]{6}$/i

// Same ranges as the sliders and selects in components/Editor.jsx
const RANGES = {
    lift: [-2, 8],
    wheel_offset: [0, 0.1],
    rim_diameter: [14, 24],
    rim_width: [8, 16],
    tire_diameter: [30, 40],
}

const has = (obj, key) => typeof key === 'string' && Object.hasOwn(obj, key)

const toNumber = (value, field, errors) => {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
    if (typeof n !== 'number' || !Number.isFinite(n)) {
        errors.push(`${field} must be a number`)
        return undefined
    }
    return n
}

export const validateConfig = (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'config must be an object' }

    // Old saves used `id` instead of `body` (same shim as gameStore.js)
    const raw = { ...input, body: input.body ?? input.id }
    const errors = []
    const config = {}

    if (!has(vehicleConfigs.vehicles, raw.body)) errors.push(`unknown vehicle body "${raw.body}"`)
    else config.body = raw.body

    if (!has(vehicleConfigs.wheels.rims, raw.rim)) errors.push(`unknown rim "${raw.rim}"`)
    else config.rim = raw.rim

    if (!has(vehicleConfigs.wheels.tires, raw.tire)) errors.push(`unknown tire "${raw.tire}"`)
    else config.tire = raw.tire

    if (!HEX_COLOR.test(raw.color ?? '')) errors.push('color must be a hex colour like #B91818')
    else config.color = raw.color

    for (const field of ['rim_color', 'rim_color_secondary']) {
        if (!RIM_COLORS.includes(raw[field])) errors.push(`${field} must be one of ${RIM_COLORS.join(', ')}`)
        else config[field] = raw[field]
    }

    const roughness = toNumber(raw.roughness ?? 0, 'roughness', errors)
    if (roughness !== undefined && !ROUGHNESS.includes(roughness)) errors.push(`roughness must be one of ${ROUGHNESS.join(', ')}`)
    else if (roughness !== undefined) config.roughness = roughness

    for (const [field, [min, max]] of Object.entries(RANGES)) {
        const n = toNumber(raw[field] ?? vehicleConfigs.defaults[field], field, errors)
        if (n === undefined) continue
        if (n < min || n > max) errors.push(`${field} must be between ${min} and ${max}`)
        else config[field] = n
    }

    config.spare = raw.spare === undefined ? true : Boolean(raw.spare)

    // Addons: every key must exist for this body, every value must be one of its options.
    // An empty string means "None", which is only allowed when the addon isn't required.
    config.addons = {}
    const vehicle = vehicleConfigs.vehicles[config.body]
    const addons = raw.addons ?? {}
    if (typeof addons !== 'object' || Array.isArray(addons)) errors.push('addons must be an object')
    else if (vehicle) {
        for (const [key, value] of Object.entries(addons)) {
            const addon = vehicle.addons[key]
            if (!has(vehicle.addons, key)) errors.push(`unknown addon "${key}" for ${config.body}`)
            else if (value === '' && !addon.required) config.addons[key] = ''
            else if (!has(addon.options, value)) errors.push(`unknown option "${value}" for addon ${key}`)
            else config.addons[key] = value
        }
    }

    return errors.length ? { error: errors.join('; ') } : { config }
}
