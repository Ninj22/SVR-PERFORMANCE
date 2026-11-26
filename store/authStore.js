import { create } from 'zustand'
import { api } from '../lib/api'
import { loadAccountBuilds, switchToLocalBuilds } from './buildActions'

let initPromise = null

const useAuthStore = create((set) => {
    const signedIn = async (user) => {
        set({ user, status: 'signed_in', dialogOpen: false })
        await loadAccountBuilds()
    }

    return {
        user: null,
        status: 'loading', // 'loading' | 'guest' | 'signed_in'
        dialogOpen: false,
        openDialog: () => set({ dialogOpen: true }),
        closeDialog: () => set({ dialogOpen: false }),

        // Runs once on page load. No backend reachable (e.g. a static deploy) just means "guest".
        init: () =>
            (initPromise ??= api('/auth/me')
                .then(({ user }) => signedIn(user))
                .catch(() => set({ user: null, status: 'guest' }))),

        login: async (email, password) => {
            const { user } = await api('/auth/login', { method: 'POST', body: { email, password } })
            await signedIn(user)
        },

        register: async (email, password, display_name) => {
            const { user } = await api('/auth/register', { method: 'POST', body: { email, password, display_name } })
            await signedIn(user)
        },

        logout: async () => {
            await api('/auth/logout', { method: 'POST' }).catch(() => {})
            set({ user: null, status: 'guest' })
            switchToLocalBuilds()
        },
    }
})

export default useAuthStore
