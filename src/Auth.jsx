
import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInAnonymously,
} from 'firebase/auth'
import { auth, authPersistence } from './firebase'
import {
  Gamepad2,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  UserRound,
  ArrowRight,
  LoaderCircle,
} from 'lucide-react'

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authPersistence

      let result

      if (mode === 'register') {
        if (name.trim().length < 2) {
          throw new Error('Please enter a name with at least 2 characters.')
        }

        result = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        )

        await updateProfile(result.user, {
          displayName: name.trim(),
        })
      } else {
        result = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        )
      }

      onLogin(result.user)
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/weak-password': 'Use a password with at least 6 characters.',
        'auth/network-request-failed': 'Network error. Please try again.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
      }

      setError(
        messages[err.code] ||
        err.message ||
        'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleGuest() {
    setError('')
    setLoading(true)

    try {
      await authPersistence
      const result = await signInAnonymously(auth)
      onLogin(result.user)
    } catch (err) {
      setError(
        err.code === 'auth/operation-not-allowed'
          ? 'Enable Anonymous sign-in in Firebase Authentication.'
          : err.message || 'Unable to enter as guest.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#090d18] px-4 py-10 text-white flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-900/40">
            <Gamepad2 size={34} />
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            Quiz <span className="text-violet-400">Arena</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Challenge your mind. Play with friends.
          </p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#111827] p-6 shadow-2xl sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-black/20 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className={`rounded-lg py-3 text-sm font-bold transition ${
                mode === 'login'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError('')
              }}
              className={`rounded-lg py-3 text-sm font-bold transition ${
                mode === 'register'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <h2 className="text-2xl font-bold">
            {mode === 'login' ? 'Welcome back!' : 'Create your account'}
          </h2>

          <p className="mb-6 mt-2 text-sm text-slate-400">
            {mode === 'login'
              ? 'Sign in to continue to your arena.'
              : 'Join Quiz Arena and start playing.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Username
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4">
                  <UserRound size={18} className="text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your display name"
                    autoComplete="name"
                    required
                    minLength={2}
                    className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Email address
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4">
                <Mail size={18} className="text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4">
                <LockKeyhole size={18} className="text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={
                    mode === 'register' ? 'new-password' : 'current-password'
                  }
                  minLength={6}
                  required
                  className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 font-bold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle size={19} className="animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">OR</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGuest}
            disabled={loading}
            className="w-full rounded-xl border border-white/10 py-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
          >
            Continue as Guest
          </button>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            By continuing, you agree to play fairly and respect other players.
          </p>
        </section>
      </div>
    </main>
  )
}
