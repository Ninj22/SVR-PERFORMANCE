import useGameStore from '../store/gameStore'
import useAuthStore from '../store/authStore'
import { saveBuild, shareBuild } from '../store/buildActions'

const Actions = () => {
    const savedVehicles = useGameStore((state) => state.savedVehicles)
    const showNotification = useGameStore((state) => state.showNotification)
    const signedIn = useAuthStore((state) => state.status === 'signed_in')

    const showError = (err) => showNotification({ title: 'Error', text: err.message || 'Something went wrong.', type: 'error' })

    // Save to your account when signed in, otherwise to this browser.
    const saveVehicle = () => {
        const vehicleName = savedVehicles.current ? savedVehicles[savedVehicles.current]?.name : ''

        showNotification({
            title: 'Save Your Vehicle',
            text: signedIn ? 'Enter a name for your vehicle:' : 'Enter a name for your vehicle. Sign in to keep it on every device.',
            input: true,
            inputValue: vehicleName,
            showCancelButton: true,
            confirmButtonText: 'Save',
            cancelButtonText: 'Cancel',
            onConfirm: async (result) => {
                const name = result.value.trim()
                if (!name) {
                    showNotification({ title: 'Error', text: 'Please enter a name for your vehicle.', type: 'error', onConfirm: saveVehicle })
                    return
                }
                try {
                    await saveBuild(name)
                    showNotification({ title: 'Saved!', text: signedIn ? 'Saved to your account.' : 'Your vehicle has been saved.', type: 'success' })
                } catch (err) {
                    showError(err)
                }
            },
        })
    }

    // Signed in: short /b/xxxxxxxx link with a thumbnail. Signed out: the old ?config= link.
    const shareVehicle = async () => {
        if (signedIn && !savedVehicles.current) {
            showNotification({
                title: 'Save first',
                text: 'Save this build to get a short share link.',
                showCancelButton: true,
                confirmButtonText: 'Save',
                onConfirm: saveVehicle,
            })
            return
        }

        try {
            const { url, short } = await shareBuild()
            showNotification({
                title: 'Share Your Vehicle',
                text: short ? 'Anyone with this link can view this build:' : 'Copy this link to share your vehicle. Sign in to get a short link with a preview image.',
                html: `<a href="${url}" target="_blank" rel="noopener" class="break-all underline">${short ? url : 'Shareable link'}</a>`,
                showCancelButton: true,
                confirmButtonText: 'Copy Link',
                cancelButtonText: 'Close',
                onConfirm: () =>
                    navigator.clipboard
                        .writeText(url)
                        .then(() => showNotification({ title: 'Copied!', text: 'The link is on your clipboard.', type: 'success' }))
                        .catch(() => showError(new Error('Could not copy the link.'))),
            })
        } catch (err) {
            showError(err)
        }
    }

    const takeScreenshot = () => window.dispatchEvent(new Event('takeScreenshot'))

    return (
        <div id='actions' className='flex gap-2 absolute bottom-4 right-4'>
            <button onClick={saveVehicle}>Save</button>
            <button onClick={shareVehicle}>Share</button>
            <button onClick={takeScreenshot}>Screenshot</button>
        </div>
    )
}

export default Actions
