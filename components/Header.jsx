import VehicleSwitcher from './VehicleSwitcher'
import GitHubIcon from '../assets/images/icons/GitHub.svg'
import useAuthStore from '../store/authStore'

function Header() {
    const user = useAuthStore((state) => state.user)
    const status = useAuthStore((state) => state.status)
    const openDialog = useAuthStore((state) => state.openDialog)
    const logout = useAuthStore((state) => state.logout)

    return (
        <div id='header' className='absolute top-0 h-15 grid grid-cols-[1fr_auto_1fr] items-stretch w-full border-none z-50 text-stone-900'>
            <div />

            <div className='min-w-0 justify-self-center flex items-center justify-center'>
                <VehicleSwitcher />
            </div>

            <div className='px-5 flex justify-end items-center gap-3 min-w-0'>
                {status === 'signed_in' && (
                    <>
                        <span className='px-4 py-2 rounded-full bg-black/80 text-white text-sm font-medium truncate max-w-48' title={user.email}>
                            {user.display_name || user.email}
                        </span>
                        <button className='secondary' onClick={logout}>
                            Sign out
                        </button>
                    </>
                )}
                {status === 'guest' && <button onClick={openDialog}>Sign in</button>}
                <a target='_blank' rel='noopener noreferrer' href='https://github.com/Ninj22/SVR-PERFORMANCE' title='GitHub'>
                    <GitHubIcon className='icon' />
                </a>
            </div>
        </div>
    )
}

export default Header
