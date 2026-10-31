import { useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { auth, authPersistence } from './firebase'
import {
  Gamepad2, Eye, EyeOff, Mail, LockKeyhole, UserRound, ArrowRight,
  LoaderCircle, Sparkles, ShieldCheck, Zap, Wifi, WifiOff,
  CheckCircle2, CircleAlert, UserRoundPlus,
} from 'lucide-react'

const makeLocalGuest = () => {
  let guestId = localStorage.getItem('quiz-arena-local-guest-id')
  if (!guestId) {
    guestId = `guest-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
    localStorage.setItem('quiz-arena-local-guest-id', guestId)
  }
  localStorage.setItem('quiz-arena-local-guest-active', 'true')

  return {
    uid: guestId,
    displayName: 'Guest Player',
    isAnonymous: true,
    isLocalGuest: true,
  }
}

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    number: /\d/.test(password),
    letter: /[a-zA-Z]/.test(password),
  }), [password])

  const passwordScore = Object.values(passwordChecks).filter(Boolean).length
  const passwordStrength = [
    { label: 'Enter a password', color: 'bg-slate-700', width: '0%' },
    { label: 'Weak password', color: 'bg-red-500', width: '33%' },
    { label: 'Fair password', color: 'bg-yellow-500', width: '66%' },
    { label: 'Strong password', color: 'bg-emerald-500', width: '100%' },
  ][password ? passwordScore : 0]

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  function getFirebaseError(err) {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered. Try logging in.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/weak-password': 'Your password must contain at least 6 characters.',
      'auth/network-request-failed': 'Connection failed. Check your internet connection, or use Guest Mode below.',
      'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase.',
      'auth/invalid-api-key': 'Firebase configuration is invalid. Check your firebase.js file.',
    }
    return messages[err.code] || err.message || 'Something went wrong. Please try again.'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      setError('Please complete all required fields.')
      return
    }

    if (mode === 'register') {
      if (name.trim().length < 2) return setError('Your username must have at least 2 characters.')
      if (password.length < 8) return setError('Use at least 8 characters for a stronger password.')
      if (!passwordChecks.number || !passwordChecks.letter) return setError('Your password must contain at least one letter and one number.')
      if (password !== confirmPassword) return setError('Passwords do not match.')
    }

    if (!navigator.onLine) {
      setError('Login and registration need internet. You can still enter using Offline Guest Mode.')
      return
    }

    setLoading(true)
    try {
      await authPersistence
      let result

      if (mode === 'register') {
        result = await createUserWithEmailAndPassword(auth, cleanEmail, password)
        await updateProfile(result.user, { displayName: name.trim() })
      } else {
        result = await signInWithEmailAndPassword(auth, cleanEmail, password)
      }

      localStorage.removeItem('quiz-arena-local-guest-active')
      localStorage.setItem('quiz-arena-registered-account-cache', JSON.stringify({ uid: result.user.uid, email: result.user.email, displayName: result.user.displayName || cleanEmail.split('@')[0] }))
      onLogin?.(result.user)
    } catch (err) {
      setError(getFirebaseError(err))
    } finally {
      setLoading(false)
    }
  }

  function handleOfflineAccount() {
    setError('')
    try {
      const raw = localStorage.getItem('quiz-arena-registered-account-cache')
      const cached = raw ? JSON.parse(raw) : null
      if (!cached?.uid || !cached?.email) return setError('No previously signed-in account is saved on this device. Connect to the internet and sign in first.')
      const enteredEmail = email.trim().toLowerCase()
      if (enteredEmail && enteredEmail !== cached.email.toLowerCase()) {
        return setError(`This device has a saved account for ${cached.email}. Enter that email or clear the email field.`)
      }
      setEmail(cached.email)
      onLogin?.({ uid: cached.uid, email: cached.email, displayName: cached.displayName, isOfflineAccount: true })
    } catch {
      setError('Could not open the saved account on this device.')
    }
  }

  function handleGuest() {
    setError('')
    // Local guest mode deliberately does not call Firebase.
    // This allows the player to enter while fully offline.
    try {
      const guest = makeLocalGuest()
      onLogin?.(guest)
    } catch {
      setError('Could not start local Guest Mode. Please enable site storage in your browser.')
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070914] px-4 py-8 text-white selection:bg-violet-500/30">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-700/25 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <section className="hidden lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-xs font-bold tracking-[0.18em] text-violet-300">
            <Sparkles size={15} /> THE ULTIMATE QUIZ EXPERIENCE
          </div>
          <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-300/30 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-2xl shadow-violet-900/50">
            <Gamepad2 size={42} strokeWidth={2.2} />
          </div>
          <h1 className="text-7xl font-black leading-[0.95] tracking-tight">
            Quiz<br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Arena.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-slate-400">
            Create your own quizzes, challenge your friends, and prove that you're the ultimate quiz champion.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
              <Zap className="mb-3 text-violet-400" size={23} />
              <p className="font-bold">Play & Create</p>
              <p className="mt-1 text-xs text-slate-500">Build your own challenges</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur">
              <ShieldCheck className="mb-3 text-fuchsia-400" size={23} />
              <p className="font-bold">Your Arena</p>
              <p className="mt-1 text-xs text-slate-500">Your quizzes, your rules</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-7 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-xl shadow-violet-900/40">
              <Gamepad2 size={34} />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Quiz <span className="text-violet-400">Arena</span></h1>
            <p className="mt-2 text-sm text-slate-400">Challenge your mind. Play anywhere.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#111626]/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
            <div className="mb-7">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">Player Access</span>
                <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${online ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
                  <span className={`h-2 w-2 rounded-full ${online ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`} />
                  {online ? 'Online' : 'Offline Mode'}
                </div>
              </div>
              <h2 className="text-3xl font-black tracking-tight">{mode === 'login' ? 'Welcome back!' : 'Join the Arena'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {mode === 'login' ? 'Sign in to continue your quiz journey.' : 'Create your player account and start competing.'}
              </p>
            </div>

            <div className="mb-7 grid grid-cols-2 gap-1 rounded-xl border border-white/5 bg-black/30 p-1">
              {['login', 'register'].map((item) => (
                <button key={item} type="button" onClick={() => changeMode(item)} className={`rounded-lg py-3 text-sm font-bold capitalize transition-all ${mode === item ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  {item}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">Username</label>
                  <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#090e1b] px-4 transition focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/10">
                    <UserRound size={18} className="text-slate-500 group-focus-within:text-violet-400" />
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your username" autoComplete="name" required minLength={2} maxLength={40} className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-600" />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Email address</label>
                <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#090e1b] px-4 transition focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/10">
                  <Mail size={18} className="text-slate-500 group-focus-within:text-violet-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-600" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">Password</label>
                <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#090e1b] px-4 transition focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/10">
                  <LockKeyhole size={18} className="text-slate-500 group-focus-within:text-violet-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? 'Create a strong password' : 'Enter your password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : 6} required className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-600" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-500 transition hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === 'register' && password.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Password strength</span><span className={passwordScore === 3 ? 'font-semibold text-emerald-400' : 'font-semibold text-yellow-400'}>{passwordStrength.label}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`} style={{ width: passwordStrength.width }} /></div>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <span className={passwordChecks.length ? 'text-emerald-400' : 'text-slate-500'}>{passwordChecks.length ? '✓' : '○'} 8+ characters</span>
                      <span className={passwordChecks.letter ? 'text-emerald-400' : 'text-slate-500'}>{passwordChecks.letter ? '✓' : '○'} Letter</span>
                      <span className={passwordChecks.number ? 'text-emerald-400' : 'text-slate-500'}>{passwordChecks.number ? '✓' : '○'} Number</span>
                    </div>
                  </div>
                )}
              </div>

              {mode === 'register' && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">Confirm password</label>
                  <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#090e1b] px-4 transition focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/10">
                    <LockKeyhole size={18} className="text-slate-500 group-focus-within:text-violet-400" />
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter your password again" autoComplete="new-password" required className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-600" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-slate-500 transition hover:text-white" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && <p className={`mt-2 flex items-center gap-1.5 text-xs ${password === confirmPassword ? 'text-emerald-400' : 'text-red-400'}`}>{password === confirmPassword ? <><CheckCircle2 size={13} /> Passwords match</> : <><CircleAlert size={13} /> Passwords do not match</>}</p>}
                </div>
              )}

              {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm leading-5 text-red-300"><CircleAlert size={18} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

              <button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 font-bold shadow-lg shadow-violet-900/30 transition-all hover:-translate-y-0.5 hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <><LoaderCircle size={19} className="animate-spin" /> Please wait...</> : <>{mode === 'login' ? 'Enter the Arena' : 'Create My Account'}<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>}
              </button>
            </form>

            {!online && mode === 'login' && localStorage.getItem('quiz-arena-registered-account-cache') && (
              <button type="button" onClick={handleOfflineAccount} disabled={loading} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 py-3.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50">
                <ShieldCheck size={18} /> Continue with my saved account offline
              </button>
            )}

            <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><span className="text-[10px] font-bold tracking-[0.2em] text-slate-600">OR PLAY WITHOUT AN ACCOUNT</span><div className="h-px flex-1 bg-white/10" /></div>

            <button type="button" onClick={handleGuest} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 py-3.5 text-sm font-bold text-white transition hover:border-violet-400/60 hover:bg-violet-500/20">
              <UserRoundPlus size={18} className="text-violet-300" />
              Continue as Guest — Offline
            </button>

            <div className="mt-5 rounded-xl border border-sky-500/15 bg-sky-500/[0.05] p-3">
              <div className="flex items-start gap-2.5">
                {online ? <Wifi size={17} className="mt-0.5 shrink-0 text-sky-400" /> : <WifiOff size={17} className="mt-0.5 shrink-0 text-sky-400" />}
                <div>
                  <p className="text-xs font-bold text-sky-300">{online ? 'Online + Offline Guest Mode' : 'Offline Guest Mode Available'}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">Guest Mode opens locally without Firebase sign-in. Your quizzes and progress can be saved on this device. Login and registration need internet.</p>
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] leading-5 text-slate-500"><ShieldCheck size={13} className="mr-1 inline text-violet-400" /> Play fair. Respect players. Enjoy the Arena.</p>
          </div>
          <p className="mt-5 text-center text-xs text-slate-600">QUIZ ARENA © 2026 · ALL RIGHTS RESERVED</p>
        </section>
      </div>
    </main>
  )
}
