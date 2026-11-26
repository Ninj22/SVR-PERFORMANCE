// Thin wrapper around fetch for our own /api routes.
// Sends and receives JSON, sends Blobs (images) as-is, and turns error responses into thrown errors.
export class ApiError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

export const api = async (path, { method = 'GET', body } = {}) => {
    const isBlob = body instanceof Blob
    const res = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': isBlob ? body.type : 'application/json' },
        body: body === undefined ? undefined : isBlob ? body : JSON.stringify(body),
    })
    if (res.status === 204) return null

    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`)
    return data
}
