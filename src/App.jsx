import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import {
  Activity, ArrowLeft, Award, BookOpen, Check, CheckCheck, CheckCircle2,
  ChevronRight, CircleUserRound, Clock3, Copy, Crown, Gamepad2, Globe2,
  Home, LogOut, MessageCircle, Moon, Plus, Search, Send, ShieldCheck,
  Smile, Sparkles, Sun, Swords, Trophy, UserPlus, Users, X, RotateCcw,
  Zap, Link2, Mail, MessageSquare, Medal, Flame, Menu,
} from 'lucide-react'
import { auth, authPersistence, db } from './firebase'
import Auth from './Auth'

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
const emptyQuestion = () => ({ question: '', options: ['', '', '', ''], correctAnswer: 0 })
const emojis = ['😀','😂','🤣','😍','🥳','🔥','💜','💯','🎮','🏆','👏','😎','🤔','😭','👀','✨','🚀','💀','❤️','👍','🙏','🎯','🧠','⚡']
const friendRoomId = (a, b) => `friends_${[a, b].sort().join('_')}`
const displayName = (u) => u?.displayName || u?.email?.split('@')[0] || 'Quiz Player'
const initials = (name = 'QP') => name.split(/[ @._-]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'QP'
const timeLabel = (value) => {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [quizzes, setQuizzes] = useState(initialQuizzes)
  const [results, setResults] = useState([])
  const [activeTab, setActiveTab] = useState('Overview')
  const [search, setSearch] = useState('')
  const [darkMode, setDarkMode] = useState(true)
  const [notice, setNotice] = useState('')
  const [activeQuiz, setActiveQuiz] = useState(null)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [quizFinished, setQuizFinished] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [difficulty, setDifficulty] = useState('Easy')
  const [newQuestions, setNewQuestions] = useState([emptyQuestion()])
  const [messages, setMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [chatMode, setChatMode] = useState('general')
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([])
  const [people, setPeople] = useState([])
  const [inviteCode, setInviteCode] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const chatEndRef = useRef(null)
  const userName = displayName(user)

  useEffect(() => {
    let unsubscribe
    authPersistence.then(() => {
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser)
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
    if (!user) return
    setDoc(doc(db, 'profiles', user.uid), {
      displayName: userName,
      email: user.email || '',
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch((error) => console.error('Profile sync:', error))
  }, [user, userName])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function loadData() {
      try {
        const snapshot = await getDocs(collection(db, 'quizzes'))
        const saved = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        if (!cancelled && saved.length) setQuizzes([...saved, ...initialQuizzes.filter((starter) => !saved.some((q) => q.id === starter.id))])
      } catch (error) {
        console.error('Could not load quizzes:', error)
        if (!cancelled) setNotice('Could not load saved quizzes. Check Firestore rules.')
      }
      try {
        const resultSnapshot = await getDocs(query(collection(db, 'quiz_results'), orderBy('createdAt', 'desc'), limit(100)))
        if (!cancelled) setResults(resultSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
      } catch (error) { console.error('Could not load results:', error) }
    }
    loadData()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsubFriends = onSnapshot(query(collection(db, 'friendships'), where('memberIds', 'array-contains', user.uid)), async (snap) => {
      const list = await Promise.all(snap.docs.map(async (item) => {
        const data = item.data()
        const otherId = (data.memberIds || []).find((id) => id !== user.uid)
        let name = data.memberNames?.[otherId] || 'Quiz Player'
        try {
          const profile = await getDoc(doc(db, 'profiles', otherId))
          if (profile.exists()) name = profile.data().displayName || profile.data().name || name
        } catch {}
        return { id: item.id, otherId, name, ...data }
      }))
      setFriends(list)
    }, (error) => console.error('Friends listener:', error))
    const unsubRequests = onSnapshot(query(collection(db, 'friend_requests'), where('toUid', '==', user.uid), where('status', '==', 'pending')), (snap) => {
      setFriendRequests(snap.docs.map((item) => ({ id: item.id, ...item.data() })))
    }, (error) => console.error('Requests listener:', error))
    const unsubPeople = onSnapshot(query(collection(db, 'profiles'), limit(100)), (snap) => {
      setPeople(snap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((p) => p.id !== user.uid))
    }, (error) => console.error('Profiles listener:', error))
    return () => { unsubFriends(); unsubRequests(); unsubPeople() }
  }, [user])

  const roomId = useMemo(() => {
    if (chatMode === 'general') return 'general'
    return chatMode.startsWith('friends_') ? chatMode : ''
  }, [chatMode])

  useEffect(() => {
    if (!user || !roomId) return
    const q = query(collection(db, 'chat_messages'), where('roomId', '==', roomId), orderBy('createdAt', 'asc'), limit(150))
    return onSnapshot(q, (snap) => setMessages(snap.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => {
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
    const code = new URLSearchParams(window.location.search).get('invite')
    if (code) setInviteCode(code)
  }, [])

  const isDark = darkMode
  const page = isDark ? 'min-h-screen bg-[#090714] text-slate-100' : 'min-h-screen bg-slate-50 text-slate-900'
  const panel = isDark ? 'border border-white/[0.09] bg-[#141124]/90 shadow-[0_12px_45px_rgba(0,0,0,0.18)]' : 'border border-slate-200 bg-white shadow-sm'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const field = isDark ? 'border-white/10 bg-[#0d0a19] text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  const buttonPrimary = 'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-violet-950/30 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
  const buttonSecondary = `inline-flex items-center justify-center rounded-xl border px-4 py-2.5 font-semibold transition ${isDark ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]' : 'border-slate-300 bg-white hover:bg-slate-100'}`
  const myQuizzes = quizzes.filter((quiz) => quiz.createdBy && quiz.createdBy === user?.uid)
  const visibleQuizzes = quizzes.filter((quiz) => {
    const matches = quiz.title?.toLowerCase().includes(search.toLowerCase()) || quiz.category?.toLowerCase().includes(search.toLowerCase())
    return activeTab === 'My Quizzes' ? quiz.createdBy === user?.uid && matches : matches
  })
  const myResults = results.filter((result) => result.userId === user?.uid)
  const totalQuestionsAnswered = myResults.reduce((sum, result) => sum + (Number(result.totalQuestions) || 0), 0)
  const averageScore = myResults.length ? Math.round(myResults.reduce((sum, result) => sum + (result.totalQuestions ? (result.score / result.totalQuestions) * 100 : 0), 0) / myResults.length) : 0

  function startQuiz(quiz) {
    if (!Array.isArray(quiz.questions) || !quiz.questions.length) return setNotice('This quiz has no questions yet.')
    setActiveQuiz(quiz); setCurrentQuestion(0); setAnswers({}); setQuizFinished(false)
  }
  function closeQuiz() { setActiveQuiz(null); setQuizFinished(false); setAnswers({}); setCurrentQuestion(0) }
  async function finishQuiz(finalAnswers = answers) {
    const questions = activeQuiz.questions
    const score = questions.reduce((total, question, index) => total + (finalAnswers[index] === question.correctAnswer ? 1 : 0), 0)
    setQuizFinished(true)
    try {
      const result = { quizId: activeQuiz.id, quizTitle: activeQuiz.title, userId: user.uid, userName, score, totalQuestions: questions.length, createdAt: serverTimestamp() }
      const saved = await addDoc(collection(db, 'quiz_results'), result)
      setResults((previous) => [{ ...result, id: saved.id, createdAt: new Date() }, ...previous])
    } catch (error) { console.error(error); setNotice('Quiz finished, but the score could not be saved.') }
  }
  function chooseAnswer(index) {
    if (answers[currentQuestion] !== undefined) return
    setAnswers((previous) => ({ ...previous, [currentQuestion]: index }))
  }
  function updateQuestion(questionIndex, fieldName, value) {
    setNewQuestions((previous) => previous.map((q, index) => index === questionIndex ? { ...q, [fieldName]: value } : q))
  }
  function updateOption(questionIndex, optionIndex, value) {
    setNewQuestions((previous) => previous.map((q, index) => {
      if (index !== questionIndex) return q
      const options = [...q.options]; options[optionIndex] = value
      return { ...q, options }
    }))
  }
  async function createQuiz(event) {
    event.preventDefault()
    if (!title.trim()) return setNotice('Please enter a quiz title.')
    if (!newQuestions.every((q) => q.question.trim() && q.options.every((o) => o.trim()))) return setNotice('Complete every question and all four choices.')
    setSaving(true)
    const quizData = { title: title.trim(), category, difficulty, questions: newQuestions.map((q) => ({ question: q.question.trim(), options: q.options.map((o) => o.trim()), correctAnswer: Number(q.correctAnswer) })), createdBy: user.uid, creatorName: userName, createdAt: serverTimestamp() }
    try {
      const saved = await addDoc(collection(db, 'quizzes'), quizData)
      setQuizzes((previous) => [{ ...quizData, id: saved.id, createdAt: new Date() }, ...previous])
      setTitle(''); setCategory(categories[0]); setDifficulty('Easy'); setNewQuestions([emptyQuestion()]); setShowCreate(false); setActiveTab('My Quizzes'); setNotice('Quiz created and saved!')
    } catch (error) { console.error(error); setNotice('Could not save quiz. Check Firestore rules.') }
    finally { setSaving(false) }
  }

  async function sendMessage(event) {
    event?.preventDefault()
    const text = chatText.trim()
    if (!text || !roomId || !user) return
    if (chatMode !== 'general' && !friends.some((f) => friendRoomId(user.uid, f.otherId) === roomId)) {
      setNotice('Friends-only chat requires an accepted friendship.')
      return
    }
    setChatText('')
    setShowEmoji(false)
    try {
      await addDoc(collection(db, 'chat_messages'), { roomId, text, senderId: user.uid, senderName: userName, memberIds: chatMode === 'general' ? [] : [user.uid, selectedFriend?.otherId].filter(Boolean), createdAt: serverTimestamp() })
    } catch (error) { console.error(error); setChatText(text); setNotice('Message not sent. Check Firestore rules.') }
  }

  async function createInvite() {
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
    if (!inviteCode || !user) return
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
      setActiveTab('Chat')
      setNotice(`You're now friends with ${invitation.creatorName || 'this player'}!`)
      const url = new URL(window.location.href); url.searchParams.delete('invite'); window.history.replaceState({}, '', url)
      setInviteCode('')
    } catch (error) { console.error(error); setNotice('Could not accept invite. Check Firestore rules.') }
  }

  async function sendFriendRequest(person) {
    if (!person?.id || person.id === user.uid) return
    try {
      const existing = await getDocs(query(collection(db, 'friend_requests'), where('fromUid', '==', user.uid), where('toUid', '==', person.id), where('status', '==', 'pending'), limit(1)))
      if (!existing.empty) return setNotice('Friend request already sent.')
      await addDoc(collection(db, 'friend_requests'), { fromUid: user.uid, fromName: userName, toUid: person.id, toName: person.displayName || person.name || 'Quiz Player', status: 'pending', createdAt: serverTimestamp() })
      setNotice('Friend request sent!')
    } catch (error) { console.error(error); setNotice('Could not send friend request. Check Firestore rules.') }
  }

  async function acceptFriendRequest(request) {
    try {
      const memberIds = [request.fromUid, user.uid].sort()
      await setDoc(doc(db, 'friendships', `friends_${memberIds.join('_')}`), { memberIds, memberNames: { [request.fromUid]: request.fromName || 'Quiz Player', [user.uid]: userName }, requestId: request.id, createdAt: serverTimestamp() })
      await updateDoc(doc(db, 'friend_requests', request.id), { status: 'accepted' })
      setNotice(`You're now friends with ${request.fromName}!`)
    } catch (error) { console.error(error); setNotice('Could not accept request. Check Firestore rules.') }
  }

  async function handleLogout() {
    try { await signOut(auth); setUser(null); closeQuiz() }
    catch (error) { console.error(error); setNotice('Unable to sign out. Please try again.') }
  }

  const navItems = [
    { label: 'Overview', icon: Home }, { label: 'Explore Quizzes', icon: Search },
    { label: 'My Quizzes', icon: BookOpen }, { label: 'Leaderboard', icon: Trophy },
    { label: 'Chat', icon: MessageCircle }, { label: 'Friends', icon: Users }, { label: 'Invite Friends', icon: UserPlus },
  ]

  if (!authReady) return <div className={`${page} grid min-h-screen place-items-center`}><div className="text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-violet-600/20 text-violet-300"><Activity className="animate-pulse" size={34} /></div><p className={muted}>Entering the Arena...</p></div></div>
  if (!user) return <Auth onLogin={setUser} />

  if (activeQuiz) {
    const questions = activeQuiz.questions || []
    const question = questions[currentQuestion]
    const score = questions.reduce((total, item, index) => total + (answers[index] === item.correctAnswer ? 1 : 0), 0)
    return <div className={`${page} min-h-screen px-4 py-8 sm:px-6`}><div className="mx-auto max-w-3xl">
      <button onClick={closeQuiz} className={`mb-6 inline-flex items-center gap-2 ${muted} hover:text-violet-400`}><ArrowLeft size={18} /> Back to arena</button>
      <div className={`${panel} rounded-3xl p-5 sm:p-8`}>
        {!quizFinished ? <>
          <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-violet-400"><Zap size={15} /> {activeQuiz.category}</p><h1 className="text-2xl font-black sm:text-3xl">{activeQuiz.title}</h1></div><span className="rounded-xl bg-violet-500/15 px-3 py-2 text-sm font-bold text-violet-300">{currentQuestion + 1}/{questions.length}</span></div>
          <div className="mb-8 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} /></div>
          <h2 className="mb-6 text-xl font-bold leading-relaxed">{question.question}</h2>
          <div className="grid gap-3">{question.options.map((option, index) => {
            const selected = answers[currentQuestion] === index
            const answered = answers[currentQuestion] !== undefined
            const correct = question.correctAnswer === index
            const wrongSelected = answered && selected && !correct
            const style = answered && correct ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : wrongSelected ? 'border-rose-400 bg-rose-500/15 text-rose-300' : isDark ? 'border-white/10 hover:border-violet-400 hover:bg-violet-500/10' : 'border-slate-200 hover:border-violet-400'
            return <button key={index} onClick={() => chooseAnswer(index)} disabled={answered} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${style} ${answered ? 'cursor-default' : 'hover:-translate-y-0.5'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 font-black text-violet-300">{String.fromCharCode(65 + index)}</span><span className="flex-1 font-semibold">{option}</span>{answered && correct && <CheckCircle2 className="text-emerald-300" size={22} />}{wrongSelected && <X className="text-rose-300" size={22} />}</button>
          })}</div>
          {answers[currentQuestion] !== undefined && <div className={`mt-4 rounded-2xl border p-4 ${answers[currentQuestion] === question.correctAnswer ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-rose-400/30 bg-rose-500/10'}`}><p className={`font-bold ${answers[currentQuestion] === question.correctAnswer ? 'text-emerald-300' : 'text-rose-300'}`}>{answers[currentQuestion] === question.correctAnswer ? 'Correct answer! 🎉' : 'Not quite — keep going! 💪'}</p>{answers[currentQuestion] !== question.correctAnswer && <p className={`mt-1 text-sm ${muted}`}>Correct answer: <span className="font-bold text-emerald-300">{question.options[question.correctAnswer]}</span></p>}</div>}
          <div className="mt-8 flex items-center justify-between gap-3"><button className={buttonSecondary} disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((n) => n - 1)}>Previous</button>{currentQuestion < questions.length - 1 ? <button className={buttonPrimary} onClick={() => setCurrentQuestion((n) => n + 1)}>Next question <ChevronRight className="ml-1" size={18} /></button> : <button className={buttonPrimary} onClick={() => finishQuiz()}>Submit answers <Trophy className="ml-2" size={18} /></button>}</div>
        </> : <div className="py-8 text-center"><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 text-violet-300"><Trophy size={42} /></div><p className={`mb-2 ${muted}`}>MISSION COMPLETE</p><h1 className="mb-3 text-3xl font-black">Your Results</h1><p className="mb-2 text-6xl font-black text-violet-300">{score}<span className="text-3xl text-slate-500">/{questions.length}</span></p><p className={`mb-8 ${muted}`}>You scored {Math.round(score / questions.length * 100)}%.</p><div className="mb-8 space-y-3 text-left">{questions.map((item, index) => { const correct = answers[index] === item.correctAnswer; return <div key={index} className={`rounded-xl border p-4 ${correct ? 'border-emerald-500/30' : 'border-rose-500/30'}`}><p className="mb-2 font-semibold">{index + 1}. {item.question}</p><p className={correct ? 'text-emerald-300' : 'text-rose-300'}>Your answer: {answers[index] === undefined ? 'Not answered' : item.options[answers[index]]}</p>{!correct && <p className="mt-1 text-sm text-emerald-300">Correct answer: {item.options[item.correctAnswer]}</p>}</div>})}</div><div className="flex flex-wrap justify-center gap-3"><button className={buttonSecondary} onClick={closeQuiz}><ArrowLeft className="mr-2" size={17} /> Dashboard</button><button className={buttonPrimary} onClick={() => startQuiz(activeQuiz)}><RotateCcw className="mr-2" size={17} /> Play again</button></div></div>}
      </div></div></div>
  }

  const filteredPeople = people.filter((p) => (p.displayName || p.name || '').toLowerCase().includes(friendSearch.toLowerCase()) || p.email?.toLowerCase().includes(friendSearch.toLowerCase()))
  const selectedFriend = chatMode.startsWith('friends_') ? friends.find((f) => friendRoomId(user.uid, f.otherId) === chatMode) : null

  return <div className={`${page} min-h-screen`}>
    <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-700/10 blur-3xl" /><div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-fuchsia-700/[0.07] blur-3xl" /></div>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r p-5 backdrop-blur-xl lg:flex ${isDark ? 'border-white/[0.08] bg-[#100c1e]/95' : 'border-slate-200 bg-white/95'}`}>
      <div className="mb-9 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-950/50"><Gamepad2 size={26} /></div><div><h1 className="text-lg font-black tracking-tight">QUIZ <span className="text-violet-400">ARENA</span></h1><p className={`text-[11px] uppercase tracking-[0.22em] ${muted}`}>Learn · Play · Win</p></div></div>
      <p className={`mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] ${muted}`}>Main menu</p>
      <nav className="space-y-1.5">{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveTab(label); setMobileNav(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${activeTab === label ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-950/30' : isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={18} />{label}{label === 'Chat' && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />}</button>)}</nav>
      <div className="mt-auto"><div className={`mb-3 flex items-center gap-3 rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200'}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/20 font-black text-violet-300">{initials(userName)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{userName}</p><p className={`truncate text-[11px] ${muted}`}>{user.isAnonymous ? 'Guest player' : user.email}</p></div><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><button onClick={() => setDarkMode((v) => !v)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${muted} hover:bg-white/[0.05]`}>{isDark ? <Sun size={18} /> : <Moon size={18} />}{isDark ? 'Light mode' : 'Dark mode'}</button><button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-rose-400 hover:bg-rose-500/10"><LogOut size={18} /> Sign out</button></div>
    </aside>

    {mobileNav && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)}><div className={`h-full w-72 p-5 ${isDark ? 'bg-[#100c1e]' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}><div className="mb-6 flex items-center justify-between"><span className="font-black">QUIZ <span className="text-violet-400">ARENA</span></span><button onClick={() => setMobileNav(false)}><X /></button></div>{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveTab(label); setMobileNav(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activeTab === label ? 'bg-violet-600 text-white' : ''}`}><Icon size={18} />{label}</button>)}</div></div>}

    <main className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:ml-64 lg:px-9 lg:py-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><button className={`${buttonSecondary} p-2.5 lg:hidden`} onClick={() => setMobileNav(true)}><Menu size={20} /></button><div><p className={`mb-1 text-xs font-bold uppercase tracking-[0.18em] ${muted}`}>Player dashboard</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{activeTab === 'Overview' ? `Welcome back, ${userName}!` : activeTab}</h1></div></div><div className="flex flex-wrap gap-2"><span className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold sm:inline-flex ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}><span className="h-2 w-2 rounded-full bg-emerald-400" /> Arena online</span><button onClick={() => setDarkMode((v) => !v)} className={`${buttonSecondary} p-2.5`} title="Toggle theme">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button><button onClick={() => { setShowCreate(true); setNewQuestions([emptyQuestion()]) }} className={buttonPrimary}><Plus size={18} className="mr-1" /> Create Quiz</button></div></header>

      {activeTab === 'Overview' && <><section className="relative mb-7 overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-[#32136c] via-[#4c1d95] to-[#86198f] p-6 shadow-2xl shadow-violet-950/30 sm:p-9"><div className="pointer-events-none absolute -right-10 -top-12 h-64 w-64 rounded-full border-[30px] border-white/[0.05]" /><div className="pointer-events-none absolute right-16 top-10 hidden rotate-12 text-white/[0.08] sm:block"><Gamepad2 size={180} /></div><div className="relative max-w-2xl"><span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"><Sparkles size={15} /> Level up your brain</span><h2 className="mb-3 text-3xl font-black leading-tight sm:text-5xl">Think fast.<br /><span className="text-fuchsia-200">Play legendary.</span></h2><p className="mb-6 max-w-lg text-sm leading-6 text-violet-100 sm:text-base">Challenge your knowledge, climb the leaderboard, and invite your squad into the Arena.</p><div className="flex flex-wrap gap-3"><button onClick={() => setActiveTab('Explore Quizzes')} className="rounded-xl bg-white px-5 py-3 font-black text-violet-800 transition hover:-translate-y-0.5 hover:bg-violet-50">Start a challenge <ChevronRight className="ml-1 inline" size={18} /></button><button onClick={() => setActiveTab('Invite Friends')} className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/15"><Users className="mr-2 inline" size={17} /> Invite squad</button></div></div></section>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Available Quizzes', value: quizzes.length, icon: BookOpen, color: 'text-violet-300', bg: 'bg-violet-500/15' }, { label: 'My Quizzes', value: myQuizzes.length, icon: Plus, color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15' }, { label: 'Quizzes Completed', value: myResults.length, icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/15' }, { label: 'Average Score', value: `${averageScore}%`, icon: Trophy, color: 'text-amber-300', bg: 'bg-amber-500/15' }].map(({ label, value, icon: Icon, color, bg }) => <div key={label} className={`${panel} rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-violet-400/30`}><div className="mb-4 flex items-center justify-between"><span className={`text-sm ${muted}`}>{label}</span><span className={`rounded-xl p-2.5 ${bg} ${color}`}><Icon size={20} /></span></div><p className="text-3xl font-black tracking-tight">{value}</p><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" /></div></div>)}</section></>}

      {activeTab === 'Leaderboard' && <section><div className={`${panel} mb-5 rounded-2xl p-5`}><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-300"><Crown size={26} /></div><div><h2 className="text-xl font-black">Hall of Fame</h2><p className={`text-sm ${muted}`}>Recent scores from Arena players.</p></div></div></div><div className={`${panel} overflow-hidden rounded-2xl`}>{results.length === 0 ? <p className={`p-8 text-center ${muted}`}>No scores yet. Complete a quiz to appear here.</p> : <div className="divide-y divide-white/[0.06]">{[...results].sort((a,b) => (b.totalQuestions ? b.score / b.totalQuestions : 0) - (a.totalQuestions ? a.score / a.totalQuestions : 0)).map((result, index) => <div key={result.id} className="flex flex-wrap items-center gap-4 p-4"><span className={`grid h-10 w-10 place-items-center rounded-xl font-black ${index === 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-violet-500/15 text-violet-300'}`}>{index === 0 ? <Medal size={21} /> : index + 1}</span><div className="min-w-0 flex-1"><p className="font-bold">{result.userName || 'Player'}</p><p className={`truncate text-sm ${muted}`}>{result.quizTitle}</p></div><p className="font-black text-violet-300">{result.score}/{result.totalQuestions}</p></div>)}</div>}</div></section>}

      {activeTab === 'Chat' && <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"><div className={`${panel} rounded-2xl p-4`}><h2 className="mb-3 flex items-center gap-2 font-black"><MessageCircle size={18} className="text-violet-300" /> Channels</h2><button onClick={() => setChatMode('general')} className={`mb-2 flex w-full items-center gap-3 rounded-xl p-3 text-left ${chatMode === 'general' ? 'bg-violet-600 text-white' : 'hover:bg-white/[0.05]'}`}><Globe2 size={19} /><span className="flex-1"><span className="block font-bold">General chat</span><span className={`text-xs ${chatMode === 'general' ? 'text-violet-100' : muted}`}>Everyone in the Arena</span></span></button><p className={`mb-2 mt-5 px-2 text-[10px] font-black uppercase tracking-[0.2em] ${muted}`}>Your squad</p>{friends.length === 0 ? <p className={`px-2 py-3 text-sm ${muted}`}>Add friends to unlock private chats.</p> : friends.map((friend) => { const id = friendRoomId(user.uid, friend.otherId); return <button key={friend.id} onClick={() => setChatMode(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${chatMode === id ? 'bg-violet-600 text-white' : 'hover:bg-white/[0.05]'}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-fuchsia-500/15 text-xs font-black text-fuchsia-300">{initials(friend.name)}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{friend.name}</span><span className="h-2 w-2 rounded-full bg-emerald-400" /></button>})}<button onClick={() => setActiveTab('Friends')} className={`${buttonSecondary} mt-4 w-full text-sm`}><UserPlus className="mr-2" size={16} /> Find friends</button></div>
        <div className={`${panel} flex min-h-[580px] flex-col overflow-hidden rounded-2xl`}><div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600">{chatMode === 'general' ? <Globe2 size={21} /> : <Users size={21} />}</div><div className="min-w-0 flex-1"><h2 className="font-black">{chatMode === 'general' ? 'General Arena Chat' : selectedFriend?.name || 'Friends-only chat'}</h2><p className={`text-xs ${muted}`}>{chatMode === 'general' ? 'Be kind. Keep it fun.' : 'Private conversation between friends'}</p></div><span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live</span></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{messages.length === 0 ? <div className="grid h-full min-h-64 place-items-center text-center"><div><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><MessageSquare size={25} /></div><p className="font-bold">No messages yet</p><p className={`mt-1 text-sm ${muted}`}>Break the ice. Send the first message! ✨</p></div></div> : messages.map((message) => { const mine = message.senderId === user.uid; return <div key={message.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>{!mine && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-[10px] font-black text-violet-300">{initials(message.senderName)}</div>}<div className={`max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}><div className={`mb-1 flex items-center gap-2 text-[10px] ${muted}`}><span>{mine ? 'You' : message.senderName || 'Player'}</span><span>{timeLabel(message.createdAt)}</span></div><div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${mine ? 'rounded-br-md bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white' : isDark ? 'rounded-bl-md bg-white/[0.07]' : 'rounded-bl-md bg-slate-100'}`}>{message.text}</div></div>{mine && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-fuchsia-500/20 text-[10px] font-black text-fuchsia-300">{initials(userName)}</div>}</div>})}<div ref={chatEndRef} /></div>
        {showEmoji && <div className="mx-4 mb-2 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0d0a19] p-3">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => setChatText((v) => v + emoji)} className="rounded-lg p-1.5 text-xl hover:bg-white/10">{emoji}</button>)}</div>}
        <form onSubmit={sendMessage} className="border-t border-white/[0.07] p-3 sm:p-4"><div className={`flex items-center gap-2 rounded-2xl border p-2 ${isDark ? 'border-white/10 bg-[#0d0a19]' : 'border-slate-200 bg-slate-50'}`}><button type="button" onClick={() => setShowEmoji((v) => !v)} className={`rounded-xl p-2 ${showEmoji ? 'bg-violet-500/20 text-violet-300' : muted}`} title="Emoji picker"><Smile size={21} /></button><input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Send a message to the squad..." maxLength={1000} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" /><button type="submit" disabled={!chatText.trim()} className={`${buttonPrimary} p-2.5`} aria-label="Send message"><Send size={18} /></button></div><p className={`mt-2 px-2 text-[10px] ${muted}`}>Messages are saved in Firebase. Keep it friendly. 💜</p></form></div></section>}

      {activeTab === 'Friends' && <section className="grid gap-5 xl:grid-cols-2"><div className={`${panel} rounded-2xl p-5`}><div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Users size={22} /></div><div><h2 className="font-black">Your squad</h2><p className={`text-sm ${muted}`}>{friends.length} friend{friends.length === 1 ? '' : 's'} connected</p></div></div>{friends.length === 0 ? <p className={`rounded-xl border border-dashed border-white/10 p-6 text-center text-sm ${muted}`}>No friends yet. Send an invite or connect with a player.</p> : <div className="space-y-2">{friends.map((f) => <div key={f.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 font-black text-violet-200">{initials(f.name)}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{f.name}</p><p className={`text-xs ${muted}`}>Arena friend</p></div><button onClick={() => { setChatMode(friendRoomId(user.uid, f.otherId)); setActiveTab('Chat') }} className={buttonSecondary}><MessageCircle className="mr-2" size={16} /> Chat</button></div>)}</div>}
        <div className="mt-6 border-t border-white/[0.07] pt-5"><h3 className="mb-3 font-bold">Friend requests <span className="ml-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300">{friendRequests.length}</span></h3>{friendRequests.length === 0 ? <p className={`text-sm ${muted}`}>You're all caught up.</p> : <div className="space-y-2">{friendRequests.map((r) => <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{r.fromName || 'Player'}</p><p className={`text-xs ${muted}`}>wants to connect</p></div><button onClick={() => acceptFriendRequest(r)} className={`${buttonPrimary} px-3 py-2`}><Check size={16} className="mr-1" /> Accept</button></div>)}</div>}</div></div>
        <div className={`${panel} rounded-2xl p-5`}><div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300"><Search size={21} /></div><div><h2 className="font-black">Find players</h2><p className={`text-sm ${muted}`}>Grow your Arena squad.</p></div></div><div className="relative mb-4"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={17} /><input value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} placeholder="Search players..." className={`w-full rounded-xl border py-3 pl-10 pr-3 outline-none focus:border-violet-500 ${field}`} /></div><div className="space-y-2">{filteredPeople.slice(0, 12).map((p) => { const alreadyFriend = friends.some((f) => f.otherId === p.id); return <div key={p.id} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-white/[0.03]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 font-black text-violet-300">{initials(p.displayName || p.name)}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{p.displayName || p.name || 'Quiz Player'}</p><p className={`truncate text-xs ${muted}`}>{p.email || 'Quiz Arena player'}</p></div>{alreadyFriend ? <span className="text-xs font-semibold text-emerald-300"><Check size={15} className="mr-1 inline" /> Friend</span> : <button onClick={() => sendFriendRequest(p)} className={`${buttonSecondary} px-3 py-2 text-xs`}><UserPlus size={15} className="mr-1" /> Add</button>}</div>})}{filteredPeople.length === 0 && <p className={`py-6 text-center text-sm ${muted}`}>No player profiles found yet.</p>}</div><p className={`mt-4 text-xs ${muted}`}>Players appear here after their profile is created in Firestore.</p></div></section>}

      {activeTab === 'Invite Friends' && <section className="mx-auto max-w-3xl"><div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-800 p-6 sm:p-9"><div className="absolute -right-8 -top-8 text-white/[0.08]"><Users size={190} /></div><div className="relative"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><UserPlus size={29} /></div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-violet-200">Build your squad</p><h2 className="mb-3 text-3xl font-black sm:text-4xl">The Arena is better together.</h2><p className="mb-7 max-w-xl text-sm leading-6 text-violet-100">Create a personal invitation link. Send it through Messenger, Facebook, or any app. When your friend opens the link and accepts, you can chat privately.</p><button onClick={createInvite} disabled={inviteBusy} className="rounded-xl bg-white px-5 py-3 font-black text-violet-800 transition hover:-translate-y-0.5 disabled:opacity-60">{inviteBusy ? 'Creating link...' : <><Link2 className="mr-2 inline" size={18} /> Create & copy invite link</>}</button></div></div>
        {inviteLink && <div className={`${panel} mt-5 rounded-2xl p-5`}><h3 className="mb-2 font-black">Your invitation link</h3><p className={`mb-3 text-sm ${muted}`}>Anyone with this link can request to connect with you. Only share it with people you trust.</p><div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={inviteLink} className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm ${field}`} /><button onClick={() => { navigator.clipboard?.writeText(inviteLink).then(() => setNotice('Invite link copied!')).catch(() => setNotice('Select and copy the link manually.')) }} className={buttonPrimary}><Copy className="mr-2" size={17} /> Copy</button></div><button onClick={() => { const url = `https://www.facebook.com/messages/`; window.open(url, '_blank', 'noopener,noreferrer') }} className={`${buttonSecondary} mt-3`}><Mail className="mr-2" size={17} /> Open Messenger</button></div>}
        {inviteCode && !inviteLink && <div className={`${panel} mt-5 rounded-2xl p-5`}><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><ShieldCheck size={23} /></div><div className="flex-1"><h3 className="font-black">You've been invited to the Arena!</h3><p className={`my-2 text-sm ${muted}`}>Accept this invitation to connect and unlock a private friends chat.</p><button onClick={acceptInvite} className={buttonPrimary}>Accept invitation <ChevronRight className="ml-1" size={17} /></button></div></div></div>}
        <div className={`${panel} mt-5 rounded-2xl p-5`}><h3 className="mb-3 font-black">How it works</h3><div className="grid gap-4 sm:grid-cols-3">{[{ n:'01', title:'Create a link', desc:'Generate a unique invitation.' },{ n:'02', title:'Share it', desc:'Send the link to your friend.' },{ n:'03', title:'Connect & chat', desc:'Accept to unlock private chat.' }].map((item) => <div key={item.n} className="rounded-xl bg-white/[0.03] p-4"><p className="mb-2 text-xs font-black text-violet-300">{item.n}</p><p className="mb-1 font-bold">{item.title}</p><p className={`text-sm ${muted}`}>{item.desc}</p></div>)}</div></div></section>}

      {(activeTab === 'Overview' || activeTab === 'Explore Quizzes' || activeTab === 'My Quizzes') && <section><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">{activeTab === 'My Quizzes' ? 'Your creations' : activeTab === 'Explore Quizzes' ? 'Explore challenges' : 'Popular challenges'}</h2><p className={`mt-1 text-sm ${muted}`}>Pick a challenge and prove your skills.</p></div><div className="relative w-full sm:w-72"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quizzes..." className={`w-full rounded-xl border py-3 pl-10 pr-4 outline-none focus:border-violet-500 ${field}`} /></div></div>
        {visibleQuizzes.length === 0 ? <div className={`${panel} rounded-2xl p-10 text-center`}><BookOpen className={`mx-auto mb-3 ${muted}`} size={36} /><h3 className="mb-2 text-lg font-black">No quizzes found</h3><p className={`mb-5 text-sm ${muted}`}>Try another search or create a challenge.</p><button className={buttonPrimary} onClick={() => setShowCreate(true)}><Plus className="mr-1" size={18} /> Create Quiz</button></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleQuizzes.map((quiz, index) => <article key={quiz.id} className={`${panel} group overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:border-violet-400/40`}><div className={`relative flex h-32 items-center justify-center overflow-hidden ${index % 3 === 0 ? 'bg-gradient-to-br from-violet-700 to-indigo-600' : index % 3 === 1 ? 'bg-gradient-to-br from-fuchsia-700 to-violet-600' : 'bg-gradient-to-br from-indigo-700 to-blue-600'}`}><div className="absolute -right-3 -top-7 rotate-12 text-white/10 transition group-hover:scale-110"><Gamepad2 size={120} /></div><BookOpen size={43} className="relative text-white drop-shadow-lg transition group-hover:scale-110" /><span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">{quiz.difficulty || 'Custom'}</span></div><div className="p-5"><span className="mb-3 inline-flex rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">{quiz.category || 'General'}</span><h3 className="mb-2 text-lg font-black">{quiz.title}</h3><p className={`mb-5 flex items-center gap-2 text-sm ${muted}`}><BookOpen size={16} /> {quiz.questions?.length || 0} questions <span>·</span><Clock3 size={16} /> {Math.max(1, Math.ceil((quiz.questions?.length || 0) * .5))} min</p><button onClick={() => startQuiz(quiz)} className={`${buttonPrimary} w-full`}>Enter challenge <ChevronRight className="ml-1" size={18} /></button></div></article>)}</div>}</section>}

      {(activeTab === 'Overview' || activeTab === 'Explore Quizzes' || activeTab === 'My Quizzes') && <section className={`${panel} mt-8 rounded-2xl p-5`}><div className="mb-4 flex items-center justify-between"><h2 className="font-black">Recent runs</h2><button onClick={() => setActiveTab('Leaderboard')} className="text-xs font-bold text-violet-300 hover:text-violet-200">View leaderboard <ChevronRight className="ml-1 inline" size={14} /></button></div>{myResults.length === 0 ? <p className={`text-sm ${muted}`}>No results yet. Choose a quiz above and start your first run.</p> : <div className="space-y-3">{myResults.slice(0, 5).map((result) => <div key={result.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.025] p-3"><div><p className="font-semibold">{result.quizTitle}</p><p className={`text-xs ${muted}`}>{result.totalQuestions} questions</p></div><span className="rounded-xl bg-violet-500/15 px-3 py-2 font-black text-violet-300">{result.score}/{result.totalQuestions}</span></div>)}</div>}</section>}
      <footer className={`mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-xs ${muted}`}><Gamepad2 size={15} /> Quiz Arena <span>·</span> Learn, play, improve <span>·</span><span className="text-violet-300">GG, have fun!</span></footer>
    </main>

    {showCreate && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"><div className={`${panel} mx-auto my-4 max-w-3xl rounded-3xl p-5 sm:my-8 sm:p-7`}><div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-violet-300">Build your challenge</p><h2 className="text-2xl font-black">Create a Quiz</h2><p className={`mt-1 text-sm ${muted}`}>Write questions, add four choices, pick the correct answer.</p></div><button onClick={() => setShowCreate(false)} className={`rounded-xl p-2 ${muted} hover:bg-white/10`} aria-label="Close"><X size={22} /></button></div>
      <form onSubmit={createQuiz} className="space-y-5"><div><label className="mb-2 block text-sm font-bold">Quiz title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ultimate Tech Challenge" maxLength={100} className={`w-full rounded-xl border px-4 py-3 outline-none focus:border-violet-500 ${field}`} required /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-bold">Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full rounded-xl border px-4 py-3 outline-none ${field}`}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="mb-2 block text-sm font-bold">Difficulty</label><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`w-full rounded-xl border px-4 py-3 outline-none ${field}`}>{['Easy','Medium','Hard'].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      {newQuestions.map((q, qi) => <div key={qi} className="rounded-2xl border border-white/10 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-black">Question {qi + 1}</h3>{newQuestions.length > 1 && <button type="button" onClick={() => setNewQuestions((prev) => prev.filter((_, i) => i !== qi))} className="text-sm font-semibold text-rose-400">Remove</button>}</div><textarea value={q.question} onChange={(e) => updateQuestion(qi, 'question', e.target.value)} placeholder="Type your question..." rows={2} className={`mb-4 w-full resize-y rounded-xl border px-4 py-3 outline-none focus:border-violet-500 ${field}`} required /><p className={`mb-3 text-xs ${muted}`}>Select the radio button beside the correct choice.</p><div className="space-y-3">{q.options.map((option, oi) => <div key={oi} className="flex items-center gap-3"><input type="radio" name={`correct-${qi}`} checked={q.correctAnswer === oi} onChange={() => updateQuestion(qi, 'correctAnswer', oi)} className="h-4 w-4 accent-violet-600" aria-label={`Mark choice ${oi + 1} correct`} /><input value={option} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={`Choice ${String.fromCharCode(65 + oi)}`} className={`min-w-0 flex-1 rounded-xl border px-3 py-3 outline-none focus:border-violet-500 ${field}`} required /></div>)}</div></div>)}
      <button type="button" onClick={() => setNewQuestions((prev) => [...prev, emptyQuestion()])} className={`${buttonSecondary} w-full`}><Plus className="mr-1" size={18} /> Add another question</button><div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5"><button type="button" onClick={() => setShowCreate(false)} className={buttonSecondary}>Cancel</button><button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Saving...' : <><Zap className="mr-2" size={17} /> Save Quiz</>}</button></div></form></div></div>}

    {notice && <div className="fixed bottom-5 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#211a35] px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-black/40"><Sparkles className="shrink-0 text-violet-300" size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={16} /></button></div>}
  </div>
}
