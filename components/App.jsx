import { useEffect } from 'react'

import useGameStore from '../store/gameStore'
import useAuthStore from '../store/authStore'
import { loadSharedBuild } from '../store/buildActions'

import Header from './Header'
import Sidebar from './Sidebar'
import Canvas from './Canvas'
import Actions from './Actions'
import Notification from './Notification'
import AuthDialog from './AuthDialog'

const SHARE_PATH = /^\/b\/([A-Za-z0-9]{8})\/?$/

export default function App() {
    const loadVehicleFromUrl = useGameStore((state) => state.loadVehicleFromUrl)
    const showNotification = useGameStore((state) => state.showNotification)
    const initAuth = useAuthStore((state) => state.init)

    useEffect(() => {
        // Restore the session from the cookie, if there is one.
        initAuth()

        // A /b/xxxxxxxx share link, or the older ?config= link.
        const match = window.location.pathname.match(SHARE_PATH)
        if (match) {
            loadSharedBuild(match[1])
                .then((build) =>
                    showNotification({
                        title: build.name,
                        text: `Shared by ${build.author || 'an SVR builder'}. Save it to keep your own copy.`,
                        type: 'success',
                    })
                )
                .catch(() => showNotification({ title: 'Build not found', text: 'This link is private or no longer exists.', type: 'error' }))
                .finally(() => window.history.replaceState({}, '', '/'))
        } else {
            loadVehicleFromUrl()
        }
    }, [initAuth, loadVehicleFromUrl, showNotification])

    return (
        <div className='App'>
            <Header />
            <Canvas />
            <Sidebar />
            <Actions />
            <Notification />
            <AuthDialog />
        </div>
    )
}
