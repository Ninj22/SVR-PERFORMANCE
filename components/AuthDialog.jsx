import { useState, useEffect, useRef } from 'react'
import useAuthStore from '../store/authStore'

const EMPTY = { email: '', password: '', display_name: '' }

// Sign in / create account modal. Styled to match <Notification />.
export default function AuthDialog() {
    const open = useAuthStore((state) => state.dialogOpen)
    const close = useAuthStore((state) => state.closeDialog)
    const login = useAuthStore((state) => state.login)
    const register = useAuthStore((state) => state.register)

    const [mode, setMode] = useState('login')
    const [form, setForm] = useState(EMPTY)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const emailRef = useRef(null)

    useEffect(() => {
        if (open) {
            setError('')
            setTimeout(() => emailRef.current?.focus(), 50)
        }
    }, [open])

    if (!open) return null

    const isLogin = mode === 'login'
    const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

    const submit = async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
            if (isLogin) await login(form.email, form.password)
            else await register(form.email, form.password, form.display_name)
            setForm(EMPTY)
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className='fixed inset-0 flex items-center justify-center bg-black/20 z-50' onClick={close}>
            <form
                className='bg-black/80 text-gray-400 rounded-xl space-y-4 p-8 max-w-sm w-full shadow-xl'
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === 'Escape' && close()}
                onSubmit={submit}>
                <h2 className='text-xl text-white/90 font-bold'>{isLogin ? 'Sign in' : 'Create an account'}</h2>
                <p className='text-sm'>Your builds are saved to your account, so they follow you to any device and you can share short links.</p>

                {!isLogin && (
                    <input type='text' className='w-full' placeholder='Display name (optional)' autoComplete='nickname' maxLength={50} value={form.display_name} onChange={update('display_name')} />
                )}
                <input ref={emailRef} type='email' className='w-full' placeholder='Email' autoComplete='email' required value={form.email} onChange={update('email')} />
                <input
                    type='password'
                    className='w-full'
                    placeholder={isLogin ? 'Password' : 'Password (8+ characters)'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                    minLength={isLogin ? undefined : 8}
                    maxLength={72}
                    value={form.password}
                    onChange={update('password')}
                />

                {error && (
                    <p className='text-sm text-red-400' role='alert'>
                        {error}
                    </p>
                )}

                <div className='flex items-center justify-between gap-4'>
                    <button
                        type='button'
                        className='secondary'
                        onClick={() => {
                            setMode(isLogin ? 'register' : 'login')
                            setError('')
                        }}>
                        {isLogin ? 'Create account' : 'I have an account'}
                    </button>
                    <button type='submit' disabled={busy}>
                        {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
                    </button>
                </div>
            </form>
        </div>
    )
}
