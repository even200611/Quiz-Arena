import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth'
import {
  addDoc, arrayUnion, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import {
  Activity, ArrowLeft, Award, BookOpen, Check, CheckCheck, CheckCircle2,
  ChevronRight, CircleUserRound, Clock3, Copy, Crown, Gamepad2, Globe2,
  Home, LogOut, MessageCircle, Moon, Plus, Search, Send, ShieldCheck,
  Smile, Sparkles, Sun, Swords, Trophy, UserPlus, Users, X, RotateCcw,
  Zap, Link2, Mail, MessageSquare, Medal, Flame, Menu, Trash2, Pencil, Volume2, VolumeX,
} from 'lucide-react'
import { auth, authPersistence, db } from './firebase'
import Auth from './Auth'
import {
  getLocalQuizzes, saveLocalQuiz, deleteLocalQuiz, getDeletedLocalQuizzes, markDeletedQuizSynced, isLocalQuizDeleted,
  getLocalChoices, saveLocalChoices,
  getLocalResults, saveLocalResult,
  getPendingLocalQuizzes, getPendingLocalResults,
  markLocalQuizSynced, markLocalResultSynced,
} from './offlineDb'

const initialQuizzes = [
  { id: 'general', title: 'General Knowledge Challenge', category: 'General Knowledge', difficulty: 'Easy', questions: [
    { question: 'What is the capital city of the Philippines?', options: ['Cebu City', 'Manila', 'Davao City', 'Quezon City'], correctAnswer: 1 },
    { question: 'How many days are there in a leap year?', options: ['364', '365', '366', '367'], correctAnswer: 2 },
    { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctAnswer: 1 },
    { question: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctAnswer: 3 },
    { question: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'], correctAnswer: 1 },
  ] },
  { id: 'science', title: 'Science and Technology', category: 'Science', difficulty: 'Medium', questions: [
    { question: 'Which gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctAnswer: 2 },
    { question: 'What is the chemical formula for water?', options: ['CO2', 'H2O', 'O2', 'NaCl'], correctAnswer: 1 },
    { question: 'Which part of a computer performs calculations?', options: ['Monitor', 'Keyboard', 'CPU', 'Mouse'], correctAnswer: 2 },
    { question: 'What does URL stand for?', options: ['Universal Reading Link', 'Uniform Resource Locator', 'United Resource List', 'User Reference Location'], correctAnswer: 1 },
    { question: 'Which of these is an input device?', options: ['Monitor', 'Speaker', 'Printer', 'Keyboard'], correctAnswer: 3 },
  ] },
  { id: 'logic', title: 'Brain Power Challenge', category: 'Logic', difficulty: 'Hard', questions: [
    { question: 'What number comes next: 2, 4, 8, 16, __?', options: ['18', '24', '32', '36'], correctAnswer: 2 },
    { question: 'If all roses are flowers, which statement must be true?', options: ['All flowers are roses', 'Roses are flowers', 'No roses are flowers', 'All plants are roses'], correctAnswer: 1 },
    { question: 'What is 15% of 200?', options: ['15', '20', '30', '35'], correctAnswer: 2 },
    { question: 'Which number is different from the others?', options: ['4', '9', '16', '18'], correctAnswer: 3 },
    { question: 'If today is Monday, what day is it after 10 days?', options: ['Wednesday', 'Thursday', 'Friday', 'Saturday'], correctAnswer: 1 },
  ] },
]
const categories = ['General Knowledge', 'Science', 'Technology', 'Mathematics', 'Logic', 'Other']
const emptyQuestion = () => ({ id: crypto.randomUUID(), type: 'multiple', question: '', options: ['', '', ''], correctAnswer: 0, correctText: '' })

function normalizeMultipleChoice(question) {
  const options = [...(question.options || [])]
  let correctAnswer = Number(question.correctAnswer || 0)
  if (options.length > 3 && correctAnswer > 2) {
    options[2] = options[correctAnswer]
    correctAnswer = 2
  }
  return { ...question, options: options.slice(0, 3), correctAnswer: Math.min(correctAnswer, 2) }
}
const emojis = ['😀','😂','🤣','😍','🥳','🔥','💜','💯','🎮','🏆','👏','😎','🤔','😭','👀','✨','🚀','💀','❤️','👍','🙏','🎯','🧠','⚡']

// Player identity avatars: expressive emoji-style gaming icons (no external image assets).
const PLAYER_AVATARS = [
  ['😎','Cool'],['🥷','Ninja'],['😈','Demon'],['👿','Rage'],['💀','Skull'],['☠️','Pirate'],['🤖','Cyber'],['👾','Pixel'],
  ['👽','Alien'],['🧛','Vampire'],['🧟','Zombie'],['🧙','Wizard'],['🧝','Elf'],['🦸','Hero'],['🦹','Villain'],['🥷🏻','Shadow'],
  ['🦊','Fox'],['🐺','Wolf'],['🦁','Lion'],['🐯','Tiger'],['🐉','Dragon'],['🦂','Scorpion'],['🦅','Eagle'],['🦈','Shark'],
  ['🐍','Snake'],['🦇','Bat'],['🐼','Panda'],['🦝','Raccoon'],['🦍','Gorilla'],['🐸','Frog'],['🦉','Owl'],['🐲','Dragon'],
  ['👑','Royal'],['🤴','Prince'],['👸','Queen'],['🥶','Frost'],['🔥','Inferno'],['⚡','Thunder'],['🌪️','Storm'],['🌑','Shadow'],
  ['🎭','Mystery'],['🕶️','Street'],['🤡','Chaos'],['🥳','Party'],['🤠','Outlaw'],['🤑','Boss'],['🤓','Genius'],['🧠','Brain'],
  ['👻','Ghost'],['👹','Oni'],['👺','Goblin'],['🧞','Genie'],['🧜','Mystic'],['🦖','Dino'],['🦄','Neon'],['🐙','Kraken'],
  ['💎','Diamond'],['🏆','Champion'],['🎯','Sniper'],['🚀','Rocket'],['🛸','UFO'],['🧿','Watcher'],['🪬','Charm'],['🦾','Mecha'],
]
const AVATAR_BACKGROUNDS = [
  { name: 'Neon Violet', value: 'from-violet-500 to-fuchsia-600' },
  { name: 'Cyber Blue', value: 'from-sky-500 to-blue-700' },
  { name: 'Inferno', value: 'from-orange-500 to-rose-700' },
  { name: 'Toxic Green', value: 'from-lime-400 to-emerald-700' },
  { name: 'Royal Gold', value: 'from-amber-300 to-orange-600' },
  { name: 'Dark Steel', value: 'from-slate-500 to-slate-900' },
  { name: 'Electric Pink', value: 'from-pink-500 to-purple-700' },
  { name: 'Ice', value: 'from-cyan-300 to-blue-600' },
]
function PlayerAvatar({ emoji = '😎', color = AVATAR_BACKGROUNDS[0].value, size = 'h-10 w-10', className = '' }) {
  return <div className={`${size} ${className} grid shrink-0 place-items-center rounded-full border-2 border-white/25 bg-gradient-to-br ${color} text-xl shadow-lg shadow-black/20`} aria-label="Player avatar">{emoji}</div>
}

const friendRoomId = (a, b) => `friends_${[a, b].sort().join('_')}`
const displayName = (u) => u?.displayName || u?.email?.split('@')[0] || 'Quiz Player'
const initials = (name = 'QP') => name.split(/[ @._-]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'QP'
const timeLabel = (value) => {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'
}
const presenceIsOnline = (friend) => friend?.presence === 'online' && Date.now() - Number(friend.presenceUpdatedAt || 0) < 90000
const lastSeenLabel = (value) => {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value?.seconds ? new Date(value.seconds * 1000) : null
  if (!date || Number.isNaN(date.getTime())) return 'Last seen: unknown'
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Last seen just now'
  if (minutes < 60) return `Last seen ${minutes}m ago`
  if (minutes < 1440) return `Last seen ${Math.floor(minutes / 60)}h ago`
  return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}
const normalizeAnswer = (value) => String(value ?? '').trim().toLocaleLowerCase()

function shuffleArray(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Randomize once before a round starts. For multiplayer, the host stores this
// exact version in Firestore so every player receives the same questions/options.
function prepareQuizForPlay(quiz) {
  const questions = shuffleArray(quiz.questions || []).map((original) => {
    const question = { ...original }
    if (question.type === 'multiple') {
      let options = [...(question.options || [])]
      let correctAnswer = Number(question.correctAnswer || 0)
      if (options.length > 3) {
        if (correctAnswer > 2) {
          options[2] = options[correctAnswer]
          correctAnswer = 2
        }
        options = options.slice(0, 3)
      }
      const shuffled = shuffleArray(options.map((label, index) => ({ label, correct: index === correctAnswer })))
      question.options = shuffled.map((item) => item.label)
      question.correctAnswer = Math.max(0, shuffled.findIndex((item) => item.correct))
    } else if (question.type === 'boolean') {
      // Keep True/False in their familiar order.
      question.options = ['True', 'False']
    }
    return question
  })
  return { ...quiz, questions }
}

// Reuse one AudioContext so answer sounds start quickly and consistently.
let answerAudioContext = null

function playAnswerTone(isCorrect) {
  if (typeof window === 'undefined') return
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return

  try {
    if (!answerAudioContext || answerAudioContext.state === 'closed') {
      answerAudioContext = new AudioContextClass()
    }

    const context = answerAudioContext
    if (context.state === 'suspended') {
      context.resume().catch((error) => console.warn('Could not resume audio:', error))
    }

    const now = context.currentTime
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.setValueAtTime(-20, now)
    compressor.knee.setValueAtTime(14, now)
    compressor.ratio.setValueAtTime(10, now)
    compressor.attack.setValueAtTime(0.003, now)
    compressor.release.setValueAtTime(0.16, now)

    // Extra output gain makes the sound more audible at moderate device volume.
    // Compression helps control peaks and reduce harsh clipping.
    const masterGain = context.createGain()
    masterGain.gain.setValueAtTime(1.55, now)
    compressor.connect(masterGain)
    masterGain.connect(context.destination)

    const soundBus = context.createGain()
    soundBus.gain.setValueAtTime(1, now)
    soundBus.connect(compressor)

    const addTone = ({ frequency, endFrequency, start = 0, duration = 0.22, type = 'sine', volume = 0.55 }) => {
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const toneStart = now + start
      const toneEnd = toneStart + duration

      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, toneStart)
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, toneEnd)
      }

      envelope.gain.setValueAtTime(0.0001, toneStart)
      envelope.gain.exponentialRampToValueAtTime(volume, toneStart + 0.012)
      envelope.gain.setValueAtTime(volume, Math.max(toneStart + 0.02, toneEnd - 0.045))
      envelope.gain.exponentialRampToValueAtTime(0.0001, toneEnd)

      oscillator.connect(envelope)
      envelope.connect(soundBus)
      oscillator.start(toneStart)
      oscillator.stop(toneEnd + 0.01)
    }

    if (isCorrect) {
      // Bright four-note victory chime with a fuller upper harmonic.
      ;[
        { frequency: 784, start: 0, duration: 0.24, volume: 0.52 },
        { frequency: 988, start: 0.11, duration: 0.25, volume: 0.52 },
        { frequency: 1175, start: 0.22, duration: 0.28, volume: 0.54 },
        { frequency: 1568, start: 0.34, duration: 0.38, volume: 0.58 },
      ].forEach((note) => {
        addTone({ ...note, type: 'triangle' })
        addTone({
          frequency: note.frequency * 2,
          start: note.start,
          duration: note.duration * 0.72,
          volume: 0.12,
          type: 'sine',
        })
      })
    } else {
      // Deeper descending buzzer with a low supporting tone.
      addTone({
        frequency: 185,
        endFrequency: 78,
        duration: 0.48,
        volume: 0.68,
        type: 'sawtooth',
      })
      addTone({
        frequency: 92,
        endFrequency: 55,
        duration: 0.42,
        volume: 0.42,
        type: 'triangle',
      })
    }

    // Disconnect the temporary nodes after playback; keep the shared context alive.
    window.setTimeout(() => {
      try {
        soundBus.disconnect()
        compressor.disconnect()
        masterGain.disconnect()
      } catch {}
    }, 1100)
  } catch (error) {
    console.warn('Audio feedback unavailable:', error)
  }
}
const isCorrectAnswer = (question, answer) => question.type === 'identification'
  ? normalizeAnswer(answer) === normalizeAnswer(question.correctText)
  : answer === question.correctAnswer
const answerLabel = (question, answer) => answer === undefined || answer === null || answer === ''
  ? 'Not answered'
  : question.type === 'identification' ? String(answer) : (question.options || [])[answer] || 'Not answered'

function mergeById(primary, secondary) {
  const map = new Map()
  for (const item of [...(secondary || []), ...(primary || [])]) {
    const key = item.id || item.localId
    if (key) map.set(key, { ...(map.get(key) || {}), ...item })
  }
  return [...map.values()]
}

function cleanForCloud(record) {
  const { ownerId, updatedAtLocal, createdAtLocal, syncStatus, localId, ...data } = record
  return data
}

function AppContent({ onQuizModeChange }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [quizzes, setQuizzes] = useState(initialQuizzes)
  const [results, setResults] = useState([])
  const [activeTab, setActiveTab] = useState('Overview')
  const [search, setSearch] = useState('')
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem('quiz-arena-theme') !== 'light' } catch { return true } })
  const [guestNameDraft, setGuestNameDraft] = useState('')
  const [renameNameDraft, setRenameNameDraft] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [avatarEmoji, setAvatarEmoji] = useState('😎')
  const [avatarColor, setAvatarColor] = useState(AVATAR_BACKGROUNDS[0].value)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [activeQuiz, setActiveQuiz] = useState(null)

  useEffect(() => {
    onQuizModeChange(Boolean(activeQuiz))
  }, [activeQuiz, onQuizModeChange])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [quizFinished, setQuizFinished] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [difficulty, setDifficulty] = useState('Easy')
  const [newQuestions, setNewQuestions] = useState([emptyQuestion()])
  const [savedChoices, setSavedChoices] = useState(() => {
    try { return JSON.parse(localStorage.getItem('quiz-arena-choice-library') || '[]') }
    catch { return [] }
  })
  const [identificationDraft, setIdentificationDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [chatMode, setChatMode] = useState('')
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [people, setPeople] = useState([])
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const [gameRoomId, setGameRoomId] = useState('')
  const [gameRoom, setGameRoom] = useState(null)
  const [pendingGameId, setPendingGameId] = useState('')
  const [pendingGameRoom, setPendingGameRoom] = useState(null)
  const [joiningGame, setJoiningGame] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('quiz-arena-sound') !== 'off')
  const [readyBusy, setReadyBusy] = useState(false)
  const [answerFeedback, setAnswerFeedback] = useState('')
  const [reactionBursts, setReactionBursts] = useState([])
  const seenReactionIdsRef = useRef(new Set())
  const reactionHistoryReadyRef = useRef(false)
  const advancingRoomRef = useRef(false)
  const countdownStartedRef = useRef(false)
  const chatEndRef = useRef(null)
  const userName = displayName(user)
  const guestNameKey = user?.uid ? `quiz-arena-guest-name-${user.uid}` : ''
  const guestNameRequired = Boolean(user?.isAnonymous && guestNameKey && !localStorage.getItem(guestNameKey))

  useEffect(() => {
    setRenameNameDraft(userName || '')
  }, [user?.uid, user?.displayName, user?.email])

  useEffect(() => {
    if (!user?.uid) return
    const cacheKey = `quiz-arena-avatar-${user.uid}`
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (cached?.emoji) setAvatarEmoji(cached.emoji)
      if (cached?.color) setAvatarColor(cached.color)
    } catch {}
    if (user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) return
    getDoc(doc(db, 'profiles', user.uid)).then((snap) => {
      if (!snap.exists()) return
      const profile = snap.data()
      if (profile.avatarEmoji) setAvatarEmoji(profile.avatarEmoji)
      if (profile.avatarColor) setAvatarColor(profile.avatarColor)
    }).catch((error) => console.warn('Avatar profile load:', error))
  }, [user?.uid, user?.isLocalGuest, user?.isOfflineAccount])

  async function saveAvatarSelection(emoji = avatarEmoji, color = avatarColor) {
    if (!user?.uid) return
    setAvatarEmoji(emoji)
    setAvatarColor(color)
    try { localStorage.setItem(`quiz-arena-avatar-${user.uid}`, JSON.stringify({ emoji, color })) } catch {}
    if (user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) {
      setNotice('Avatar saved on this device. It will sync when you are online.')
      return
    }
    setAvatarSaving(true)
    try {
      await setDoc(doc(db, 'profiles', user.uid), { avatarEmoji: emoji, avatarColor: color, updatedAt: serverTimestamp() }, { merge: true })
      setNotice('Your player avatar has been saved!')
    } catch (error) {
      console.error('Avatar save:', error)
      setNotice('Avatar saved on this device. Cloud sync is still pending.')
    } finally { setAvatarSaving(false) }
  }

  useEffect(() => {
    try { localStorage.setItem('quiz-arena-sound', soundEnabled ? 'on' : 'off') } catch {}
  }, [soundEnabled])

  useEffect(() => {
    try { localStorage.setItem('quiz-arena-theme', darkMode ? 'dark' : 'light') } catch {}
    document.documentElement.dataset.qaTheme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    if (!user || user.isLocalGuest || user.isOfflineAccount) return
    const profileRef = doc(db, 'profiles', user.uid)
    const publishPresence = (status) => {
      if (!navigator.onLine) return Promise.resolve()
      return setDoc(profileRef, { presence: status, lastSeen: serverTimestamp(), presenceUpdatedAt: Date.now() }, { merge: true })
        .catch((error) => console.warn('Presence update:', error))
    }
    const publishCurrentPresence = () => publishPresence(document.visibilityState === 'visible' && navigator.onLine ? 'online' : 'offline')
    publishCurrentPresence()
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) publishPresence('online')
    }, 45000)
    const handleVisibility = () => publishCurrentPresence()
    const handleOnline = () => publishCurrentPresence()
    const handleOffline = () => publishPresence('offline')
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('pagehide', handleOffline)
    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('pagehide', handleOffline)
      publishPresence('offline')
    }
  }, [user])

  useEffect(() => {
    const updateNetwork = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateNetwork)
    window.addEventListener('offline', updateNetwork)
    return () => {
      window.removeEventListener('online', updateNetwork)
      window.removeEventListener('offline', updateNetwork)
    }
  }, [])

  useEffect(() => {
    let unsubscribe
    authPersistence.then(() => {
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          localStorage.removeItem('quiz-arena-local-guest-active')
          if (currentUser.isAnonymous && currentUser.displayName) { try { localStorage.setItem(`quiz-arena-guest-name-${currentUser.uid}`, currentUser.displayName) } catch {} }
          setUser(currentUser)
        } else if (localStorage.getItem('quiz-arena-local-guest-active') === 'true') {
          const guestId = localStorage.getItem('quiz-arena-local-guest-id')
          if (guestId) setUser({ uid: guestId, displayName: localStorage.getItem(`quiz-arena-guest-name-${guestId}`) || '', isAnonymous: true, isLocalGuest: true })
          else setUser(null)
        } else if (!navigator.onLine) {
          try {
            const cached = JSON.parse(localStorage.getItem('quiz-arena-registered-account-cache') || 'null')
            if (cached?.uid && cached?.email) setUser({ ...cached, isOfflineAccount: true })
            else setUser(null)
          } catch { setUser(null) }
        } else {
          setUser(null)
        }
        setAuthReady(true)
      })
    }).catch((error) => {
      console.error(error)
      setAuthReady(true)
      setNotice('Unable to initialize authentication.')
    })
    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!user || user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) return
    if (localStorage.getItem(`quiz-arena-pending-name-${user.uid}`)) return
    setDoc(doc(db, 'profiles', user.uid), {
      displayName: userName,
      email: user.email || '',
      avatarEmoji, avatarColor,
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch((error) => console.error('Profile sync:', error))
  }, [user, userName, avatarEmoji, avatarColor])

  useEffect(() => {
    if (!user?.uid || user.isLocalGuest || user.isOfflineAccount || !isOnline) return
    const pendingKey = `quiz-arena-pending-name-${user.uid}`
    const pendingName = localStorage.getItem(pendingKey)
    if (!pendingName) return
    let cancelled = false
    ;(async () => {
      try {
        await updateProfile(user, { displayName: pendingName })
        await setDoc(doc(db, 'profiles', user.uid), {
          displayName: pendingName,
          email: user.email || '',
          updatedAt: serverTimestamp(),
        }, { merge: true })
        if (cancelled) return
        setUser((current) => current?.uid === user.uid ? { ...current, displayName: pendingName } : current)
        localStorage.removeItem(pendingKey)
        try {
          const cached = JSON.parse(localStorage.getItem('quiz-arena-registered-account-cache') || '{}')
          if (cached.uid === user.uid) localStorage.setItem('quiz-arena-registered-account-cache', JSON.stringify({ ...cached, displayName: pendingName }))
        } catch {}
        setNotice(`Your saved player name has synced: ${pendingName}.`)
      } catch (error) {
        console.warn('Pending player name sync:', error)
      }
    })()
    return () => { cancelled = true }
  }, [user?.uid, isOnline])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function loadData() {
      // Load IndexedDB first so personal content is available even without internet.
      try {
        const [localQuizzes, localChoices, localResults, deletedQuizzes] = await Promise.all([
          getLocalQuizzes(user.uid), getLocalChoices(user.uid), getLocalResults(user.uid), getDeletedLocalQuizzes(user.uid),
        ])
        if (cancelled) return
        const deletedIds = new Set(deletedQuizzes.flatMap((item) => [item.quizId, item.localId]).filter(Boolean))
        if (localQuizzes.length || deletedIds.size) setQuizzes((previous) => mergeById(previous.filter((q) => !deletedIds.has(q.id) && !deletedIds.has(q.localId)), localQuizzes.map((q) => ({ ...q, id: q.id || q.localId }))))
        if (localChoices.length) setSavedChoices((previous) => {
          const combined = [...new Set([...previous, ...localChoices.map((choice) => choice.label)])].slice(0, 150)
          try { localStorage.setItem('quiz-arena-choice-library', JSON.stringify(combined)) } catch {}
          return combined
        })
        if (localResults.length) setResults((previous) => mergeById(previous, localResults.map((r) => ({ ...r, id: r.id || r.localId }))))
      } catch (error) {
        console.error('Could not load offline data:', error)
        if (!cancelled) setNotice('Could not load locally saved data in this browser.')
      }

      if (user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) return
      try {
        const snapshot = await getDocs(query(collection(db, 'quizzes'), where('createdBy', '==', user.uid)))
        const deletedQuizzes = await getDeletedLocalQuizzes(user.uid)
        const deletedIds = new Set(deletedQuizzes.flatMap((item) => [item.quizId, item.localId]).filter(Boolean))
        const saved = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.deleted && !deletedIds.has(item.id) && !deletedIds.has(item.localId))
        if (!cancelled) setQuizzes((previous) => mergeById(saved, [...previous.filter((item) => !deletedIds.has(item.id) && !deletedIds.has(item.localId)), ...initialQuizzes]))
      } catch (error) {
        console.error('Could not load cloud quizzes:', error)
        if (!cancelled) setNotice('Offline mode: showing quizzes saved on this device.')
      }
      try {
        const resultSnapshot = await getDocs(query(collection(db, 'quiz_results'), orderBy('createdAt', 'desc'), limit(100)))
        if (!cancelled) setResults((previous) => mergeById(resultSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })), previous))
      } catch (error) { console.error('Could not load cloud results:', error) }
    }
    loadData()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user || user.isLocalGuest || user.isOfflineAccount || !isOnline) return
    let cancelled = false
    async function syncOfflineData() {
      try {
        const [deletedQuizzes, pendingQuizzes, pendingResults] = await Promise.all([
          getDeletedLocalQuizzes(user.uid), getPendingLocalQuizzes(user.uid), getPendingLocalResults(user.uid),
        ])
        // Push deletion tombstones first. A deleted quiz must never be uploaded again.
        for (const deleted of deletedQuizzes) {
          if (cancelled) return
          await setDoc(doc(db, 'quizzes', deleted.quizId), {
            deleted: true,
            deletedBy: user.uid,
            localId: deleted.localId || deleted.quizId,
            deletedAt: serverTimestamp(),
          }, { merge: true })
          await markDeletedQuizSynced(user.uid, deleted.quizId)
        }
        for (const quiz of pendingQuizzes) {
          if (cancelled) return
          const quizCloudId = quiz.id || quiz.localId
          if (await isLocalQuizDeleted(user.uid, quizCloudId) || await isLocalQuizDeleted(user.uid, quiz.localId)) continue
          const cloudQuiz = cleanForCloud(quiz)
          await setDoc(doc(db, 'quizzes', quizCloudId), { ...cloudQuiz, localId: quiz.localId, deleted: false, syncStatus: 'synced', createdAt: serverTimestamp() })
          await markLocalQuizSynced(user.uid, quiz.localId)
          // Re-check after upload to close the race where deletion happens during a sync.
          if (await isLocalQuizDeleted(user.uid, quizCloudId) || await isLocalQuizDeleted(user.uid, quiz.localId)) {
            await setDoc(doc(db, 'quizzes', quizCloudId), {
              deleted: true, deletedBy: user.uid, localId: quiz.localId, deletedAt: serverTimestamp(),
            }, { merge: true })
            await markDeletedQuizSynced(user.uid, quizCloudId)
          }
        }
        for (const result of pendingResults) {
          if (cancelled) return
          const cloudResult = cleanForCloud(result)
          await setDoc(doc(db, 'quiz_results', result.localId), { ...cloudResult, localId: result.localId, syncStatus: 'synced', createdAt: serverTimestamp() })
          await markLocalResultSynced(user.uid, result.localId)
        }
        if (deletedQuizzes.length || pendingQuizzes.length || pendingResults.length) setNotice('Offline data synced with Firebase!')
      } catch (error) {
        console.error('Offline sync:', error)
        if (!cancelled) setNotice('Some offline data is still waiting to sync.')
      }
    }
    syncOfflineData()
    return () => { cancelled = true }
  }, [user, isOnline])

  useEffect(() => {
    if (!user || user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) return
    const profileUnsubscribers = new Map()
    const unsubFriends = onSnapshot(query(collection(db, 'friendships'), where('memberIds', 'array-contains', user.uid)), (snap) => {
      const currentIds = new Set()
      const list = snap.docs.map((item) => {
        const data = item.data()
        const otherId = (data.memberIds || []).find((id) => id !== user.uid)
        if (!otherId) return null
        currentIds.add(otherId)
        const fallbackName = data.memberNames?.[otherId] || 'Quiz Player'
        if (!profileUnsubscribers.has(otherId)) {
          const unsubscribe = onSnapshot(doc(db, 'profiles', otherId), (profileSnap) => {
            const profileData = profileSnap.exists() ? profileSnap.data() : {}
            setFriends((current) => current.map((friend) => friend.otherId === otherId ? {
              ...friend,
              name: profileData.displayName || profileData.name || fallbackName,
              presence: profileData.presence || 'offline',
              presenceUpdatedAt: Number(profileData.presenceUpdatedAt || 0),
              lastSeen: profileData.lastSeen || null,
              avatarEmoji: profileData.avatarEmoji || '😎',
              avatarColor: profileData.avatarColor || AVATAR_BACKGROUNDS[0].value,
            } : friend))
          }, (error) => console.warn('Friend profile listener:', error))
          profileUnsubscribers.set(otherId, unsubscribe)
        }
        return { id: item.id, otherId, name: fallbackName, presence: 'offline', presenceUpdatedAt: 0, lastSeen: null, avatarEmoji: '😎', avatarColor: AVATAR_BACKGROUNDS[0].value, ...data }
      }).filter(Boolean)
      for (const [friendId, unsubscribe] of profileUnsubscribers.entries()) {
        if (!currentIds.has(friendId)) { unsubscribe(); profileUnsubscribers.delete(friendId) }
      }
      setFriends((current) => {
        const previous = new Map(current.map((friend) => [friend.otherId, friend]))
        return list.map((friend) => ({ ...friend, ...(previous.get(friend.otherId) || {}) }))
      })
    }, (error) => console.error('Friends listener:', error))
    const unsubRequests = onSnapshot(query(collection(db, 'friend_requests'), where('toUid', '==', user.uid), where('status', '==', 'pending')), (snap) => {
      setFriendRequests(snap.docs.map((item) => ({ id: item.id, ...item.data() })))
    }, (error) => console.error('Requests listener:', error))
    const unsubPeople = onSnapshot(query(collection(db, 'profiles'), limit(100)), (snap) => {
      setPeople(snap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((p) => p.id !== user.uid))
    }, (error) => console.error('Profiles listener:', error))
    return () => { unsubFriends(); unsubRequests(); unsubPeople(); profileUnsubscribers.forEach((unsubscribe) => unsubscribe()); profileUnsubscribers.clear() }
  }, [user])

  const roomId = useMemo(() => (chatMode.startsWith('friends_') ? chatMode : ''), [chatMode])

  useEffect(() => {
    if (!user || user.isLocalGuest || user.isOfflineAccount || !navigator.onLine || !roomId) return
    const q = query(collection(db, 'chat_messages'), where('roomId', '==', roomId), limit(150))
    return onSnapshot(q, (snap) => setMessages(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => { const at = a.createdAt?.toMillis?.() || 0; const bt = b.createdAt?.toMillis?.() || 0; return at - bt })), (error) => {
      console.error('Chat listener:', error)
      setNotice('Chat could not load. Check Firestore rules and the required index.')
    })
  }, [user, roomId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, activeTab])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('invite')
    if (code) setInviteCode(code)
  }, [])

  useEffect(() => {
    if (!user || user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) return
    const gameId = new URLSearchParams(window.location.search).get('game')
    if (!gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'game_rooms', gameId))
        if (!snap.exists()) { setNotice('This game invitation is invalid or no longer available.'); return }
        const room = snap.data()
        if (!Array.isArray(room.quiz?.questions) || !room.quiz.questions.length) { setNotice('This game room has no valid quiz.'); return }
        if (!cancelled) {
          if ((room.memberIds || []).includes(user.uid)) {
            setGameRoomId(gameId)
            setGameRoom({ id: gameId, ...room })
            setActiveQuiz({ ...room.quiz, id: room.quiz.id || room.quizId || gameId })
            setCurrentQuestion(0); setAnswers({}); setQuizFinished(false)
            const url = new URL(window.location.href); url.searchParams.delete('game'); window.history.replaceState({}, '', url)
          } else {
            setPendingGameId(gameId)
            setPendingGameRoom({ id: gameId, ...room })
          }
        }
      } catch (error) { console.error('Load game invitation:', error); setNotice('Could not load game invitation. Check Firestore rules.') }
    })()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user || user.isLocalGuest || user.isOfflineAccount || !navigator.onLine || !gameRoomId) { setGameRoom(null); return }
    return onSnapshot(doc(db, 'game_rooms', gameRoomId), (snap) => {
      if (snap.exists()) setGameRoom({ id: snap.id, ...snap.data() })
      else { setGameRoom(null); setNotice('This multiplayer room is no longer available.') }
    }, (error) => { console.error('Game room listener:', error); setNotice('Could not load multiplayer room. Check Firestore rules.') })
  }, [user, gameRoomId])

  // The Firestore room is the shared source of truth for every multiplayer client.
  useEffect(() => {
    if (!gameRoom || !gameRoomId) return
    if (gameRoom.quiz?.questions?.length) {
      setActiveQuiz({ ...gameRoom.quiz, id: gameRoom.quiz.id || gameRoom.quizId || gameRoomId })
    }
    if (Number.isInteger(gameRoom.currentQuestion)) {
      setCurrentQuestion(gameRoom.currentQuestion)
      setAnswers(gameRoom.playerAnswers?.[user?.uid] || {})
    }
    if (gameRoom.status === 'finished') setQuizFinished(true)
    if (gameRoom.status === 'waiting' || gameRoom.status === 'countdown') setQuizFinished(false)
  }, [gameRoom?.id, gameRoom?.status, gameRoom?.currentQuestion, gameRoom?.playerAnswers, gameRoomId, user?.uid])

  // Host starts the live round after the synchronized 3-2-1 countdown.
  useEffect(() => {
    if (!gameRoomId || !gameRoom || gameRoom.status !== 'countdown') {
      countdownStartedRef.current = false
      return
    }
    const tick = async () => {
      const remaining = Math.max(0, Math.ceil(((gameRoom.countdownEndsAt || 0) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0 && gameRoom.creatorId === user?.uid && !countdownStartedRef.current) {
        countdownStartedRef.current = true
        try {
          await updateDoc(doc(db, 'game_rooms', gameRoomId), {
            status: 'playing',
            questionEndsAt: Date.now() + 30000,
            updatedAt: serverTimestamp(),
          })
        } catch (error) {
          countdownStartedRef.current = false
          console.error('Start multiplayer round:', error)
          setNotice('Could not start the round. Check Firestore permissions.')
        }
      }
    }
    tick()
    const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [gameRoomId, gameRoom?.status, gameRoom?.countdownEndsAt, gameRoom?.creatorId, user?.uid])

  useEffect(() => {
    advancingRoomRef.current = false
    setAnswerFeedback('')
  }, [gameRoom?.currentQuestion])

  // Every player sees the same deadline. The host advances once everyone answers or time expires.
  useEffect(() => {
    if (!gameRoomId || !gameRoom || gameRoom.status !== 'playing') {
      setSecondsLeft(30)
      advancingRoomRef.current = false
      return
    }
    const tick = async () => {
      const remaining = Math.max(0, Math.ceil(((gameRoom.questionEndsAt || 0) - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (gameRoom.creatorId !== user?.uid || advancingRoomRef.current) return
      const members = gameRoom.memberIds || []
      const submitted = gameRoom.playerAnswers || {}
      const everyoneAnswered = members.length > 0 && members.every((uid) =>
        Object.prototype.hasOwnProperty.call(submitted[uid] || {}, String(gameRoom.currentQuestion ?? 0))
      )
      if (everyoneAnswered || remaining <= 0) {
        advancingRoomRef.current = true
        const next = Number(gameRoom.currentQuestion || 0) + 1
        try {
          if (next >= (gameRoom.quiz?.questions?.length || 0)) {
            await updateDoc(doc(db, 'game_rooms', gameRoomId), { status: 'finished', finishedAt: serverTimestamp(), updatedAt: serverTimestamp() })
          } else {
            await updateDoc(doc(db, 'game_rooms', gameRoomId), {
              currentQuestion: next,
              questionEndsAt: Date.now() + 30000,
              updatedAt: serverTimestamp(),
            })
          }
        } catch (error) {
          advancingRoomRef.current = false
          console.error('Advance multiplayer question:', error)
          setNotice('Could not sync the next question. Check Firestore permissions.')
        }
      }
    }
    tick()
    const timer = setInterval(tick, 500)
    return () => clearInterval(timer)
  }, [gameRoomId, gameRoom?.status, gameRoom?.questionEndsAt, gameRoom?.currentQuestion, gameRoom?.playerAnswers, gameRoom?.memberIds, gameRoom?.creatorId, gameRoom?.quiz?.questions?.length, user?.uid])

  useEffect(() => {
    if (gameRoom?.status === 'playing') {
      setCurrentQuestion(Number(gameRoom.currentQuestion || 0))
      setAnswers(gameRoom.playerAnswers?.[user?.uid] || {})
    }
  }, [gameRoom?.currentQuestion, gameRoom?.playerAnswers, gameRoom?.status, user?.uid])

  // Turn newly received multiplayer reactions into short-lived floating emoji bursts.
  useEffect(() => {
    const reactions = gameRoom?.reactions || []
    if (!reactionHistoryReadyRef.current) {
      reactions.forEach((reaction) => seenReactionIdsRef.current.add(reaction.id))
      reactionHistoryReadyRef.current = true
      return
    }
    const fresh = reactions.filter((reaction) => reaction?.id && !seenReactionIdsRef.current.has(reaction.id))
    fresh.forEach((reaction) => seenReactionIdsRef.current.add(reaction.id))
    if (!fresh.length) return
    const bursts = fresh.slice(-5).map((reaction) => ({ ...reaction, left: 12 + Math.random() * 76 }))
    setReactionBursts((previous) => [...previous, ...bursts].slice(-10))
    const ids = new Set(bursts.map((reaction) => reaction.id))
    window.setTimeout(() => setReactionBursts((previous) => previous.filter((reaction) => !ids.has(reaction.id))), 1900)
  }, [gameRoom?.reactions])


  const isDark = darkMode
  const page = isDark ? 'min-h-screen bg-[#080d1b] text-slate-100' : 'min-h-screen bg-slate-50 text-slate-900'
  const panel = isDark ? 'border border-white/[0.09] bg-[#111a2e]/95 shadow-[0_12px_45px_rgba(3,7,18,0.42)]' : 'border border-slate-200 bg-white shadow-sm'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const field = isDark ? 'border-white/10 bg-[#0b1224] text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  const buttonPrimary = 'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-cyan-700 px-4 py-2.5 font-bold text-white shadow-lg shadow-violet-950/30 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
  const buttonSecondary = `inline-flex items-center justify-center rounded-xl border px-4 py-2.5 font-semibold transition ${isDark ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]' : 'border-slate-300 bg-white hover:bg-slate-100'}`
  const myQuizzes = quizzes.filter((quiz) => quiz.createdBy && quiz.createdBy === user?.uid)
  const visibleQuizzes = quizzes.filter((quiz) => {
    const matches = quiz.title?.toLowerCase().includes(search.toLowerCase()) || quiz.category?.toLowerCase().includes(search.toLowerCase())
    return activeTab === 'My Quizzes' ? quiz.createdBy === user?.uid && matches : matches
  })
  const myResults = results.filter((result) => result.userId === user?.uid)
  const totalQuestionsAnswered = myResults.reduce((sum, result) => sum + (Number(result.totalQuestions) || 0), 0)
  const averageScore = myResults.length ? Math.round(myResults.reduce((sum, result) => sum + (result.totalQuestions ? (result.score / result.totalQuestions) * 100 : 0), 0) / myResults.length) : 0

  async function startQuiz(quiz) {
    if (!Array.isArray(quiz.questions) || !quiz.questions.length) return setNotice('This quiz has no questions yet.')
    const roundQuiz = prepareQuizForPlay(quiz)
    setActiveQuiz(roundQuiz); setCurrentQuestion(0); setAnswers({}); setIdentificationDraft(''); setQuizFinished(false); setAnswerFeedback('')
    if (!navigator.onLine || user.isLocalGuest || user.isOfflineAccount) {
      setGameRoomId(''); setGameRoom(null)
      setNotice(user.isLocalGuest ? 'Guest practice started. Your quiz progress stays on this device.' : user.isOfflineAccount ? 'Offline account practice started. Your progress stays on this device.' : 'Offline practice started. Multiplayer needs internet.')
      return
    }
    try {
      const player = { uid: user.uid, name: userName, avatarEmoji, avatarColor, joinedAt: Date.now() }
      const roomData = {
        creatorId: user.uid, creatorName: userName, quizId: quiz.id,
        quiz: { id: roundQuiz.id, title: roundQuiz.title, category: roundQuiz.category || 'General', difficulty: roundQuiz.difficulty || 'Easy', questions: roundQuiz.questions },
        memberIds: [user.uid], players: [player], readyPlayers: { [user.uid]: true },
        playerAnswers: {}, reactions: [], currentQuestion: 0, status: 'waiting',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }
      const roomRef = await addDoc(collection(db, 'game_rooms'), roomData)
      setGameRoomId(roomRef.id)
      setGameRoom({ id: roomRef.id, ...roomData })
      setNotice('Room created! Invite your friends and wait in the lobby.')
    } catch (error) {
      console.error('Create game room:', error)
      setGameRoomId(''); setGameRoom(null)
      setNotice('Could not create multiplayer room. You can still practice solo.')
    }
  }
  function closeQuiz() { setActiveQuiz(null); setQuizFinished(false); setAnswers({}); setIdentificationDraft(''); setCurrentQuestion(0); setGameRoomId(''); setGameRoom(null) }
  async function acceptGameInvitation() {
    if (!user || !pendingGameId || !pendingGameRoom || joiningGame) return
    setJoiningGame(true)
    try {
      const ref = doc(db, 'game_rooms', pendingGameId)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('This game room no longer exists.')
      const room = snap.data()
      if (!Array.isArray(room.quiz?.questions) || !room.quiz.questions.length) throw new Error('This room has no valid quiz.')
      if (room.status !== 'waiting') throw new Error('This room has already started or finished. Ask the host for a new room.')
      if (!(room.memberIds || []).includes(user.uid)) {
        if ((room.memberIds || []).length >= 20) throw new Error('This game room is full (20 players maximum).')
        await updateDoc(ref, {
          memberIds: arrayUnion(user.uid),
          players: arrayUnion({ uid: user.uid, name: userName, avatarEmoji, avatarColor, joinedAt: Date.now() }),
          [`readyPlayers.${user.uid}`]: false,
          updatedAt: serverTimestamp(),
        })
      }
      setGameRoomId(pendingGameId)
      setGameRoom({ id: pendingGameId, ...room, memberIds: [...new Set([...(room.memberIds || []), user.uid])], players: (room.players || []).some((p) => p.uid === user.uid) ? room.players : [...(room.players || []), { uid: user.uid, name: userName, avatarEmoji, avatarColor, joinedAt: Date.now() }], readyPlayers: { ...(room.readyPlayers || {}), [user.uid]: (room.memberIds || []).includes(user.uid) ? Boolean(room.readyPlayers?.[user.uid]) : false } })
      setActiveQuiz({ ...room.quiz, id: room.quiz.id || room.quizId || pendingGameId })
      setCurrentQuestion(0); setAnswers({}); setQuizFinished(false)
      setPendingGameId(''); setPendingGameRoom(null)
      const url = new URL(window.location.href); url.searchParams.delete('game'); window.history.replaceState({}, '', url)
      setNotice(`You joined ${room.quiz.title || 'the quiz'}!`)
    } catch (error) {
      console.error('Accept game invitation:', error)
      setNotice(error.message || 'Could not join game room. Check Firestore rules.')
    } finally { setJoiningGame(false) }
  }

  function declineGameInvitation() {
    setPendingGameId(''); setPendingGameRoom(null)
    const url = new URL(window.location.href); url.searchParams.delete('game'); window.history.replaceState({}, '', url)
    setNotice('Game invitation declined.')
  }

  function editQuiz(quiz) {
    if (!user || quiz.createdBy !== user.uid) return setNotice('You can only edit quizzes you created.')
    setEditingQuiz(quiz)
    setTitle(quiz.title || '')
    setDescription(quiz.description || '')
    setCategory(quiz.category || categories[0])
    setDifficulty(quiz.difficulty || 'Easy')
    setNewQuestions((quiz.questions || []).map((question) => ({
      id: question.id || crypto.randomUUID(),
      type: question.type || 'multiple',
      question: question.question || '',
      options: question.type === 'identification' ? [] : question.type === 'boolean' ? ['True', 'False'] : normalizeMultipleChoice(question).options,
      correctAnswer: question.type === 'multiple' ? normalizeMultipleChoice(question).correctAnswer : Number(question.correctAnswer || 0),
      correctText: question.correctText || '',
    })))
    setShowCreate(true)
    setActiveTab('My Quizzes')
  }

  function closeQuizCreator() {
    setShowCreate(false)
    setEditingQuiz(null)
    setTitle('')
    setDescription('')
    setCategory(categories[0])
    setDifficulty('Easy')
    setNewQuestions([emptyQuestion()])
  }

  async function deleteQuiz(quiz) {
    if (!user || quiz.createdBy !== user.uid) return setNotice('You can only delete quizzes you created.')
    if (!window.confirm(`Delete “${quiz.title}”? This cannot be undone.`)) return
    try {
      const localId = quiz.localId || quiz.id
      const quizCloudId = quiz.id || localId
      await deleteLocalQuiz(user.uid, localId, quizCloudId)
      // Remove it from the screen immediately; the local tombstone remains even if cloud is offline.
      setQuizzes((previous) => previous.filter((item) => item.id !== quiz.id && item.localId !== localId))
      if (navigator.onLine && !user.isLocalGuest && !user.isOfflineAccount) {
        try {
          await setDoc(doc(db, 'quizzes', quizCloudId), {
            deleted: true,
            deletedBy: user.uid,
            localId,
            deletedAt: serverTimestamp(),
          }, { merge: true })
          await markDeletedQuizSynced(user.uid, quizCloudId)
          setNotice('Quiz permanently deleted and deletion synced with Firebase.')
        } catch (cloudError) {
          console.error('Quiz deletion cloud sync:', cloudError)
          setNotice('Quiz deleted on this device. Cloud deletion is waiting to sync; check Firestore permissions.')
        }
      } else {
        setNotice('Quiz deleted locally. Deletion will sync when internet returns.')
      }
    } catch (error) {
      console.error('Delete quiz:', error)
      setNotice('Could not delete this quiz. Please try again.')
    }
  }


  async function setPlayerReady(ready) {
    if (!gameRoomId || !user || gameRoom?.status !== 'waiting' || readyBusy) return
    setReadyBusy(true)
    try {
      await updateDoc(doc(db, 'game_rooms', gameRoomId), {
        [`readyPlayers.${user.uid}`]: Boolean(ready),
        updatedAt: serverTimestamp(),
      })
      setNotice(ready ? 'You are ready! Waiting for the host to launch.' : 'Ready status cancelled.')
    } catch (error) {
      console.error('Update ready state:', error)
      setNotice(`Ready update failed (${error.code || 'unknown'}). Check that the new Firestore Rules were published.`)
    } finally {
      setReadyBusy(false)
    }
  }

  async function startMultiplayerGame() {
    if (!gameRoomId || gameRoom?.creatorId !== user?.uid || gameRoom?.status !== 'waiting') return
    const members = gameRoom.memberIds || []
    const ready = gameRoom.readyPlayers || {}
    if (members.length < 2) return setNotice('Invite at least one friend before starting multiplayer.')
    if (!members.every((uid) => ready[uid])) return setNotice('Wait until every player is ready.')
    try {
      await updateDoc(doc(db, 'game_rooms', gameRoomId), {
        status: 'countdown',
        currentQuestion: 0,
        playerAnswers: {},
        countdownEndsAt: Date.now() + 3000,
        questionEndsAt: null,
        reactions: [],
        updatedAt: serverTimestamp(),
      })
      setAnswers({}); setCurrentQuestion(0); setQuizFinished(false)
    } catch (error) {
      console.error('Start multiplayer game:', error)
      setNotice('Could not start the game. Check Firestore permissions.')
    }
  }

  async function submitGameAnswer(value) {
    if (!gameRoomId || !gameRoom || gameRoom.status !== 'playing' || !user) return
    const index = Number(gameRoom.currentQuestion || 0)
    const alreadyAnswered = Object.prototype.hasOwnProperty.call(gameRoom.playerAnswers?.[user.uid] || {}, String(index))
    if (alreadyAnswered) return
    const liveQuestion = gameRoom.quiz?.questions?.[index] || activeQuiz?.questions?.[index]
    const correct = liveQuestion ? isCorrectAnswer(liveQuestion, value) : false
    try {
      await updateDoc(doc(db, 'game_rooms', gameRoomId), {
        [`playerAnswers.${user.uid}.${index}`]: value,
        updatedAt: serverTimestamp(),
      })
      setAnswers((previous) => ({ ...previous, [index]: value }))
      setAnswerFeedback(correct ? 'correct' : 'wrong')
      if (soundEnabled) playAnswerTone(correct)
    } catch (error) {
      console.error('Submit multiplayer answer:', error)
      setNotice(`Your answer could not sync (${error.code || 'unknown'}). Please retry.`)
    }
  }

  async function sendGameReaction(emoji) {
    if (!gameRoomId || !user || gameRoom?.status !== 'playing') return
    try {
      await updateDoc(doc(db, 'game_rooms', gameRoomId), {
        reactions: arrayUnion({ id: `${user.uid}_${Date.now()}`, uid: user.uid, name: userName, emoji, at: Date.now() }),
      })
    } catch (error) {
      console.error('Send reaction:', error)
      setNotice('Reaction could not be sent.')
    }
  }

  async function startRematch() {
    if (!gameRoomId || gameRoom?.creatorId !== user?.uid || gameRoom?.status !== 'finished') return
    try {
      const rematchQuiz = prepareQuizForPlay(gameRoom.quiz || activeQuiz)
      await updateDoc(doc(db, 'game_rooms', gameRoomId), {
        status: 'waiting',
        quiz: { ...rematchQuiz },
        currentQuestion: 0,
        playerAnswers: {},
        readyPlayers: Object.fromEntries((gameRoom.memberIds || []).map((uid) => [uid, uid === user.uid])),
        countdownEndsAt: null,
        questionEndsAt: null,
        reactions: [],
        updatedAt: serverTimestamp(),
      })
      setActiveQuiz(rematchQuiz)
      setAnswers({}); setCurrentQuestion(0); setQuizFinished(false); setAnswerFeedback('')
      setNotice('Rematch lobby opened! Same room, same players—get ready again.')
    } catch (error) {
      console.error('Start rematch:', error)
      setNotice('Could not start rematch. Check Firestore permissions.')
    }
  }

  function continueSoloPractice() {
    setGameRoomId(''); setGameRoom(null)
    setActiveQuiz((quiz) => quiz)
    setCurrentQuestion(0); setAnswers({}); setQuizFinished(false)
    setNotice('Solo practice started. Multiplayer room left.')
  }

  function getGameInviteLink() {
    return gameRoomId ? `${window.location.origin}${window.location.pathname}?game=${encodeURIComponent(gameRoomId)}` : ''
  }

  async function copyGameInvite() {
    const link = getGameInviteLink()
    if (!link) return setNotice('Game invite is not ready yet.')
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link)
      else throw new Error('Clipboard unavailable')
      setNotice('Invite link copied! Paste it into Messenger or send it to your friends.')
    } catch {
      setNotice(`Copy this invite link: ${link}`)
    }
  }

  async function shareGameInvite() {
    const link = getGameInviteLink()
    if (!link) return setNotice('Game invite is not ready yet.')
    const shareData = { title: 'Join my Quiz Arena battle!', text: `Join my Quiz Arena room using this invite link:`, url: link }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        setNotice('Choose Messenger or another app to share your invite.')
      } else {
        await copyGameInvite()
      }
    } catch (error) {
      if (error?.name !== 'AbortError') await copyGameInvite()
    }
  }

  async function saveAccountName(event) {
    event?.preventDefault()
    const name = renameNameDraft.trim().replace(/\s+/g, ' ').slice(0, 40)
    if (name.length < 2) return setNotice('Your player name must have at least 2 characters.')
    if (name.length > 40) return setNotice('Your player name must be 40 characters or fewer.')
    if (!user?.uid) return setNotice('Your account is not ready yet. Please try again.')
    if (name === userName) return setNotice('Your player name is already up to date.')

    setRenameSaving(true)
    try {
      if (user.isLocalGuest) {
        localStorage.setItem(guestNameKey, name)
        localStorage.setItem('quiz-arena-local-guest-name', name)
      } else if (user.isOfflineAccount || !navigator.onLine) {
        localStorage.setItem(`quiz-arena-pending-name-${user.uid}`, name)
        const raw = localStorage.getItem('quiz-arena-registered-account-cache')
        const cached = raw ? JSON.parse(raw) : null
        if (cached?.uid === user.uid) {
          localStorage.setItem('quiz-arena-registered-account-cache', JSON.stringify({ ...cached, displayName: name }))
        }
      } else {
        await updateProfile(user, { displayName: name })
        await setDoc(doc(db, 'profiles', user.uid), {
          displayName: name,
          email: user.email || '',
          updatedAt: serverTimestamp(),
        }, { merge: true })
        try {
          const raw = localStorage.getItem('quiz-arena-registered-account-cache')
          const cached = raw ? JSON.parse(raw) : {}
          localStorage.setItem('quiz-arena-registered-account-cache', JSON.stringify({ ...cached, uid: user.uid, email: user.email || cached.email || '', displayName: name }))
        } catch {}
      }

      setUser((current) => current ? { ...current, displayName: name } : current)
      setRenameNameDraft(name)
      setNotice(`Your Arena name is now ${name}.`)
    } catch (error) {
      console.error('Account name update:', error)
      setNotice('Name update could not be fully synced. Please check your connection and try again.')
    } finally {
      setRenameSaving(false)
    }
  }

  async function saveGuestName(event) {
    event?.preventDefault()
    const name = guestNameDraft.trim().replace(/\s+/g, ' ').slice(0, 24)
    if (name.length < 2) return setNotice('Please enter a name with at least 2 characters.')
    try {
      if (user?.isLocalGuest) {
        localStorage.setItem(guestNameKey, name)
        localStorage.setItem('quiz-arena-local-guest-name', name)
        setUser((current) => ({ ...current, displayName: name }))
      } else if (user?.isAnonymous) {
        await updateProfile(user, { displayName: name })
        localStorage.setItem(guestNameKey, name)
        setUser({ ...user, displayName: name })
      }
      setNotice(`Welcome to Quiz Arena, ${name}!`)
    } catch (error) {
      console.error('Guest name:', error)
      setNotice('Could not save your guest name. Please try again.')
    }
  }
  async function finishQuiz(finalAnswers = answers) {
    const questions = activeQuiz.questions
    const score = questions.reduce((total, question, index) => total + (isCorrectAnswer(question, finalAnswers[index]) ? 1 : 0), 0)
    setQuizFinished(true)
    try {
      const localId = `result_${crypto.randomUUID()}`
      const result = { localId, id: localId, quizId: activeQuiz.id, quizTitle: activeQuiz.title, userId: user.uid, userName, avatarEmoji, avatarColor, score, totalQuestions: questions.length, createdAtLocal: Date.now(), syncStatus: 'pending' }
      const localSaved = await saveLocalResult(user.uid, result)
      setResults((previous) => [localSaved, ...previous])
      if (navigator.onLine && !user.isLocalGuest && !user.isOfflineAccount) {
        try {
          await setDoc(doc(db, 'quiz_results', localId), { quizId: activeQuiz.id, quizTitle: activeQuiz.title, userId: user.uid, userName, score, totalQuestions: questions.length, localId, syncStatus: 'synced', createdAt: serverTimestamp() })
          await markLocalResultSynced(user.uid, localId)
          setNotice('Quiz result saved and synced!')
        } catch (cloudError) {
          console.error('Result cloud sync:', cloudError)
          setNotice('Result saved on this device. It will sync when internet returns.')
        }
      } else {
        setNotice(user.isLocalGuest ? 'Result saved on this device in Guest Mode.' : user.isOfflineAccount ? 'Result saved locally under your account.' : 'Result saved offline. It will sync when internet returns.')
      }
    } catch (error) { console.error(error); setNotice('Quiz finished, but local result storage failed.') }
  }
  function advanceAfterWrongAnswer(finalAnswers, questionIndex) {
    // Give a short moment to show the correct answer, then move forward automatically.
    // Wrong answers are locked and can never be revisited during this round.
    setTimeout(() => {
      if (questionIndex >= (activeQuiz?.questions?.length || 0) - 1) {
        finishQuiz(finalAnswers)
      } else {
        setCurrentQuestion(questionIndex + 1)
        setIdentificationDraft('')
        setAnswerFeedback('')
      }
    }, 1100)
  }

  function chooseAnswer(index) {
    if (answers[currentQuestion] !== undefined) return
    const correct = isCorrectAnswer(activeQuiz.questions[currentQuestion], index)
    if (gameRoomId) { submitGameAnswer(index); return }
    const finalAnswers = { ...answers, [currentQuestion]: index }
    setAnswers(finalAnswers)
    setAnswerFeedback(correct ? 'correct' : 'wrong')
    if (soundEnabled) playAnswerTone(correct)
    if (!correct) advanceAfterWrongAnswer(finalAnswers, currentQuestion)
  }
  function updateQuestion(questionIndex, fieldName, value) {
    setNewQuestions((previous) => previous.map((q, index) => index === questionIndex ? { ...q, [fieldName]: value } : q))
  }
  function updateOption(questionIndex, optionIndex, value) {
    setNewQuestions((previous) => previous.map((q, index) => {
      if (index !== questionIndex) return q
      const options = [...(q.options || [])]
      options[optionIndex] = value
      return { ...q, options }
    }))
    // Save each non-empty choice immediately so it is reusable offline and later.
    if (String(value ?? '').trim()) rememberChoices([value])
  }

  function getPreviousChoices(questionIndex) {
    const earlierQuestionChoices = newQuestions
      .slice(0, questionIndex)
      .filter((question) => question.type === 'multiple')
      .flatMap((question) => question.options || [])

    return [...new Set([
      ...earlierQuestionChoices,
      ...savedChoices,
    ].map((choice) => String(choice ?? '').trim()).filter(Boolean))].slice(0, 150)
  }

  function changeQuestionType(questionIndex, type) {
    setNewQuestions((previous) => previous.map((q, index) => {
      if (index !== questionIndex) return q
      if (type === 'boolean') return { ...q, type, options: ['True', 'False'], correctAnswer: 0, correctText: '' }
      if (type === 'identification') return { ...q, type, options: [], correctAnswer: 0, correctText: '' }
      return { ...q, type: 'multiple', options: ['', '', ''], correctAnswer: 0, correctText: '' }
    }))
  }

  function rememberChoices(values) {
    const cleaned = values.map((value) => String(value).trim()).filter(Boolean)
    setSavedChoices((previous) => {
      const combined = [...new Set([...cleaned, ...previous])].slice(0, 150)
      try { localStorage.setItem('quiz-arena-choice-library', JSON.stringify(combined)) } catch (error) { console.warn('Choice library storage:', error) }
      return combined
    })
    if (user) saveLocalChoices(user.uid, cleaned).catch((error) => console.warn('IndexedDB choices:', error))
  }

  async function createQuiz(event) {
    event.preventDefault()
    if (!title.trim()) return setNotice('Please enter a quiz title.')
    const valid = newQuestions.every((q) => q.question.trim() && (
      q.type === 'identification' ? q.correctText.trim() : q.type === 'multiple' ? q.options.length === 3 && q.options.every((o) => o.trim()) : q.options.length === 2 && q.options.every((o) => o.trim())
    ))
    if (!valid) return setNotice('Complete every question and its correct answer or choices.')
    setSaving(true)
    const preparedQuestions = newQuestions.map((q) => ({
      type: q.type || 'multiple',
      question: q.question.trim(),
      options: q.type === 'identification' ? [] : q.type === 'multiple' ? q.options.slice(0, 3).map((o) => o.trim()) : ['True', 'False'],
      correctAnswer: q.type === 'multiple' ? Math.min(Number(q.correctAnswer || 0), 2) : Number(q.correctAnswer || 0),
      ...(q.type === 'identification' ? { correctText: q.correctText.trim() } : {}),
    }))
    const isEditing = Boolean(editingQuiz)
    const localId = isEditing ? (editingQuiz.localId || editingQuiz.id) : `local_${crypto.randomUUID()}`
    const quizId = isEditing ? editingQuiz.id : localId
    const quizData = {
      ...(isEditing ? editingQuiz : {}),
      id: quizId, localId, title: title.trim(), description: description.trim(), category, difficulty,
      questions: preparedQuestions, createdBy: user.uid, creatorName: userName,
      privacy: editingQuiz?.privacy || 'invite',
      allowedUserIds: editingQuiz?.allowedUserIds || [user.uid],
      createdAtLocal: editingQuiz?.createdAtLocal || Date.now(),
      updatedAtLocal: Date.now(), syncStatus: 'pending',
    }
    try {
      newQuestions.filter((q) => q.type === 'multiple').forEach((q) => rememberChoices(q.options))
      const localSaved = await saveLocalQuiz(user.uid, quizData)
      setQuizzes((previous) => isEditing
        ? previous.map((item) => item.id === quizId || item.localId === localId ? { ...item, ...localSaved, id: quizId, localId } : item)
        : [localSaved, ...previous.filter((item) => item.id !== localId)])
      let synced = false
      if (navigator.onLine && !user.isLocalGuest && !user.isOfflineAccount) {
        try {
          await setDoc(doc(db, 'quizzes', quizId), {
            title: quizData.title, description: quizData.description, category, difficulty, questions: preparedQuestions,
            createdBy: user.uid, creatorName: userName, privacy: quizData.privacy,
            allowedUserIds: quizData.allowedUserIds, localId, syncStatus: 'synced',
            createdAt: editingQuiz?.createdAt || serverTimestamp(), updatedAt: serverTimestamp(),
          }, { merge: true })
          await markLocalQuizSynced(user.uid, localId)
          synced = true
        } catch (cloudError) { console.error('Quiz cloud sync:', cloudError) }
      }
      setTitle(''); setDescription(''); setCategory(categories[0]); setDifficulty('Easy'); setNewQuestions([emptyQuestion()]); setEditingQuiz(null); setShowCreate(false); setActiveTab('My Quizzes')
      setNotice(isEditing
        ? synced ? 'Quiz changes saved and synced!' : 'Quiz changes saved on this device. They will sync when internet returns.'
        : synced ? 'Quiz created and synced with Firebase!' : user.isLocalGuest ? 'Quiz saved on this device in Guest Mode!' : user.isOfflineAccount ? 'Quiz saved locally under your account!' : 'Quiz saved on this device. It will sync when internet returns.')
    } catch (error) { console.error(error); setNotice('Could not save quiz to this device. Check browser storage permissions.') }
    finally { setSaving(false) }
  }

  async function sendMessage(event) {
    event?.preventDefault()
    const text = chatText.trim()
    if (!text || !roomId || !user || user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) return
    if (!friends.some((f) => friendRoomId(user.uid, f.otherId) === roomId)) {
      setNotice('Friends-only chat requires an accepted friendship.')
      return
    }
    setChatText('')
    setShowEmoji(false)
    try {
      await addDoc(collection(db, 'chat_messages'), { roomId, text, senderId: user.uid, senderName: userName, memberIds: [user.uid, selectedFriend?.otherId].filter(Boolean), createdAt: serverTimestamp() })
    } catch (error) { console.error(error); setChatText(text); setNotice('Message not sent. Check Firestore rules.') }
  }

  async function createInvite() {
    if (user?.isLocalGuest || user?.isOfflineAccount || !navigator.onLine) return setNotice('Invites need an online account and internet connection.')
    setInviteBusy(true)
    try {
      const ref = await addDoc(collection(db, 'invites'), { creatorId: user.uid, creatorName: userName, status: 'active', createdAt: serverTimestamp() })
      const link = `${window.location.origin}${window.location.pathname}?invite=${ref.id}`
      setInviteCode(ref.id); setInviteLink(link)
      try { await navigator.clipboard.writeText(link); setNotice('Invite link created and copied!') }
      catch { setNotice('Invite link created. Copy it from the field below.') }
    } catch (error) { console.error(error); setNotice('Could not create invite. Check Firestore rules.') }
    finally { setInviteBusy(false) }
  }

  async function acceptInvite() {
    if (!inviteCode || !user || user.isLocalGuest || user.isOfflineAccount || !navigator.onLine) return setNotice('Accepting invites requires an online account and internet connection.')
    try {
      const inviteRef = doc(db, 'invites', inviteCode)
      const snap = await getDoc(inviteRef)
      if (!snap.exists()) return setNotice('This invite link is invalid or expired.')
      const invitation = snap.data()
      if (invitation.creatorId === user.uid) return setNotice('This is your own invitation link.')
      const memberIds = [invitation.creatorId, user.uid].sort()
      const friendshipId = `friends_${memberIds.join('_')}`
      await setDoc(doc(db, 'friendships', friendshipId), {
        memberIds,
        memberNames: { [invitation.creatorId]: invitation.creatorName || 'Quiz Player', [user.uid]: userName },
        createdAt: serverTimestamp(),
        inviteId: inviteCode,
      }, { merge: true })
      await updateDoc(inviteRef, { status: 'accepted', acceptedBy: user.uid, acceptedByName: userName, acceptedAt: serverTimestamp() })
      setChatMode(friendRoomId(user.uid, invitation.creatorId))
      setActiveTab('Friends Chat')
      setNotice(`You're now friends with ${invitation.creatorName || 'this player'}!`)
      const url = new URL(window.location.href); url.searchParams.delete('invite'); window.history.replaceState({}, '', url)
      setInviteCode('')
    } catch (error) { console.error(error); setNotice('Could not accept invite. Check Firestore rules.') }
  }

  async function sendFriendRequest(person) {
    if (!person?.id || person.id === user.uid || user?.isLocalGuest || user?.isOfflineAccount || !navigator.onLine) return setNotice('Friend requests need an online account and internet connection.')
    try {
      const existing = await getDocs(query(collection(db, 'friend_requests'), where('fromUid', '==', user.uid), where('toUid', '==', person.id), where('status', '==', 'pending'), limit(1)))
      if (!existing.empty) return setNotice('Friend request already sent.')
      await addDoc(collection(db, 'friend_requests'), { fromUid: user.uid, fromName: userName, toUid: person.id, toName: person.displayName || person.name || 'Quiz Player', status: 'pending', createdAt: serverTimestamp() })
      setNotice('Friend request sent!')
    } catch (error) { console.error(error); setNotice('Could not send friend request. Check Firestore rules.') }
  }

  async function acceptFriendRequest(request) {
    if (user?.isLocalGuest || user?.isOfflineAccount || !navigator.onLine) return setNotice('Friends require an online account and internet connection.')
    try {
      const memberIds = [request.fromUid, user.uid].sort()
      await setDoc(doc(db, 'friendships', `friends_${memberIds.join('_')}`), { memberIds, memberNames: { [request.fromUid]: request.fromName || 'Quiz Player', [user.uid]: userName }, requestId: request.id, createdAt: serverTimestamp() })
      await updateDoc(doc(db, 'friend_requests', request.id), { status: 'accepted' })
      setNotice(`You're now friends with ${request.fromName}!`)
    } catch (error) { console.error(error); setNotice('Could not accept request. Check Firestore rules.') }
  }

  async function handleLogout() {
    if (user?.isLocalGuest) {
      // Keep the stable guest ID and player name. Only end the current session.
      localStorage.removeItem('quiz-arena-local-guest-active')
      setUser(null)
      closeQuiz()
      setNotice('Guest session ended. Your Guest Player name and saved local data are kept on this device.')
      return
    }
    if (user?.isOfflineAccount) {
      setUser(null); closeQuiz(); setNotice('Offline account session ended. Your saved quizzes remain on this device.')
      return
    }
    try { await signOut(auth); setUser(null); closeQuiz() }
    catch (error) { console.error(error); setNotice('Unable to sign out. Please try again.') }
  }

  const navItems = [
    { label: 'Overview', icon: Home }, { label: 'Explore Quizzes', icon: Search },
    { label: 'My Quizzes', icon: BookOpen }, { label: 'Leaderboard', icon: Trophy },
    { label: 'Friends Chat', icon: MessageCircle }, { label: 'Friends', icon: Users }, { label: 'Invite Friends', icon: UserPlus }, { label: 'My Profile', icon: CircleUserRound },
  ]

  if (!authReady) return <div className={`${page} grid min-h-screen place-items-center`}><div className="text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-violet-600/20 text-violet-300"><Activity className="animate-pulse" size={34} /></div><p className={muted}>Entering the Arena...</p></div></div>
  if (!user) return <Auth onLogin={setUser} />

  if (guestNameRequired) return <div className={`${page} qa-neon grid min-h-screen place-items-center px-4 py-8`}><form onSubmit={saveGuestName} className={`${panel} w-full max-w-md rounded-3xl p-6 text-center sm:p-8`}><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-400/20 text-3xl">🎮</div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-violet-400">Guest Player</p><h1 className="mb-2 text-2xl font-black sm:text-3xl">Welcome to Quiz Arena!</h1><p className={`${muted} mb-6 text-sm`}>Choose a player name before entering the Arena. This name will appear in rooms and scoreboards.</p><input value={guestNameDraft} onChange={(event) => setGuestNameDraft(event.target.value)} autoFocus maxLength={24} minLength={2} required placeholder="Enter your player name" className={`${field} mb-4 w-full rounded-xl border px-4 py-3`} /><button type="submit" className={`${buttonPrimary} min-h-12 w-full`}>Enter the Arena <ChevronRight className="ml-2" size={18} /></button></form></div>

  if (activeQuiz && gameRoom && gameRoom.status === 'waiting') {
    const readyMap = gameRoom.readyPlayers || {}
    const isHost = gameRoom.creatorId === user?.uid
    const allReady = (gameRoom.memberIds || []).length >= 2 && (gameRoom.memberIds || []).every((uid) => readyMap[uid])
    return (
      <div className={`${page} qa-neon min-h-screen px-3 py-5 sm:px-6 sm:py-8`}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={continueSoloPractice}
            className={`mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition hover:bg-white/5 hover:text-cyan-300 ${muted}`}
          >
            <ArrowLeft size={18} /> Leave room
          </button>

          <section className={`${panel} relative overflow-hidden rounded-[26px] border border-cyan-300/15 p-4 shadow-2xl shadow-cyan-950/20 sm:p-7`}>
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />

            <div className="relative">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">
                  <Swords size={14} /> Multiplayer lobby
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-slate-300">WAITING FOR SQUAD</span>
              </div>

              <h1 className="mb-2 break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                {gameRoom.quiz?.title || activeQuiz.title}
              </h1>
              <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                <span className={muted}>Room code</span>
                <span className="font-mono font-black tracking-wider text-cyan-300">{gameRoomId.slice(0, 8).toUpperCase()}</span>
                <span className={muted}>· Up to 20 players</span>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="min-w-0 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-3 sm:p-4">
                  <p className={`text-[11px] font-semibold sm:text-xs ${muted}`}>Players joined</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-cyan-200 sm:text-3xl">
                    {gameRoom.players?.length || 1}<span className="text-sm font-bold text-slate-500 sm:text-base"> / 20</span>
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl border border-violet-300/15 bg-violet-300/[0.07] p-3 sm:p-4">
                  <p className={`text-[11px] font-semibold sm:text-xs ${muted}`}>Questions</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-violet-200 sm:text-3xl">{activeQuiz.questions?.length || 0}</p>
                </div>
              </div>

              <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-black sm:text-lg">Squad lineup</h2>
                  <p className={`mt-0.5 text-xs ${muted}`}>Everyone must be ready before the battle starts.</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button onClick={copyGameInvite} className={`${buttonSecondary} min-h-11 w-full justify-center sm:w-auto`}>
                    <Copy size={16} className="mr-2" /> Copy invite link
                  </button>
                  <button onClick={shareGameInvite} className={`${buttonPrimary} min-h-11 w-full justify-center sm:w-auto`}>
                    <Send size={16} className="mr-2" /> Share invite
                  </button>
                </div>
              </div>

              <div className="mb-5 space-y-2.5">
                {(gameRoom.players || []).map((player) => {
                  const playerReady = Boolean(readyMap[player.uid])
                  const playerIsHost = player.uid === gameRoom.creatorId
                  return (
                    <div key={player.uid} className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:gap-3 sm:p-3.5">
                      <PlayerAvatar emoji={player.avatarEmoji || '😎'} color={player.avatarColor || AVATAR_BACKGROUNDS[0].value} size="h-10 w-10 sm:h-11 sm:w-11" className="row-span-2 sm:row-span-1" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold sm:text-base" title={player.name}>{player.name}</p>
                        <p className={`mt-0.5 text-[11px] sm:text-xs ${muted}`}>{playerIsHost ? 'Room host' : 'Squad member'} · {playerReady ? 'Ready to battle' : 'Waiting to get ready'}</p>
                      </div>
                      <span className={`col-start-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide sm:col-start-auto sm:row-start-1 sm:text-[11px] ${playerReady ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${playerReady ? 'bg-emerald-300' : 'bg-amber-300'}`} />
                        {playerReady ? 'READY' : 'NOT READY'}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {!isHost && (
                  <button
                    onClick={() => setPlayerReady(!readyMap[user.uid])}
                    disabled={readyBusy}
                    className={`${buttonPrimary} min-h-12 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {readyBusy ? 'Updating…' : readyMap[user.uid] ? 'Cancel ready' : 'I’m ready'}
                    <CheckCircle2 className="ml-2" size={18} />
                  </button>
                )}
                {isHost && (
                  <button
                    onClick={startMultiplayerGame}
                    disabled={!allReady}
                    className={`${buttonPrimary} min-h-12 w-full justify-center disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50`}
                  >
                    <Swords className="mr-2" size={18} /> Start battle
                  </button>
                )}
                <button onClick={continueSoloPractice} className={`${buttonSecondary} min-h-12 w-full justify-center`}>
                  Practice solo instead
                </button>
              </div>

              {isHost && (
                <div className={`mt-4 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${allReady ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200' : 'border-white/10 bg-white/[0.025] text-slate-400'}`}>
                  {allReady ? 'Your squad is ready. Launch the battle!' : 'Share the invite link. At least 2 players must join and everyone must press READY before you can start.'}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (activeQuiz) {
    const questions = activeQuiz.questions || []
    const question = questions[currentQuestion]
    const score = questions.reduce((total, item, index) => total + (isCorrectAnswer(item, answers[index]) ? 1 : 0), 0)
    return <div className={`${page} relative min-h-screen overflow-hidden px-4 py-8 sm:px-6`}><div className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" aria-live="polite">{reactionBursts.map((reaction) => <span key={reaction.id} className="qa-reaction-burst absolute bottom-[18%] text-4xl sm:text-5xl" style={{ left: `${reaction.left}%` }} title={`${reaction.name || 'Player'} reacted`}>{reaction.emoji}</span>)}</div><div className="relative z-10 mx-auto max-w-3xl">
      <button onClick={closeQuiz} className={`mb-6 inline-flex items-center gap-2 ${muted} hover:text-violet-400`}><ArrowLeft size={18} /> Back to arena</button>
      <div className={`${panel} rounded-3xl p-5 sm:p-8`}>
        {!quizFinished && gameRoom?.status === 'countdown' ? <div className="py-16 text-center"><div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-200"><Swords size={48} /></div><p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Get ready, squad</p><h1 className="text-5xl font-black">{Math.max(1, secondsLeft)}</h1><p className={`mt-3 ${muted}`}>The same quiz is about to begin for everyone.</p></div> : !quizFinished ? <>
          <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-violet-400"><Zap size={15} /> {activeQuiz.category}</p><h1 className="text-2xl font-black sm:text-3xl">{activeQuiz.title}</h1><p className="mt-1 text-xs text-cyan-300">RANDOM ROUND · THINK FAST · HAVE FUN</p></div><div className="flex items-center gap-2"><button onClick={() => setSoundEnabled((value) => !value)} className={`${buttonSecondary} p-2.5`} title={soundEnabled ? 'Turn sounds off' : 'Turn sounds on'} aria-label={soundEnabled ? 'Turn sounds off' : 'Turn sounds on'}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><span className="rounded-xl bg-violet-500/15 px-3 py-2 text-sm font-bold text-violet-300">{currentQuestion + 1}/{questions.length}</span></div></div>
          <div className="mb-8 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} /></div>
          {gameRoomId && gameRoom?.status === 'playing' && <div className="mb-5 flex items-center justify-between rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] px-4 py-3"><span className="text-xs font-bold uppercase tracking-wider text-violet-200">Time remaining</span><span className="font-mono text-xl font-black text-cyan-200">{secondsLeft}s</span></div>}
          {gameRoomId && <div className="mb-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="font-black"><Users size={16} className="mr-2 inline text-cyan-300" /> Live squad · {gameRoom?.players?.length || 1} players</p><div className="flex gap-2"><button onClick={copyGameInvite} className={buttonSecondary}><Copy size={15} className="mr-2" /> Copy</button><button onClick={shareGameInvite} className={buttonPrimary}><Send size={15} className="mr-2" /> Share</button></div></div><div className="mb-3 flex flex-wrap gap-2">{(gameRoom?.players || []).map((player) => <span key={player.uid} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold"><PlayerAvatar emoji={player.avatarEmoji || '😎'} color={player.avatarColor || AVATAR_BACKGROUNDS[0].value} size="h-6 w-6 text-xs" />{player.name}{player.uid === gameRoom.creatorId ? ' · Host' : ''}</span>)}</div><div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold text-slate-400">React:</span>{['🔥','😂','👏','💯','😎','⚡','❤️'].map((emoji) => <button key={emoji} onClick={() => sendGameReaction(emoji)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-lg hover:border-cyan-300/40">{emoji}</button>)}</div>{(gameRoom?.reactions || []).slice(-5).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{gameRoom.reactions.slice(-5).map((reaction) => <span key={reaction.id} className="rounded-full bg-violet-400/10 px-3 py-1 text-xs"><b>{reaction.name || 'Player'}</b> {reaction.emoji}</span>)}</div>}</div>}
          {answerFeedback && answers[currentQuestion] !== undefined && <div className={`mb-4 animate-pulse rounded-2xl border p-3 text-center text-sm font-black ${answerFeedback === 'correct' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/30 bg-rose-400/10 text-rose-300'}`}>{answerFeedback === 'correct' ? '✨ NICE! CORRECT ANSWER! +1 POINT' : '⚡ OOPS! NOT THIS TIME — LEARN AND LEVEL UP!'}</div>}
          <h2 className="mb-6 text-xl font-bold leading-relaxed">{question.question}</h2>
          {question.type === 'identification' ? <div className="space-y-3"><label className={`block text-sm font-bold ${muted}`}>Type your answer</label><input value={identificationDraft} disabled={answers[currentQuestion] !== undefined} onChange={(e) => setIdentificationDraft(e.target.value)} placeholder="Enter your answer..." className={`w-full rounded-xl border px-4 py-4 text-lg outline-none focus:border-cyan-400 ${field}`} /><button disabled={!identificationDraft.trim() || answers[currentQuestion] !== undefined} onClick={() => {
            const value = identificationDraft.trim()
            if (gameRoomId) submitGameAnswer(value)
            else {
              const correct = isCorrectAnswer(question, value)
              const finalAnswers = { ...answers, [currentQuestion]: value }
              setAnswers(finalAnswers)
              setAnswerFeedback(correct ? 'correct' : 'wrong')
              if (soundEnabled) playAnswerTone(correct)
              if (!correct) advanceAfterWrongAnswer(finalAnswers, currentQuestion)
            }
          }} className={buttonPrimary}>Lock answer</button></div> : <div className="grid gap-3">{(question.options || []).map((option, index) => {
            const selected = answers[currentQuestion] === index
            const answered = answers[currentQuestion] !== undefined
            const correct = question.correctAnswer === index
            const wrongSelected = answered && selected && !correct
            const style = answered && correct ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : wrongSelected ? 'border-rose-400 bg-rose-500/15 text-rose-300' : isDark ? 'border-white/10 hover:border-cyan-400 hover:bg-cyan-500/10' : 'border-slate-200 hover:border-cyan-400'
            return <button key={index} onClick={() => chooseAnswer(index)} disabled={answered} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${style} ${answered ? 'cursor-default' : 'hover:-translate-y-0.5'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-500/15 font-black text-cyan-300">{question.type === 'boolean' ? (index === 0 ? 'T' : 'F') : String.fromCharCode(65 + index)}</span><span className="flex-1 font-semibold">{option}</span>{answered && correct && <CheckCircle2 className="text-emerald-300" size={22} />}{wrongSelected && <X className="text-rose-300" size={22} />}</button>
          })}</div>}
          {answers[currentQuestion] !== undefined && <div className={`mt-4 rounded-2xl border p-4 ${isCorrectAnswer(question, answers[currentQuestion]) ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-rose-400/30 bg-rose-500/10'}`}><p className={`font-bold ${isCorrectAnswer(question, answers[currentQuestion]) ? 'text-emerald-300' : 'text-rose-300'}`}>{isCorrectAnswer(question, answers[currentQuestion]) ? 'Correct answer! 🎉' : 'Not quite — keep going! 💪'}</p>{!isCorrectAnswer(question, answers[currentQuestion]) && <p className={`mt-1 text-sm ${muted}`}>Correct answer: <span className="font-bold text-emerald-300">{question.type === 'identification' ? question.correctText : question.options[question.correctAnswer]}</span></p>}</div>}
          <div className="mt-8 flex items-center justify-between gap-3">{gameRoomId ? <div className="w-full rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-3 text-center text-sm font-semibold text-cyan-100">{answers[currentQuestion] !== undefined ? 'Answer locked — waiting for the squad…' : 'Submit your answer. The next question syncs for everyone.'}</div> : <div className="flex w-full justify-end">{currentQuestion < questions.length - 1 ? <button className={buttonPrimary} disabled={answers[currentQuestion] === undefined || answerFeedback === 'wrong'} onClick={() => { setCurrentQuestion((n) => n + 1); setIdentificationDraft(''); setAnswerFeedback('') }}>Next question <ChevronRight className="ml-1" size={18} /></button> : <button className={buttonPrimary} disabled={answers[currentQuestion] === undefined || answerFeedback === 'wrong'} onClick={() => finishQuiz()}>Finish quiz <Trophy className="ml-2" size={18} /></button>}</div>}</div>
        </>  : <div className="relative overflow-hidden py-5 text-center sm:py-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.18),transparent_68%)]" />
          <div className="relative z-10 mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[26px] border border-amber-300/25 bg-gradient-to-br from-amber-300/20 via-orange-400/10 to-violet-400/15 text-amber-200 shadow-[0_0_55px_rgba(251,191,36,0.14)] sm:h-24 sm:w-24">
            <Trophy size={46} strokeWidth={1.8} />
          </div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.28em] text-violet-300">Mission complete</p>
          <h1 className="mb-2 text-3xl font-black tracking-tight sm:text-4xl">{score === questions.length ? 'Perfect run!' : score / Math.max(questions.length, 1) >= 0.7 ? 'Amazing work!' : 'Run complete!'}</h1>
          <p className={`mx-auto mb-7 max-w-md text-sm ${muted}`}>{score === questions.length ? 'Flawless performance. You answered every question correctly!' : 'Every round makes you sharper. Check your performance below.'}</p>

          <div className="mx-auto mb-6 max-w-xl rounded-[26px] border border-violet-300/20 bg-gradient-to-br from-violet-400/[0.12] via-cyan-400/[0.06] to-violet-400/[0.10] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-7">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Your final score</p>
            <div className="flex items-baseline justify-center gap-2"><span className="text-6xl font-black tracking-tighter text-white sm:text-7xl">{score}</span><span className="text-2xl font-bold text-slate-400">/ {questions.length}</span></div>
            <div className="mx-auto mt-4 h-2.5 max-w-sm overflow-hidden rounded-full bg-slate-950/60"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-300 to-violet-400 transition-all duration-700" style={{ width: `${questions.length ? (score / questions.length) * 100 : 0}%` }} /></div>
            <p className="mt-3 text-2xl font-black text-cyan-200">{questions.length ? Math.round((score / questions.length) * 100) : 0}% <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">accuracy</span></p>
          </div>

          <div className="mx-auto mb-7 grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] p-3 sm:p-4"><CheckCircle2 className="mx-auto mb-2 text-emerald-300" size={21} /><p className="text-2xl font-black text-emerald-200">{score}</p><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/70 sm:text-xs">Correct</p></div>
            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/[0.07] p-3 sm:p-4"><X className="mx-auto mb-2 text-rose-300" size={21} /><p className="text-2xl font-black text-rose-200">{questions.length - score}</p><p className="text-[10px] font-bold uppercase tracking-wider text-rose-100/70 sm:text-xs">Missed</p></div>
            <div className="rounded-2xl border border-violet-300/20 bg-violet-400/[0.07] p-3 sm:p-4"><Flame className="mx-auto mb-2 text-violet-300" size={21} /><p className="text-2xl font-black text-violet-200">{questions.length ? Math.round((score / questions.length) * 100) : 0}%</p><p className="text-[10px] font-bold uppercase tracking-wider text-violet-100/70 sm:text-xs">Accuracy</p></div>
          </div>

          {gameRoomId && <div className="mx-auto mb-7 max-w-xl rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.10] to-orange-400/[0.04] p-4 text-left sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-black text-amber-200"><Crown size={20} /> Squad leaderboard</h2>
            <div className="space-y-2">{(gameRoom?.players || []).map((player) => { const playerAnswers = gameRoom?.playerAnswers?.[player.uid] || {}; const playerScore = questions.reduce((total, item, index) => total + (isCorrectAnswer(item, playerAnswers[index]) ? 1 : 0), 0); return { ...player, score: playerScore } }).sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name))).map((player, index) => <div key={player.uid} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 ${index === 0 ? 'border-amber-300/25 bg-amber-300/[0.08]' : 'border-white/[0.07] bg-white/[0.025]'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black ${index === 0 ? 'bg-amber-300/20 text-amber-200' : 'bg-white/[0.06] text-slate-300'}`}>{index === 0 ? <Medal size={18} /> : `#${index + 1}`}</span><PlayerAvatar emoji={player.avatarEmoji || '😎'} color={player.avatarColor || AVATAR_BACKGROUNDS[0].value} size="h-9 w-9 text-lg" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{player.name}{player.uid === gameRoom?.creatorId ? ' · HOST' : ''}</span><span className="shrink-0 text-sm font-black text-cyan-200">{player.score}/{questions.length}</span></div>)}</div>
          </div>}

          <div className="mx-auto mb-6 max-w-xl text-left">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Activity size={19} className="text-cyan-300" /> Answer review</h2>
            <div className="space-y-2">{questions.map((item, index) => { const correct = isCorrectAnswer(item, answers[index]); return <details key={index} className={`group rounded-2xl border ${correct ? 'border-emerald-400/20 bg-emerald-400/[0.035]' : 'border-rose-400/20 bg-rose-400/[0.035]'}`}><summary className="flex cursor-pointer list-none items-center gap-3 p-3.5"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${correct ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>{correct ? <Check size={17} /> : <X size={17} />}</span><span className="min-w-0 flex-1 text-sm font-semibold leading-5">{index + 1}. {item.question}</span><ChevronRight className="shrink-0 text-slate-500 transition group-open:rotate-90" size={17} /></summary><div className="space-y-1 border-t border-white/[0.07] px-4 py-3 text-sm"><p className={correct ? 'text-emerald-300' : 'text-rose-300'}>Your answer: {answerLabel(item, answers[index])}</p>{!correct && <p className="text-emerald-300">Correct answer: {item.type === 'identification' ? item.correctText : item.options?.[item.correctAnswer]}</p>}</div></details>})}</div>
          </div>

          <div className="mx-auto flex max-w-xl flex-col-reverse gap-3 sm:flex-row sm:justify-center">{gameRoomId ? <><button className={`${buttonSecondary} w-full justify-center sm:w-auto`} onClick={closeQuiz}><ArrowLeft className="mr-2" size={17} /> Back to arena</button>{gameRoom?.creatorId === user.uid && <button className={`${buttonPrimary} w-full justify-center sm:w-auto`} onClick={startRematch}><RotateCcw className="mr-2" size={17} /> Rematch squad</button>}</> : <><button className={`${buttonSecondary} w-full justify-center sm:w-auto`} onClick={closeQuiz}><ArrowLeft className="mr-2" size={17} /> Dashboard</button><button className={`${buttonPrimary} w-full justify-center sm:w-auto`} onClick={() => startQuiz(activeQuiz)}><RotateCcw className="mr-2" size={17} /> Play again</button></>}</div>
        </div>}
      </div></div></div>
  }

  const filteredPeople = people.filter((p) => (p.displayName || p.name || '').toLowerCase().includes(friendSearch.toLowerCase()) || p.email?.toLowerCase().includes(friendSearch.toLowerCase()))
  const selectedFriend = chatMode.startsWith('friends_') ? friends.find((f) => friendRoomId(user.uid, f.otherId) === chatMode) : null

  return <div className={`${page} min-h-screen qa-neon`}>
    <style>{`
      .qa-neon { --qa-bg:#080b16; --qa-panel:#101629; --qa-panel2:#151d33; --qa-line:rgba(148,163,184,.14); --qa-cyan:#39e7ff; --qa-violet:#9b7bff; background:radial-gradient(ellipse at 78% -10%,rgba(117,75,255,.18),transparent 38%),radial-gradient(ellipse at 0% 45%,rgba(0,214,255,.08),transparent 34%),var(--qa-bg)!important; color:#edf2ff!important; }
      .qa-neon aside { background:rgba(10,14,29,.94)!important; border-color:var(--qa-line)!important; box-shadow:12px 0 50px rgba(0,0,0,.18); }
      .qa-neon main { max-width:1480px; }
      .qa-neon main section > div[class*="rounded-2xl"], .qa-neon main section > div[class*="rounded-3xl"], .qa-neon main section [class*="border-white/[0.08]"] { border-color:var(--qa-line)!important; box-shadow:0 14px 40px rgba(0,0,0,.16); }
      .qa-neon .bg-\[\#121d27\] { background:#101629!important; }
      .qa-neon .bg-\[\#111b24\] { background:#0d1324!important; }
      .qa-neon button { transition:transform .18s ease,border-color .18s ease,background-color .18s ease,box-shadow .18s ease; }
      .qa-neon button:not(:disabled):hover { filter:brightness(1.08); }
      .qa-neon input:not([type=checkbox]), .qa-neon textarea, .qa-neon select { background-color:#0b1222!important; border-color:rgba(148,163,184,.2)!important; color:#edf2ff!important; border-radius:13px!important; }
      .qa-neon input:focus, .qa-neon textarea:focus, .qa-neon select:focus { border-color:var(--qa-cyan)!important; box-shadow:0 0 0 3px rgba(57,231,255,.1)!important; outline:none!important; }
      .qa-neon input::placeholder, .qa-neon textarea::placeholder { color:#71809f!important; }
      .qa-neon aside nav button[class*="bg-gradient-to-r"] { background:linear-gradient(100deg,rgba(34,211,238,.2),rgba(139,92,246,.22))!important; border:1px solid rgba(57,231,255,.25); color:#eafaff!important; box-shadow:0 0 24px rgba(57,231,255,.08)!important; }
      .qa-neon aside nav button:not([class*="bg-gradient-to-r"]):hover { background:rgba(255,255,255,.055)!important; }
      .qa-neon main header { padding:14px 0 20px; border-bottom:1px solid var(--qa-line); }
      .qa-neon main header h1 { letter-spacing:-.045em; }
      .qa-neon main section > .relative.mb-7 { background:linear-gradient(115deg,#111b37 0%,#18204a 52%,#20204a 100%)!important; border:1px solid rgba(155,123,255,.28)!important; box-shadow:0 20px 60px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.04)!important; }
      .qa-neon main section > .relative.mb-7 h2 span { color:#7cefff!important; text-shadow:0 0 24px rgba(57,231,255,.24); }
      .qa-neon main section .rounded-2xl.border, .qa-neon main section .rounded-3xl.border { border-color:var(--qa-line)!important; }
      .qa-neon main section .bg-gradient-to-r.from-violet-600, .qa-neon main section .bg-violet-600 { background:linear-gradient(105deg,#087e9b,#6545c8)!important; }
      .qa-neon main section [class*="text-violet-300"], .qa-neon main section [class*="text-cyan-300"] { color:#66eaff!important; }
      .qa-neon main section [class*="border-violet-400/20"], .qa-neon main section [class*="border-cyan-400/20"] { border-color:rgba(57,231,255,.2)!important; }
      .qa-neon main section [class*="bg-violet-500/15"], .qa-neon main section [class*="bg-cyan-500/15"] { background:rgba(57,231,255,.09)!important; }
      .qa-neon footer { color:#74819e!important; }
      .qa-reaction-burst { animation:qa-reaction-rise 1.85s cubic-bezier(.18,.72,.28,1) forwards; filter:drop-shadow(0 8px 18px rgba(0,0,0,.55)); will-change:transform,opacity; }
      @keyframes qa-reaction-rise { 0% { opacity:0; transform:translate3d(-50%,35px,0) scale(.35) rotate(-12deg); } 12% { opacity:1; transform:translate3d(-50%,0,0) scale(1.28) rotate(8deg); } 30% { transform:translate3d(-50%,-18px,0) scale(1) rotate(-5deg); } 100% { opacity:0; transform:translate3d(-50%,-210px,0) scale(.82) rotate(12deg); } }
      .qa-neon .fixed.inset-0.z-50 > div, .qa-neon .fixed.inset-0.z-\[55\] > div { background:#101629!important; border:1px solid rgba(155,123,255,.22)!important; box-shadow:0 30px 100px rgba(0,0,0,.65)!important; }
      .qa-neon .fixed.inset-0.z-50 .rounded-2xl.border { background:linear-gradient(145deg,rgba(17,28,53,.96),rgba(18,19,43,.96))!important; border-color:rgba(57,231,255,.17)!important; }
      .qa-neon .fixed.inset-0.z-50 .bg-gradient-to-br.from-cyan-500 { box-shadow:0 0 24px rgba(57,231,255,.16); }
      .qa-neon .fixed.bottom-5 { border-color:rgba(57,231,255,.24)!important; box-shadow:0 12px 50px rgba(0,0,0,.45),0 0 25px rgba(57,231,255,.08)!important; }
      @media(max-width:1023px){ .qa-neon main { margin-left:0!important; } }
      @media(prefers-reduced-motion:reduce){ .qa-neon * { transition:none!important; animation:none!important; } }
    `}</style>
    <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-700/[0.07] blur-3xl" /><div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-sky-700/[0.05] blur-3xl" /></div>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r p-5 backdrop-blur-xl lg:flex ${isDark ? 'border-white/[0.08] bg-[#121d27]/95' : 'border-slate-200 bg-white/95'}`}>
      <div className="mb-9 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-700 shadow-lg shadow-violet-950/50"><Gamepad2 size={26} /></div><div><h1 className="text-lg font-black tracking-tight">QUIZ <span className="text-violet-400">ARENA</span></h1><p className={`text-[11px] uppercase tracking-[0.22em] ${muted}`}>Learn · Play · Win</p></div></div>
      <p className={`mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] ${muted}`}>Main menu</p>
      <nav className="space-y-1.5">{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveTab(label); setMobileNav(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${activeTab === label ? 'bg-gradient-to-r from-violet-600 to-cyan-700 text-white shadow-lg shadow-violet-950/30' : isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={18} />{label}{label === 'Friends Chat' && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />}</button>)}</nav>
      <div className="mt-auto"><div className={`mb-3 flex items-center gap-3 rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200'}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/20 font-black text-violet-300">{initials(userName)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{userName}</p><p className={`truncate text-[11px] ${muted}`}>{user.isAnonymous ? 'Guest player' : user.email}</p></div><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><button onClick={() => setDarkMode((v) => !v)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${muted} hover:bg-white/[0.05]`}>{isDark ? <Sun size={18} /> : <Moon size={18} />}{isDark ? 'Light mode' : 'Dark mode'}</button><button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-rose-400 hover:bg-rose-500/10"><LogOut size={18} /> Sign out</button></div>
    </aside>

    {mobileNav && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)}><div className={`h-full w-72 p-5 ${isDark ? 'bg-[#121d27]' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}><div className="mb-6 flex items-center justify-between"><span className="font-black">QUIZ <span className="text-violet-400">ARENA</span></span><button onClick={() => setMobileNav(false)}><X /></button></div>{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveTab(label); setMobileNav(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activeTab === label ? 'bg-violet-600 text-white' : ''}`}><Icon size={18} />{label}</button>)}</div></div>}

    <main className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:ml-64 lg:px-9 lg:py-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><button className={`${buttonSecondary} p-2.5 lg:hidden`} onClick={() => setMobileNav(true)}><Menu size={20} /></button><div><p className={`mb-1 text-xs font-bold uppercase tracking-[0.18em] ${muted}`}>Player dashboard</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{activeTab === 'Overview' ? `Welcome back, ${userName}!` : activeTab}</h1></div></div><div className="flex flex-wrap gap-2"><span className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold sm:inline-flex ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}><span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} /> {isOnline ? 'Arena online' : 'Offline mode'}</span><button onClick={() => setActiveTab('My Profile')} className={`${buttonSecondary} flex items-center gap-2 px-2.5`} title="Edit player avatar"><PlayerAvatar emoji={avatarEmoji} color={avatarColor} size="h-7 w-7 text-sm" /><span className="hidden text-xs font-bold sm:inline">Profile</span></button><button onClick={() => setDarkMode((v) => !v)} className={`${buttonSecondary} p-2.5`} title="Toggle theme">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button><button onClick={() => { setShowCreate(true); setNewQuestions([emptyQuestion()]) }} className={buttonPrimary}><Plus size={18} className="mr-1" /> Create Quiz</button><button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-rose-950/20 transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2 focus:ring-offset-[#100c1e]" title="Sign out"><LogOut size={18} /> <span>Logout</span></button></div></header>

      {activeTab === 'Overview' && <><section className="relative mb-7 overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#164e63] via-[#155e75] to-[#1e3a5f] p-6 shadow-2xl shadow-violet-950/30 sm:p-9"><div className="pointer-events-none absolute -right-10 -top-12 h-64 w-64 rounded-full border-[30px] border-white/[0.05]" /><div className="pointer-events-none absolute right-16 top-10 hidden rotate-12 text-white/[0.08] sm:block"><Gamepad2 size={180} /></div><div className="relative max-w-2xl"><span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"><Sparkles size={15} /> Level up your brain</span><h2 className="mb-3 text-3xl font-black leading-tight sm:text-5xl">Think fast.<br /><span className="text-cyan-200">Play legendary.</span></h2><p className="mb-6 max-w-lg text-sm leading-6 text-violet-100 sm:text-base">Challenge your knowledge, climb the leaderboard, and invite your squad into the Arena.</p><div className="flex flex-wrap gap-3"><button onClick={() => setActiveTab('Explore Quizzes')} className="rounded-xl bg-white px-5 py-3 font-black text-violet-800 transition hover:-translate-y-0.5 hover:bg-violet-50">Start a challenge <ChevronRight className="ml-1 inline" size={18} /></button><button onClick={() => setActiveTab('Invite Friends')} className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/15"><Users className="mr-2 inline" size={17} /> Invite squad</button></div></div></section>
      <section className="qa-dashboard-stats mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Available Quizzes', value: quizzes.length, icon: BookOpen, color: 'text-violet-300', bg: 'bg-violet-500/15' }, { label: 'My Quizzes', value: myQuizzes.length, icon: Plus, color: 'text-cyan-300', bg: 'bg-cyan-500/15' }, { label: 'Quizzes Completed', value: myResults.length, icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/15' }, { label: 'Average Score', value: `${averageScore}%`, icon: Trophy, color: 'text-amber-300', bg: 'bg-amber-500/15' }].map(({ label, value, icon: Icon, color, bg }) => <div key={label} className={`${panel} rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-violet-400/30`}><div className="mb-4 flex items-center justify-between"><span className={`text-sm ${muted}`}>{label}</span><span className={`rounded-xl p-2.5 ${bg} ${color}`}><Icon size={20} /></span></div><p className="text-3xl font-black tracking-tight">{value}</p><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" /></div></div>)}</section></>}

      {activeTab === 'Leaderboard' && <section><div className={`${panel} mb-5 rounded-2xl p-5`}><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-300"><Crown size={26} /></div><div><h2 className="text-xl font-black">Hall of Fame</h2><p className={`text-sm ${muted}`}>Recent scores from Arena players.</p></div></div></div><div className={`${panel} overflow-hidden rounded-2xl`}>{results.length === 0 ? <p className={`p-8 text-center ${muted}`}>No scores yet. Complete a quiz to appear here.</p> : <div className="divide-y divide-white/[0.06]">{[...results].sort((a,b) => (Number(b.score) || 0) - (Number(a.score) || 0) || (b.totalQuestions ? b.score / b.totalQuestions : 0) - (a.totalQuestions ? a.score / a.totalQuestions : 0) || (Number(b.createdAt?.seconds || b.createdAt || 0) - Number(a.createdAt?.seconds || a.createdAt || 0))).map((result, index) => <div key={result.id} className="qa-leaderboard-row flex flex-wrap items-center gap-4 p-4 sm:p-5"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-black ${index === 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-violet-500/15 text-violet-300'}`}>{index === 0 ? <Medal size={21} /> : index + 1}</span><PlayerAvatar emoji={result.avatarEmoji || '😎'} color={result.avatarColor || AVATAR_BACKGROUNDS[0].value} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{result.userName || 'Player'}</p><p className={`truncate text-sm ${muted}`}>{result.quizTitle || 'Quiz challenge'}</p></div><div className="ml-auto min-w-[76px] text-right"><p className="font-black tabular-nums text-cyan-300">{Number(result.score) || 0}/{Number(result.totalQuestions) || 0}</p><p className={`text-[11px] ${muted}`}>{result.totalQuestions ? Math.round((Number(result.score) / Number(result.totalQuestions)) * 100) : 0}% score</p></div></div>)}</div>}</div></section>}

      {activeTab === 'Friends Chat' && <section className="qa-chat-layout grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"><div className={`${panel} qa-chat-sidebar min-w-0 rounded-2xl p-4 sm:p-5`}><h2 className="mb-3 flex items-center gap-2 font-black"><Users size={18} className="text-violet-300" /> Friends Chat</h2><p className={`mb-2 mt-5 px-2 text-[10px] font-black uppercase tracking-[0.2em] ${muted}`}>Your squad</p>{friends.length === 0 ? <p className={`px-2 py-3 text-sm ${muted}`}>Add friends to unlock private chats.</p> : friends.map((friend) => { const id = friendRoomId(user.uid, friend.otherId); return <button key={friend.id} onClick={() => setChatMode(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${chatMode === id ? 'bg-violet-600 text-white' : 'hover:bg-white/[0.05]'}`}><PlayerAvatar emoji={friend.avatarEmoji || '😎'} color={friend.avatarColor || AVATAR_BACKGROUNDS[0].value} size="h-9 w-9 text-lg" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{friend.name}</span><span className={`block text-[10px] ${presenceIsOnline(friend) ? 'text-emerald-400' : muted}`}>{presenceIsOnline(friend) ? '● Online' : lastSeenLabel(friend.lastSeen)}</span></span><span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-offset-2 ${presenceIsOnline(friend) ? 'bg-emerald-400 ring-emerald-400/20 ring-offset-[#111827]' : 'bg-slate-500 ring-slate-500/20 ring-offset-[#111827]'}`} /></button>})}<button onClick={() => setActiveTab('Friends')} className={`${buttonSecondary} mt-4 w-full text-sm`}><UserPlus className="mr-2" size={16} /> Find friends</button></div>
        <div className={`${panel} qa-chat-window flex min-h-[min(680px,calc(100dvh-190px))] min-w-0 flex-col overflow-hidden rounded-2xl`}><div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600"><Users size={21} /></div><div className="min-w-0 flex-1"><h2 className="font-black">{selectedFriend?.name || 'Choose a friend'}</h2><p className={`text-xs ${selectedFriend && presenceIsOnline(selectedFriend) ? 'text-emerald-400' : muted}`}>{selectedFriend ? (presenceIsOnline(selectedFriend) ? '● Online now' : `○ Offline · ${lastSeenLabel(selectedFriend.lastSeen)}`) : 'Private conversation between friends'}</p></div>{selectedFriend && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${presenceIsOnline(selectedFriend) ? 'bg-emerald-400' : 'bg-slate-500'}`} />}</div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{messages.length === 0 ? <div className="grid h-full min-h-64 place-items-center text-center"><div><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><MessageSquare size={25} /></div><p className="font-bold">No messages yet</p><p className={`mt-1 text-sm ${muted}`}>Choose a friend to start a private conversation.</p></div></div> : messages.map((message) => { const mine = message.senderId === user.uid; return <div key={message.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>{!mine && <PlayerAvatar emoji={message.senderAvatarEmoji || '😎'} color={message.senderAvatarColor || AVATAR_BACKGROUNDS[0].value} size="h-8 w-8 text-base" />}<div className={`max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}><div className={`mb-1 flex items-center gap-2 text-[10px] ${muted}`}><span>{mine ? 'You' : message.senderName || 'Player'}</span><span>{timeLabel(message.createdAt)}</span></div><div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${mine ? 'rounded-br-md bg-gradient-to-r from-violet-600 to-cyan-700 text-white' : isDark ? 'rounded-bl-md bg-white/[0.07]' : 'rounded-bl-md bg-slate-100'}`}>{message.text}</div></div>{mine && <PlayerAvatar emoji={avatarEmoji} color={avatarColor} size="h-8 w-8 text-base" />}</div>})}<div ref={chatEndRef} /></div>
        {showEmoji && <div className="mx-4 mb-2 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0b1224] p-3">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => setChatText((v) => v + emoji)} className="rounded-lg p-1.5 text-xl hover:bg-white/10">{emoji}</button>)}</div>}
        <form onSubmit={sendMessage} className="border-t border-white/[0.07] p-3 sm:p-4"><div className={`flex items-center gap-2 rounded-2xl border p-2 ${isDark ? 'border-white/10 bg-[#0b1224]' : 'border-slate-200 bg-slate-50'}`}><button type="button" onClick={() => setShowEmoji((v) => !v)} className={`rounded-xl p-2 ${showEmoji ? 'bg-violet-500/20 text-violet-300' : muted}`} title="Emoji picker"><Smile size={21} /></button><input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Message your friend..." maxLength={1000} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" /><button type="submit" disabled={!chatText.trim()} className={`${buttonPrimary} p-2.5`} aria-label="Send message"><Send size={18} /></button></div><p className={`mt-2 px-2 text-[10px] ${muted}`}>Messages are saved in Firebase. Keep it friendly. 💜</p></form></div></section>}

      {activeTab === 'Friends' && <section className="qa-friends-layout grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2"><div className={`${panel} min-w-0 rounded-2xl p-5 sm:p-6`}><div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Users size={22} /></div><div><h2 className="font-black">Your squad</h2><p className={`text-sm ${muted}`}>{friends.length} friend{friends.length === 1 ? '' : 's'} connected</p></div></div>{friends.length === 0 ? <p className={`rounded-xl border border-dashed border-white/10 p-6 text-center text-sm ${muted}`}>No friends yet. Send an invite or connect with a player.</p> : <div className="space-y-2">{friends.map((f) => { const online = presenceIsOnline(f); return <div key={f.id} className="qa-friend-card flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 sm:flex-nowrap sm:p-4"><PlayerAvatar emoji={f.avatarEmoji || '😎'} color={f.avatarColor || AVATAR_BACKGROUNDS[0].value} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{f.name}</p><p className={`text-xs ${online ? 'text-emerald-400' : muted}`}>{online ? '● Online' : `○ Offline · ${lastSeenLabel(f.lastSeen)}`}</p></div><button onClick={() => { setChatMode(friendRoomId(user.uid, f.otherId)); setActiveTab('Friends Chat') }} className={buttonSecondary}><MessageCircle className="mr-2" size={16} /> Chat</button></div>})}</div>}
        <div className="mt-6 border-t border-white/[0.07] pt-5"><h3 className="mb-3 font-bold">Friend requests <span className="ml-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300">{friendRequests.length}</span></h3>{friendRequests.length === 0 ? <p className={`text-sm ${muted}`}>You're all caught up.</p> : <div className="space-y-2">{friendRequests.map((r) => <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{r.fromName || 'Player'}</p><p className={`text-xs ${muted}`}>wants to connect</p></div><button onClick={() => acceptFriendRequest(r)} className={`${buttonPrimary} px-3 py-2`}><Check size={16} className="mr-1" /> Accept</button></div>)}</div>}</div></div>
        <div className={`${panel} min-w-0 rounded-2xl p-5 sm:p-6`}><div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300"><Search size={21} /></div><div><h2 className="font-black">Find players</h2><p className={`text-sm ${muted}`}>Grow your Arena squad.</p></div></div><div className="relative mb-4"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={17} /><input value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} placeholder="Search players..." className={`w-full rounded-xl border py-3 pl-10 pr-3 outline-none focus:border-violet-500 ${field}`} /></div><div className="space-y-2">{filteredPeople.slice(0, 12).map((p) => { const alreadyFriend = friends.some((f) => f.otherId === p.id); const online = p.presence === 'online' && Date.now() - Number(p.presenceUpdatedAt || 0) < 90000; return <div key={p.id} className="qa-player-card flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] p-3 transition hover:border-cyan-300/20 hover:bg-white/[0.04] sm:flex-nowrap"><PlayerAvatar emoji={p.avatarEmoji || '😎'} color={p.avatarColor || AVATAR_BACKGROUNDS[0].value} /><div className="min-w-0 flex-1"><p className="truncate font-bold">{p.displayName || p.name || 'Quiz Player'}</p><p className={`truncate text-xs ${muted}`}>{online ? '● Online' : '○ Offline'} · {p.email || 'Quiz Arena player'}</p></div>{alreadyFriend ? <span className="text-xs font-semibold text-emerald-300"><Check size={15} className="mr-1 inline" /> Friend</span> : <button onClick={() => sendFriendRequest(p)} className={`${buttonSecondary} px-3 py-2 text-xs`}><UserPlus size={15} className="mr-1" /> Add</button>}</div>})}{filteredPeople.length === 0 && <p className={`py-6 text-center text-sm ${muted}`}>No player profiles found yet.</p>}</div><p className={`mt-4 text-xs ${muted}`}>Players appear here after their profile is created in Firestore.</p></div></section>}

      {activeTab === 'My Profile' && <section className="mx-auto max-w-4xl space-y-5">
        <div className={`${panel} overflow-hidden rounded-3xl p-5 sm:p-7`}>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <PlayerAvatar emoji={avatarEmoji} color={avatarColor} size="h-24 w-24 text-5xl" />
            <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Player identity</p><h2 className="mt-1 text-2xl font-black">{userName}</h2><p className={`mt-1 text-sm ${muted}`}>Choose an avatar that represents you in the Arena.</p></div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">{user?.isAnonymous ? 'Guest Player' : 'Arena Player'}</span>
          </div>
        </div>
        <form onSubmit={saveAccountName} className={`${panel} rounded-3xl p-5 sm:p-7`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300"><Pencil size={20} /></div>
            <div><h3 className="text-lg font-black">Player name</h3><p className={`text-sm ${muted}`}>This is the name shown around your Arena.</p></div>
          </div>
          <label htmlFor="arena-player-name" className={`mb-2 block text-sm font-semibold ${muted}`}>Display name</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="arena-player-name" value={renameNameDraft} onChange={(event) => setRenameNameDraft(event.target.value)} maxLength={40} minLength={2} required placeholder="Enter your player name" className={`${field} min-w-0 flex-1 rounded-xl border px-4 py-3`} />
            <button type="submit" disabled={renameSaving || renameNameDraft.trim().replace(/\s+/g, ' ') === userName} className={`${buttonPrimary} min-h-12 justify-center disabled:cursor-not-allowed disabled:opacity-50`}>
              {renameSaving ? <><Activity size={17} className="mr-2 animate-spin" /> Saving...</> : <><Check size={17} className="mr-2" /> Save name</>}
            </button>
          </div>
          <p className={`mt-3 text-xs ${muted}`}>2–40 characters. Guest names are saved on this device; online accounts sync to your player profile.</p>
        </form>
        <div className={`${panel} rounded-3xl p-5 sm:p-7`}>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-lg font-black">Choose your avatar</h3><p className={`text-sm ${muted}`}>64 expressive gaming-style emoji avatars.</p></div><span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">{PLAYER_AVATARS.length} avatars</span></div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">{PLAYER_AVATARS.map(([emoji, label]) => <button key={label} type="button" onClick={() => saveAvatarSelection(emoji, avatarColor)} title={label} aria-label={`Choose ${label} avatar`} className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border p-2 transition hover:-translate-y-0.5 ${avatarEmoji === emoji ? 'border-cyan-300 bg-cyan-300/10 ring-2 ring-cyan-300/20' : 'border-white/10 bg-white/[0.025] hover:border-violet-300/40'}`}><PlayerAvatar emoji={emoji} color={avatarColor} size="h-12 w-12 text-2xl" /><span className={`w-full truncate text-[10px] font-bold ${muted}`}>{label}</span></button>)}</div>
        </div>
        <div className={`${panel} rounded-3xl p-5 sm:p-7`}><h3 className="mb-1 text-lg font-black">Avatar background</h3><p className={`mb-4 text-sm ${muted}`}>Pick your signature color.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{AVATAR_BACKGROUNDS.map((item) => <button key={item.name} type="button" onClick={() => saveAvatarSelection(avatarEmoji, item.value)} className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-bold ${avatarColor === item.value ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/10 bg-white/[0.025]'}`}><span className={`h-7 w-7 rounded-full bg-gradient-to-br ${item.value}`} /><span className="truncate">{item.name}</span>{avatarColor === item.value && <Check size={15} className="ml-auto shrink-0 text-cyan-300" />}</button>)}</div><p className={`mt-4 text-xs ${muted}`}>{avatarSaving ? 'Saving avatar...' : 'Your selection is saved automatically. Guest avatars stay on this device; online accounts sync to your profile.'}</p></div>
      </section>}

      {activeTab === 'Invite Friends' && <section className="mx-auto max-w-3xl"><div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-800 via-cyan-800 to-slate-800 p-6 sm:p-9"><div className="absolute -right-8 -top-8 text-white/[0.08]"><Users size={190} /></div><div className="relative"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><UserPlus size={29} /></div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-violet-200">Build your squad</p><h2 className="mb-3 text-3xl font-black sm:text-4xl">The Arena is better together.</h2><p className="mb-7 max-w-xl text-sm leading-6 text-violet-100">Create a personal invitation link. Send it through Messenger, Facebook, or any app. When your friend opens the link and accepts, you can chat privately.</p><button onClick={createInvite} disabled={inviteBusy} className="rounded-xl bg-white px-5 py-3 font-black text-violet-800 transition hover:-translate-y-0.5 disabled:opacity-60">{inviteBusy ? 'Creating link...' : <><Link2 className="mr-2 inline" size={18} /> Create & copy invite link</>}</button></div></div>
        {inviteLink && <div className={`${panel} mt-5 rounded-2xl p-5`}><h3 className="mb-2 font-black">Your invitation link</h3><p className={`mb-3 text-sm ${muted}`}>Anyone with this link can request to connect with you. Only share it with people you trust.</p><div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={inviteLink} className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm ${field}`} /><button onClick={() => { navigator.clipboard?.writeText(inviteLink).then(() => setNotice('Invite link copied!')).catch(() => setNotice('Select and copy the link manually.')) }} className={buttonPrimary}><Copy className="mr-2" size={17} /> Copy</button></div><button onClick={() => { const url = `https://www.facebook.com/messages/`; window.open(url, '_blank', 'noopener,noreferrer') }} className={`${buttonSecondary} mt-3`}><Mail className="mr-2" size={17} /> Open Messenger</button></div>}
        {inviteCode && !inviteLink && <div className={`${panel} mt-5 rounded-2xl p-5`}><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><ShieldCheck size={23} /></div><div className="flex-1"><h3 className="font-black">You've been invited to the Arena!</h3><p className={`my-2 text-sm ${muted}`}>Accept this invitation to connect and unlock a private friends chat.</p><button onClick={acceptInvite} className={buttonPrimary}>Accept invitation <ChevronRight className="ml-1" size={17} /></button></div></div></div>}
        <div className={`${panel} mt-5 rounded-2xl p-5`}><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black">Your Arena connections</h3><span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">{friends.length} connected</span></div><p className={`text-sm ${muted}`}>Accepted invitations appear in Friends and unlock private chat. During a quiz, the live player list shows who joined that specific game room.</p>{friendRequests.length > 0 && <p className="mt-3 text-sm font-semibold text-amber-300">{friendRequests.length} pending friend request{friendRequests.length === 1 ? '' : 's'} waiting in Friends.</p>}</div>
        <div className={`${panel} mt-5 rounded-2xl p-5`}><h3 className="mb-3 font-black">How it works</h3><div className="grid gap-4 sm:grid-cols-3">{[{ n:'01', title:'Create a link', desc:'Generate a unique invitation.' },{ n:'02', title:'Share it', desc:'Send the link to your friend.' },{ n:'03', title:'Connect & chat', desc:'Accept to unlock private chat.' }].map((item) => <div key={item.n} className="rounded-xl bg-white/[0.03] p-4"><p className="mb-2 text-xs font-black text-violet-300">{item.n}</p><p className="mb-1 font-bold">{item.title}</p><p className={`text-sm ${muted}`}>{item.desc}</p></div>)}</div></div></section>}

      {(activeTab === 'Overview' || activeTab === 'Explore Quizzes' || activeTab === 'My Quizzes') && <section><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">{activeTab === 'My Quizzes' ? 'Your creations' : activeTab === 'Explore Quizzes' ? 'Explore challenges' : 'Popular challenges'}</h2><p className={`mt-1 text-sm ${muted}`}>Pick a challenge and prove your skills.</p></div><div className="relative w-full sm:w-72"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quizzes..." className={`w-full rounded-xl border py-3 pl-10 pr-4 outline-none focus:border-violet-500 ${field}`} /></div></div>
        {visibleQuizzes.length === 0 ? <div className={`${panel} rounded-2xl p-10 text-center`}><BookOpen className={`mx-auto mb-3 ${muted}`} size={36} /><h3 className="mb-2 text-lg font-black">No quizzes found</h3><p className={`mb-5 text-sm ${muted}`}>Try another search or create a challenge.</p><button className={buttonPrimary} onClick={() => { closeQuizCreator(); setShowCreate(true) }}><Plus className="mr-1" size={18} /> Create Quiz</button></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleQuizzes.map((quiz, index) => <article key={quiz.id} className={`${panel} group overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:border-violet-400/30`}><div className={`relative flex h-32 items-center justify-center overflow-hidden ${index % 3 === 0 ? 'bg-gradient-to-br from-violet-800 to-slate-700' : index % 3 === 1 ? 'bg-gradient-to-br from-cyan-800 to-violet-700' : 'bg-gradient-to-br from-slate-700 to-sky-800'}`}><div className="absolute -right-3 -top-7 rotate-12 text-white/10 transition group-hover:scale-110"><Gamepad2 size={120} /></div><BookOpen size={43} className="relative text-white drop-shadow-lg transition group-hover:scale-110" /><span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">{quiz.difficulty || 'Custom'}</span></div><div className="p-5"><span className="mb-3 inline-flex rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">{quiz.category || 'General'}</span><h3 className="mb-2 text-lg font-black">{quiz.title}</h3>{quiz.description?.trim() && <p className={`mb-3 line-clamp-2 text-sm ${muted}`}>{quiz.description}</p>}<p className={`mb-5 flex items-center gap-2 text-sm ${muted}`}><BookOpen size={16} /> {quiz.questions?.length || 0} questions <span>·</span><Clock3 size={16} /> {Math.max(1, Math.ceil((quiz.questions?.length || 0) * .5))} min</p><div className="flex gap-2"><button onClick={() => startQuiz(quiz)} className={`${buttonPrimary} min-w-0 flex-1`}>Enter challenge <ChevronRight className="ml-1" size={18} /></button>{quiz.createdBy === user.uid && <><button onClick={() => editQuiz(quiz)} className={`${buttonSecondary} border-cyan-400/25 px-3 text-cyan-300 hover:bg-cyan-500/10`} title="Edit my quiz" aria-label={`Edit ${quiz.title}`}><Pencil size={17} /></button><button onClick={() => deleteQuiz(quiz)} className={`${buttonSecondary} border-rose-500/25 px-3 text-rose-400 hover:bg-rose-500/10`} title="Delete my quiz" aria-label={`Delete ${quiz.title}`}><Trash2 size={17} /></button></>}</div></div></article>)}</div>}</section>}

      {(activeTab === 'Overview' || activeTab === 'Explore Quizzes' || activeTab === 'My Quizzes') && <section className={`${panel} mt-8 rounded-2xl p-5`}><div className="mb-4 flex items-center justify-between"><h2 className="font-black">Recent runs</h2><button onClick={() => setActiveTab('Leaderboard')} className="text-xs font-bold text-violet-300 hover:text-violet-200">View leaderboard <ChevronRight className="ml-1 inline" size={14} /></button></div>{myResults.length === 0 ? <p className={`text-sm ${muted}`}>No results yet. Choose a quiz above and start your first run.</p> : <div className="space-y-3">{myResults.slice(0, 5).map((result) => <div key={result.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.025] p-3"><div><p className="font-semibold">{result.quizTitle}</p><p className={`text-xs ${muted}`}>{result.totalQuestions} questions</p></div><span className="rounded-xl bg-violet-500/15 px-3 py-2 font-black text-violet-300">{result.score}/{result.totalQuestions}</span></div>)}</div>}</section>}
      <footer className={`mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-xs ${muted}`}><Gamepad2 size={15} /> Quiz Arena <span>·</span> Learn, play, improve <span>·</span><span className="text-violet-300">GG, have fun!</span></footer>
    </main>

    {pendingGameRoom && <div className="fixed inset-0 z-[55] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><div className={`${panel} w-full max-w-md rounded-3xl p-6`}><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><Gamepad2 size={28} /></div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-violet-300">Game invitation</p><h2 className="mb-2 text-2xl font-black">Join {pendingGameRoom.quiz?.title || 'this quiz'}?</h2><p className={`mb-5 text-sm ${muted}`}>Invited by {pendingGameRoom.creatorName || 'a Quiz Arena player'}. There {pendingGameRoom.players?.length === 1 ? 'is' : 'are'} {pendingGameRoom.players?.length || 1} player{(pendingGameRoom.players?.length || 1) === 1 ? '' : 's'} in this room. Accept to join the waiting lobby. The host starts when everyone is ready.</p><div className="mb-5 flex flex-wrap gap-2">{(pendingGameRoom.players || []).map((player) => <span key={player.uid} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold">{player.name}{player.uid === pendingGameRoom.creatorId ? ' · Host' : ''}</span>)}</div><div className="flex flex-wrap justify-end gap-3"><button onClick={declineGameInvitation} disabled={joiningGame} className={buttonSecondary}>Decline</button><button onClick={acceptGameInvitation} disabled={joiningGame} className={buttonPrimary}>{joiningGame ? 'Joining...' : 'Accept & join game'} <ChevronRight className="ml-1" size={17} /></button></div></div></div>}

    {showCreate && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"><div className={`${panel} mx-auto my-4 max-w-4xl rounded-3xl p-5 sm:my-8 sm:p-7`}>
      <div className="mb-7 flex items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-300"><Sparkles size={14} /> Quiz Creator Studio</div><h2 className="text-3xl font-black">{editingQuiz ? 'Edit your challenge' : 'Build your challenge'}</h2><p className={`mt-2 text-sm ${muted}`}>Create your own questions and choose the answer format.</p></div><button type="button" onClick={closeQuizCreator} className={`rounded-xl p-2 ${muted} hover:bg-white/10`}><X size={22} /></button></div>
      <form onSubmit={createQuiz} className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-bold">Quiz title <span className="text-rose-400">*</span></label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ultimate IT Knowledge Challenge" maxLength={100} required className={`w-full rounded-xl border px-4 py-3 outline-none focus:border-cyan-400 ${field}`} /><p className={`mt-1.5 text-xs ${muted}`}>Required — give your quiz a title.</p></div><div className="sm:col-span-2"><label className="mb-2 block text-sm font-bold">Description <span className={`font-medium ${muted}`}>(Optional)</span></label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a short description about this quiz (optional)..." rows={2} maxLength={300} className={`w-full resize-y rounded-xl border px-4 py-3 outline-none focus:border-cyan-400 ${field}`} /><div className={`mt-1 flex justify-between gap-3 text-xs ${muted}`}><span>Tell players what this quiz is about.</span><span>{description.length}/300</span></div></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">Questions</h3><p className={`text-xs ${muted}`}>{newQuestions.length} question(s) added</p></div></div>
      {newQuestions.map((q, qi) => <div key={q.id || qi} className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.07] to-violet-500/[0.04] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 font-black text-white">{String(qi + 1).padStart(2, '0')}</span><div><h4 className="font-black">Question {qi + 1}</h4><p className={`text-xs ${muted}`}>Choose question format</p></div></div>{newQuestions.length > 1 && <button type="button" onClick={() => setNewQuestions((prev) => prev.filter((_, i) => i !== qi))} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 size={18} /></button>}</div>
      <textarea value={q.question} onChange={(e) => updateQuestion(qi, 'question', e.target.value)} placeholder="Type your question here..." rows={2} required className={`mb-4 w-full resize-y rounded-xl border px-4 py-3 outline-none focus:border-cyan-400 ${field}`} />
      <label className="mb-2 block text-sm font-bold">Question type</label><div className="mb-5 grid grid-cols-3 gap-2">{[{value:'multiple',label:'Multiple Choice'},{value:'boolean',label:'True / False'},{value:'identification',label:'Identification'}].map((item) => <button key={item.value} type="button" onClick={() => changeQuestionType(qi, item.value)} className={`rounded-xl border px-2 py-3 text-xs font-black transition sm:text-sm ${q.type === item.value ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300' : 'border-white/10 bg-white/[0.03] hover:border-cyan-400/50'}`}>{item.label}</button>)}</div>
      {q.type === 'identification' ? <div><label className="mb-2 block text-sm font-bold">Correct answer</label><input value={q.correctText} onChange={(e) => updateQuestion(qi, 'correctText', e.target.value)} placeholder="Enter the exact correct answer" required className={`w-full rounded-xl border px-4 py-3 outline-none focus:border-cyan-400 ${field}`} /><p className={`mt-2 text-xs ${muted}`}>Answers are checked without case sensitivity and ignore extra spaces.</p></div> : <><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{q.type === 'boolean' ? 'Select the correct answer' : 'Answer choices'}</p>{q.type === 'multiple' && <span className="text-xs text-cyan-300">A · B · C only — choose the correct answer</span>}</div><div className="space-y-3">{(q.type === 'multiple' ? q.options.slice(0, 3) : q.options).map((option, oi) => <div key={oi} className="grid grid-cols-[40px_minmax(0,1fr)] gap-2 sm:grid-cols-[40px_minmax(0,1fr)_190px]"><button type="button" onClick={() => updateQuestion(qi, 'correctAnswer', oi)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-black ${q.correctAnswer === oi ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-slate-400'}`} title="Mark as correct answer">{q.correctAnswer === oi ? <Check size={18} /> : String.fromCharCode(65 + oi)}</button><input value={option} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={q.type === 'boolean' ? option : `Enter choice ${String.fromCharCode(65 + oi)}`} readOnly={q.type === 'boolean'} required className={`min-w-0 w-full rounded-xl border px-3 py-3 outline-none focus:border-cyan-400 ${field} ${q.type === 'boolean' ? 'opacity-80' : ''}`} />{q.type === 'multiple' && <select value="" onChange={(e) => { const selected = e.target.value; if (selected) updateOption(qi, oi, selected) }} className={`col-start-2 w-full rounded-xl border px-3 py-2 text-xs outline-none focus:border-cyan-400 sm:col-start-auto ${field}`} aria-label={`Choose a previous choice for option ${String.fromCharCode(65 + oi)}`}><option value="">↳ Use a previous choice…</option>{getPreviousChoices(qi).map((choice) => <option key={choice} value={choice}>{choice}</option>)}</select>}</div>)}</div>
      </>}
      <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-3 text-xs text-emerald-300"><CheckCircle2 size={14} className="mr-1 inline" /> Correct answer: {q.type === 'identification' ? (q.correctText || 'Not entered') : (q.options[q.correctAnswer] || 'Not selected')}</div></div>)}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5"><button type="button" onClick={() => { rememberChoices(newQuestions.filter((item) => item.type === 'multiple').flatMap((item) => item.options || [])); setNewQuestions((prev) => [...prev, emptyQuestion()]) }} className={buttonPrimary}><Plus size={17} className="mr-1" /> Add Question</button><div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={closeQuizCreator} className={buttonSecondary}>Cancel</button><button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Saving quiz...' : <><Zap size={17} className="mr-2" /> {editingQuiz ? 'Save Changes' : 'Save Quiz'}</>}</button></div></div></form></div></div>}

    {notice && <div className="fixed bottom-5 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#211a35] px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-black/40"><Sparkles className="shrink-0 text-violet-300" size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={16} /></button></div>}
  </div>
}

// One persistent music player lives above every screen (Login, Register and Dashboard).
// The YouTube embed is kept mounted so authentication screen changes do not restart it.
function ArenaBackgroundMusic({ isQuizActive }) {
  const iframeRef = useRef(null)
  const quizActiveRef = useRef(isQuizActive)
  const playerReadyRef = useRef(false)
  const gestureReadyRef = useRef(false)

  const sendPlayerCommand = useCallback((command, args = []) => {
    const frame = iframeRef.current
    if (!playerReadyRef.current || !frame?.contentWindow) return
    try {
      frame.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: command,
        args,
      }), 'https://www.youtube-nocookie.com')
    } catch (error) {
      console.warn('Background music command unavailable:', error)
    }
  }, [])

  const syncMusicState = useCallback(() => {
    if (!playerReadyRef.current || !gestureReadyRef.current) return
    if (quizActiveRef.current) {
      sendPlayerCommand('pauseVideo')
    } else {
      sendPlayerCommand('setVolume', [65])
      sendPlayerCommand('playVideo')
    }
  }, [sendPlayerCommand])

  useEffect(() => {
    quizActiveRef.current = isQuizActive
    syncMusicState()
  }, [isQuizActive, syncMusicState])

  const handlePlayerLoad = useCallback(() => {
    playerReadyRef.current = true
    // Apply the state after the embedded player is ready; browsers still require
    // the first real user gesture before audible playback can begin.
    syncMusicState()
  }, [syncMusicState])

  useEffect(() => {
    const enableAfterFirstGesture = () => {
      gestureReadyRef.current = true
      syncMusicState()
      window.removeEventListener('pointerdown', enableAfterFirstGesture)
      window.removeEventListener('keydown', enableAfterFirstGesture)
    }
    window.addEventListener('pointerdown', enableAfterFirstGesture, { passive: true })
    window.addEventListener('keydown', enableAfterFirstGesture)
    return () => {
      window.removeEventListener('pointerdown', enableAfterFirstGesture)
      window.removeEventListener('keydown', enableAfterFirstGesture)
    }
  }, [syncMusicState])

  return (
    <iframe
      ref={iframeRef}
      onLoad={handlePlayerLoad}
      title="Quiz Arena background music"
      src="https://www.youtube-nocookie.com/embed/E7LVi1AA218?autoplay=1&controls=0&disablekb=1&fs=0&loop=1&playlist=E7LVi1AA218&playsinline=1&enablejsapi=1"
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none fixed -left-[10000px] -top-[10000px] h-[200px] w-[200px] border-0 opacity-0"
      allow="autoplay; encrypted-media"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

export default function App() {
  const [isQuizActive, setIsQuizActive] = useState(false)
  const updateQuizMode = useCallback((active) => setIsQuizActive(active), [])

  return (
    <>
      <ArenaBackgroundMusic isQuizActive={isQuizActive} />
      <AppContent onQuizModeChange={updateQuizMode} />
    </>
  )
}

