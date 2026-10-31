import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import {
  Activity, ArrowLeft, Award, BookOpen, Check, CheckCheck, CheckCircle2,
  ChevronRight, CircleUserRound, Clock3, Copy, Crown, Gamepad2, Globe2,
  Home, LogOut, MessageCircle, Moon, Plus, Search, Send, ShieldCheck,
  Smile, Sparkles, Sun, Swords, Trophy, UserPlus, Users, X, RotateCcw,
  Zap, Link2, Mail, MessageSquare, Medal, Flame, Menu, Trash2,
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
const emptyQuestion = () => ({ id: crypto.randomUUID(), type: 'multiple', question: '', options: ['', '', '', ''], correctAnswer: 0, correctText: '' })
const emojis = ['😀','😂','🤣','😍','🥳','🔥','💜','💯','🎮','🏆','👏','😎','🤔','😭','👀','✨','🚀','💀','❤️','👍','🙏','🎯','🧠','⚡']
const friendRoomId = (a, b) => `friends_${[a, b].sort().join('_')}`
const displayName = (u) => u?.displayName || u?.email?.split('@')[0] || 'Quiz Player'
const initials = (name = 'QP') => name.split(/[ @._-]/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'QP'
const timeLabel = (value) => {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'
}
const normalizeAnswer = (value) => String(value ?? '').trim().toLocaleLowerCase()
const isCorrectAnswer = (question, answer) => question.type === 'identification'
  ? normalizeAnswer(answer) === normalizeAnswer(question.correctText)
  : answer === question.correctAnswer
const answerLabel = (question, answer) => answer === undefined || answer === null || answer === ''
  ? 'Not answered'
  : question.type === 'identification' ? String(answer) : (question.options || [])[answer] || 'Not answered'

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
  const [savedChoices, setSavedChoices] = useState(() => {
    try { return JSON.parse(localStorage.getItem('quiz-arena-choice-library') || '[]') }
    catch { return [] }
  })
  const [choiceSearch, setChoiceSearch] = useState('')
  const [identificationDraft, setIdentificationDraft] = useState('')
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
  const [gameRoomId, setGameRoomId] = useState('')
  const [gameRoom, setGameRoom] = useState(null)
  const [pendingGameId, setPendingGameId] = useState('')
  const [pendingGameRoom, setPendingGameRoom] = useState(null)
  const [joiningGame, setJoiningGame] = useState(false)
  const [gameMessages, setGameMessages] = useState([])
  const [gameChatText, setGameChatText] = useState('')
  const [gameShowEmoji, setGameShowEmoji] = useState(false)
  const [gameChatOpen, setGameChatOpen] = useState(true)
  const gameChatEndRef = useRef(null)
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
    if (!user) return
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
    if (!user || !gameRoomId) { setGameRoom(null); setGameMessages([]); return }
    const unsubRoom = onSnapshot(doc(db, 'game_rooms', gameRoomId), (snap) => {
      if (snap.exists()) setGameRoom({ id: snap.id, ...snap.data() })
    }, (error) => { console.error('Game room listener:', error); setNotice('Could not load game participants. Check Firestore rules.') })
    const q = query(collection(db, 'chat_messages'), where('gameRoomId', '==', gameRoomId), limit(100))
    const unsubMessages = onSnapshot(q, (snap) => {
      setGameMessages(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)))
    }, (error) => { console.error('Game chat listener:', error); setNotice('Game chat could not load. Check Firestore rules.') })
    return () => { unsubRoom(); unsubMessages() }
  }, [user, gameRoomId])

  useEffect(() => { gameChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [gameMessages, gameChatOpen])

  const isDark = darkMode
  const page = isDark ? 'min-h-screen bg-[#101820] text-slate-100' : 'min-h-screen bg-slate-50 text-slate-900'
  const panel = isDark ? 'border border-white/[0.09] bg-[#17212b]/95 shadow-[0_12px_45px_rgba(5,20,30,0.16)]' : 'border border-slate-200 bg-white shadow-sm'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const field = isDark ? 'border-white/10 bg-[#111b24] text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  const buttonPrimary = 'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-cyan-700 px-4 py-2.5 font-bold text-white shadow-lg shadow-teal-950/30 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'
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
    setActiveQuiz(quiz); setCurrentQuestion(0); setAnswers({}); setIdentificationDraft(''); setQuizFinished(false); setGameChatOpen(true)
    try {
      const roomData = { creatorId: user.uid, creatorName: userName, quizId: quiz.id, quiz: { id: quiz.id, title: quiz.title, category: quiz.category || 'General', difficulty: quiz.difficulty || 'Easy', questions: quiz.questions }, memberIds: [user.uid], players: [{ uid: user.uid, name: userName, joinedAt: Date.now() }], status: 'playing', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
      const roomRef = await addDoc(collection(db, 'game_rooms'), roomData)
      setGameRoomId(roomRef.id)
      setGameRoom({ id: roomRef.id, ...roomData })
    } catch (error) { console.error('Create game room:', error); setGameRoomId(''); setGameRoom(null); setNotice('Quiz started, but multiplayer invite could not be created. Check Firestore rules.') }
  }
  function closeQuiz() { setActiveQuiz(null); setQuizFinished(false); setAnswers({}); setIdentificationDraft(''); setCurrentQuestion(0); setGameRoomId(''); setGameRoom(null); setGameMessages([]) }
  async function acceptGameInvitation() {
    if (!user || !pendingGameId || !pendingGameRoom || joiningGame) return
    setJoiningGame(true)
    try {
      const ref = doc(db, 'game_rooms', pendingGameId)
      const snap = await getDoc(ref)
      if (!snap.exists()) throw new Error('This game room no longer exists.')
      const room = snap.data()
      if (!Array.isArray(room.quiz?.questions) || !room.quiz.questions.length) throw new Error('This room has no valid quiz.')
      if (!(room.memberIds || []).includes(user.uid)) {
        if ((room.memberIds || []).length >= 20) throw new Error('This game room is full (20 players maximum).')
        await updateDoc(ref, {
          memberIds: arrayUnion(user.uid),
          players: arrayUnion({ uid: user.uid, name: userName, joinedAt: Date.now() }),
          updatedAt: serverTimestamp(),
        })
      }
      setGameRoomId(pendingGameId)
      setGameRoom({ id: pendingGameId, ...room, memberIds: [...new Set([...(room.memberIds || []), user.uid])], players: (room.players || []).some((p) => p.uid === user.uid) ? room.players : [...(room.players || []), { uid: user.uid, name: userName, joinedAt: Date.now() }] })
      setActiveQuiz({ ...room.quiz, id: room.quiz.id || room.quizId || pendingGameId })
      setCurrentQuestion(0); setAnswers({}); setQuizFinished(false); setGameChatOpen(true)
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

  async function deleteQuiz(quiz) {
    if (!user || quiz.createdBy !== user.uid) return setNotice('You can only delete quizzes you created.')
    if (!window.confirm(`Delete “${quiz.title}”? This cannot be undone.`)) return
    try {
      await deleteDoc(doc(db, 'quizzes', quiz.id))
      setQuizzes((previous) => previous.filter((item) => item.id !== quiz.id))
      setNotice('Quiz deleted successfully.')
    } catch (error) {
      console.error('Delete quiz:', error)
      setNotice('Could not delete this quiz. Check Firestore rules and try again.')
    }
  }


  async function sendGameMessage(event) {
    event?.preventDefault()
    const text = gameChatText.trim()
    if (!text || !user || !gameRoomId) return
    setGameChatText(''); setGameShowEmoji(false)
    try {
      await addDoc(collection(db, 'chat_messages'), { roomId: `game_${gameRoomId}`, gameRoomId, text, senderId: user.uid, senderName: userName, memberIds: gameRoom?.memberIds || [user.uid], createdAt: serverTimestamp() })
    } catch (error) { console.error('Game chat send:', error); setGameChatText(text); setNotice('Game message not sent. Check Firestore rules.') }
  }

  async function copyGameInvite() {
    if (!gameRoomId) return setNotice('Game invite is not ready yet.')
    const link = `${window.location.origin}${window.location.pathname}?game=${gameRoomId}`
    try { await navigator.clipboard.writeText(link); setNotice('Game invitation link copied! Send it to your friends.') }
    catch { setNotice(link) }
  }
  async function finishQuiz(finalAnswers = answers) {
    const questions = activeQuiz.questions
    const score = questions.reduce((total, question, index) => total + (isCorrectAnswer(question, finalAnswers[index]) ? 1 : 0), 0)
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
      const options = [...q.options]
      options[optionIndex] = value
      return { ...q, options }
    }))
  }

  function changeQuestionType(questionIndex, type) {
    setNewQuestions((previous) => previous.map((q, index) => {
      if (index !== questionIndex) return q
      if (type === 'boolean') return { ...q, type, options: ['True', 'False'], correctAnswer: 0, correctText: '' }
      if (type === 'identification') return { ...q, type, options: [], correctAnswer: 0, correctText: '' }
      return { ...q, type: 'multiple', options: ['', '', '', ''], correctAnswer: 0, correctText: '' }
    }))
  }

  function rememberChoices(values) {
    const cleaned = values.map((value) => String(value).trim()).filter(Boolean)
    setSavedChoices((previous) => {
      const combined = [...new Set([...cleaned, ...previous])].slice(0, 150)
      try { localStorage.setItem('quiz-arena-choice-library', JSON.stringify(combined)) } catch (error) { console.warn('Choice library storage:', error) }
      return combined
    })
  }

  async function createQuiz(event) {
    event.preventDefault()
    if (!title.trim()) return setNotice('Please enter a quiz title.')
    const valid = newQuestions.every((q) => q.question.trim() && (
      q.type === 'identification' ? q.correctText.trim() : q.options.length && q.options.every((o) => o.trim())
    ))
    if (!valid) return setNotice('Complete every question and its correct answer or choices.')
    setSaving(true)
    const preparedQuestions = newQuestions.map((q) => ({
      type: q.type || 'multiple',
      question: q.question.trim(),
      options: q.type === 'identification' ? [] : q.options.map((o) => o.trim()),
      correctAnswer: Number(q.correctAnswer || 0),
      ...(q.type === 'identification' ? { correctText: q.correctText.trim() } : {}),
    }))
    const quizData = { title: title.trim(), category, difficulty, questions: preparedQuestions, createdBy: user.uid, creatorName: userName, privacy: 'invite', allowedUserIds: [user.uid], createdAt: serverTimestamp() }
    try {
      newQuestions.filter((q) => q.type === 'multiple').forEach((q) => rememberChoices(q.options))
      const saved = await addDoc(collection(db, 'quizzes'), quizData)
      setQuizzes((previous) => [{ ...quizData, id: saved.id, createdAt: new Date() }, ...previous])
      setTitle(''); setCategory(categories[0]); setDifficulty('Easy'); setNewQuestions([emptyQuestion()]); setChoiceSearch(''); setShowCreate(false); setActiveTab('My Quizzes'); setNotice('Quiz created and saved!')
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

  if (!authReady) return <div className={`${page} grid min-h-screen place-items-center`}><div className="text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-teal-600/20 text-teal-300"><Activity className="animate-pulse" size={34} /></div><p className={muted}>Entering the Arena...</p></div></div>
  if (!user) return <Auth onLogin={setUser} />

  if (activeQuiz) {
    const questions = activeQuiz.questions || []
    const question = questions[currentQuestion]
    const score = questions.reduce((total, item, index) => total + (isCorrectAnswer(item, answers[index]) ? 1 : 0), 0)
    return <div className={`${page} min-h-screen px-4 py-8 sm:px-6`}><div className="mx-auto max-w-3xl">
      <button onClick={closeQuiz} className={`mb-6 inline-flex items-center gap-2 ${muted} hover:text-teal-400`}><ArrowLeft size={18} /> Back to arena</button>
      <div className={`${panel} rounded-3xl p-5 sm:p-8`}>
        {!quizFinished ? <>
          <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-400"><Zap size={15} /> {activeQuiz.category}</p><h1 className="text-2xl font-black sm:text-3xl">{activeQuiz.title}</h1></div><span className="rounded-xl bg-teal-500/15 px-3 py-2 text-sm font-bold text-teal-300">{currentQuestion + 1}/{questions.length}</span></div>
          <div className="mb-8 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} /></div>
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-teal-400/20 bg-teal-500/[0.07] p-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold"><Users size={16} className="mr-1 inline text-teal-300" /> {gameRoom?.players?.length || 1} player{(gameRoom?.players?.length || 1) === 1 ? '' : 's'} in this game</p><p className={`text-xs ${muted}`}>Share the invite link so friends can join this quiz room.</p></div><button onClick={copyGameInvite} className={buttonSecondary}><Copy size={16} className="mr-2" /> Invite players</button><button onClick={() => setGameChatOpen((v) => !v)} className={buttonSecondary}><MessageCircle size={16} className="mr-2" /> {gameChatOpen ? 'Hide chat' : 'Game chat'}</button></div>
          {gameRoom?.players?.length > 0 && <div className="mb-5 flex flex-wrap gap-2">{gameRoom.players.map((player) => <span key={player.uid} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />{player.name}{player.uid === gameRoom.creatorId ? ' · Host' : ''}</span>)}</div>}
          {gameChatOpen && <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111b24]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><p className="font-bold"><MessageCircle size={16} className="mr-2 inline text-teal-300" />Live game chat</p><span className="text-xs text-emerald-300">{gameMessages.length} messages</span></div><div className="max-h-44 space-y-2 overflow-y-auto p-3">{gameMessages.length === 0 ? <p className="py-3 text-center text-xs text-slate-500">Say hi to your squad. Emojis welcome! 🎮</p> : gameMessages.map((message) => <div key={message.id} className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="mb-1 text-[10px] font-bold text-teal-300">{message.senderName || 'Player'} · {timeLabel(message.createdAt)}</p><p className="break-words text-sm">{message.text}</p></div>)}<div ref={gameChatEndRef} /></div>{gameShowEmoji && <div className="flex flex-wrap gap-1 border-t border-white/10 p-2">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => setGameChatText((v) => v + emoji)} className="rounded-lg p-1 text-xl hover:bg-white/10">{emoji}</button>)}</div>}<form onSubmit={sendGameMessage} className="flex items-center gap-2 border-t border-white/10 p-2"><button type="button" onClick={() => setGameShowEmoji((v) => !v)} className="rounded-lg p-2 text-teal-300" title="Choose emoji"><Smile size={20} /></button><input value={gameChatText} onChange={(e) => setGameChatText(e.target.value)} maxLength={1000} placeholder="Message players..." className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" /><button type="submit" disabled={!gameChatText.trim() || !gameRoomId} className={`${buttonPrimary} p-2.5`} aria-label="Send game message"><Send size={17} /></button></form></div>}
          <h2 className="mb-6 text-xl font-bold leading-relaxed">{question.question}</h2>
          {question.type === 'identification' ? <div className="space-y-3"><label className={`block text-sm font-bold ${muted}`}>Type your answer</label><input value={identificationDraft} disabled={answers[currentQuestion] !== undefined} onChange={(e) => setIdentificationDraft(e.target.value)} placeholder="Enter your answer..." className={`w-full rounded-xl border px-4 py-4 text-lg outline-none focus:border-cyan-400 ${field}`} /><button disabled={!identificationDraft.trim() || answers[currentQuestion] !== undefined} onClick={() => setAnswers((previous) => ({ ...previous, [currentQuestion]: identificationDraft.trim() }))} className={buttonPrimary}>Lock answer</button></div> : <div className="grid gap-3">{(question.options || []).map((option, index) => {
            const selected = answers[currentQuestion] === index
            const answered = answers[currentQuestion] !== undefined
            const correct = question.correctAnswer === index
            const wrongSelected = answered && selected && !correct
            const style = answered && correct ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : wrongSelected ? 'border-rose-400 bg-rose-500/15 text-rose-300' : isDark ? 'border-white/10 hover:border-cyan-400 hover:bg-cyan-500/10' : 'border-slate-200 hover:border-cyan-400'
            return <button key={index} onClick={() => chooseAnswer(index)} disabled={answered} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${style} ${answered ? 'cursor-default' : 'hover:-translate-y-0.5'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-500/15 font-black text-cyan-300">{question.type === 'boolean' ? (index === 0 ? 'T' : 'F') : String.fromCharCode(65 + index)}</span><span className="flex-1 font-semibold">{option}</span>{answered && correct && <CheckCircle2 className="text-emerald-300" size={22} />}{wrongSelected && <X className="text-rose-300" size={22} />}</button>
          })}</div>}
          {answers[currentQuestion] !== undefined && <div className={`mt-4 rounded-2xl border p-4 ${isCorrectAnswer(question, answers[currentQuestion]) ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-rose-400/30 bg-rose-500/10'}`}><p className={`font-bold ${isCorrectAnswer(question, answers[currentQuestion]) ? 'text-emerald-300' : 'text-rose-300'}`}>{isCorrectAnswer(question, answers[currentQuestion]) ? 'Correct answer! 🎉' : 'Not quite — keep going! 💪'}</p>{!isCorrectAnswer(question, answers[currentQuestion]) && <p className={`mt-1 text-sm ${muted}`}>Correct answer: <span className="font-bold text-emerald-300">{question.type === 'identification' ? question.correctText : question.options[question.correctAnswer]}</span></p>}</div>}
          <div className="mt-8 flex items-center justify-between gap-3"><button className={buttonSecondary} disabled={currentQuestion === 0} onClick={() => { setCurrentQuestion((n) => n - 1); setIdentificationDraft('') }}>Previous</button>{currentQuestion < questions.length - 1 ? <button className={buttonPrimary} onClick={() => { setCurrentQuestion((n) => n + 1); setIdentificationDraft('') }}>Next question <ChevronRight className="ml-1" size={18} /></button> : <button className={buttonPrimary} onClick={() => finishQuiz()}>Submit answers <Trophy className="ml-2" size={18} /></button>}</div>
        </> : <div className="py-8 text-center"><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-teal-600/30 to-cyan-600/20 text-teal-300"><Trophy size={42} /></div><p className={`mb-2 ${muted}`}>MISSION COMPLETE</p><h1 className="mb-3 text-3xl font-black">Your Results</h1><p className="mb-2 text-6xl font-black text-teal-300">{score}<span className="text-3xl text-slate-500">/{questions.length}</span></p><p className={`mb-8 ${muted}`}>You scored {Math.round(score / questions.length * 100)}%.</p><div className="mb-8 space-y-3 text-left">{questions.map((item, index) => { const correct = isCorrectAnswer(item, answers[index]); return <div key={index} className={`rounded-xl border p-4 ${correct ? 'border-emerald-500/30' : 'border-rose-500/30'}`}><p className="mb-2 font-semibold">{index + 1}. {item.question}</p><p className={correct ? 'text-emerald-300' : 'text-rose-300'}>Your answer: {answerLabel(item, answers[index])}</p>{!correct && <p className="mt-1 text-sm text-emerald-300">Correct answer: {item.type === 'identification' ? item.correctText : item.options[item.correctAnswer]}</p>}</div>})}</div><div className="flex flex-wrap justify-center gap-3"><button className={buttonSecondary} onClick={closeQuiz}><ArrowLeft className="mr-2" size={17} /> Dashboard</button><button className={buttonPrimary} onClick={() => startQuiz(activeQuiz)}><RotateCcw className="mr-2" size={17} /> Play again</button></div></div>}
      </div></div></div>
  }

  const filteredPeople = people.filter((p) => (p.displayName || p.name || '').toLowerCase().includes(friendSearch.toLowerCase()) || p.email?.toLowerCase().includes(friendSearch.toLowerCase()))
  const selectedFriend = chatMode.startsWith('friends_') ? friends.find((f) => friendRoomId(user.uid, f.otherId) === chatMode) : null

  return <div className={`${page} min-h-screen`}>
    <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-teal-700/[0.07] blur-3xl" /><div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-sky-700/[0.05] blur-3xl" /></div>
    <aside className={`fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r p-5 backdrop-blur-xl lg:flex ${isDark ? 'border-white/[0.08] bg-[#121d27]/95' : 'border-slate-200 bg-white/95'}`}>
      <div className="mb-9 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 shadow-lg shadow-teal-950/50"><Gamepad2 size={26} /></div><div><h1 className="text-lg font-black tracking-tight">QUIZ <span className="text-teal-400">ARENA</span></h1><p className={`text-[11px] uppercase tracking-[0.22em] ${muted}`}>Learn · Play · Win</p></div></div>
      <p className={`mb-3 px-3 text-[10px] font-black uppercase tracking-[0.22em] ${muted}`}>Main menu</p>
      <nav className="space-y-1.5">{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveTab(label); setMobileNav(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${activeTab === label ? 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-lg shadow-teal-950/30' : isDark ? 'text-slate-400 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon size={18} />{label}{label === 'Chat' && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />}</button>)}</nav>
      <div className="mt-auto"><div className={`mb-3 flex items-center gap-3 rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200'}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/20 font-black text-teal-300">{initials(userName)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{userName}</p><p className={`truncate text-[11px] ${muted}`}>{user.isAnonymous ? 'Guest player' : user.email}</p></div><span className="h-2 w-2 rounded-full bg-emerald-400" /></div><button onClick={() => setDarkMode((v) => !v)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm ${muted} hover:bg-white/[0.05]`}>{isDark ? <Sun size={18} /> : <Moon size={18} />}{isDark ? 'Light mode' : 'Dark mode'}</button><button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-rose-400 hover:bg-rose-500/10"><LogOut size={18} /> Sign out</button></div>
    </aside>

    {mobileNav && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)}><div className={`h-full w-72 p-5 ${isDark ? 'bg-[#121d27]' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}><div className="mb-6 flex items-center justify-between"><span className="font-black">QUIZ <span className="text-teal-400">ARENA</span></span><button onClick={() => setMobileNav(false)}><X /></button></div>{navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveTab(label); setMobileNav(false) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activeTab === label ? 'bg-teal-600 text-white' : ''}`}><Icon size={18} />{label}</button>)}</div></div>}

    <main className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:ml-64 lg:px-9 lg:py-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><button className={`${buttonSecondary} p-2.5 lg:hidden`} onClick={() => setMobileNav(true)}><Menu size={20} /></button><div><p className={`mb-1 text-xs font-bold uppercase tracking-[0.18em] ${muted}`}>Player dashboard</p><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{activeTab === 'Overview' ? `Welcome back, ${userName}!` : activeTab}</h1></div></div><div className="flex flex-wrap gap-2"><span className={`hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold sm:inline-flex ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}><span className="h-2 w-2 rounded-full bg-emerald-400" /> Arena online</span><button onClick={() => setDarkMode((v) => !v)} className={`${buttonSecondary} p-2.5`} title="Toggle theme">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button><button onClick={() => { setShowCreate(true); setNewQuestions([emptyQuestion()]) }} className={buttonPrimary}><Plus size={18} className="mr-1" /> Create Quiz</button><button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-md shadow-rose-950/20 transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:ring-offset-2 focus:ring-offset-[#100c1e]" title="Sign out"><LogOut size={18} /> <span>Logout</span></button></div></header>

      {activeTab === 'Overview' && <><section className="relative mb-7 overflow-hidden rounded-3xl border border-teal-400/20 bg-gradient-to-br from-[#164e63] via-[#155e75] to-[#1e3a5f] p-6 shadow-2xl shadow-teal-950/30 sm:p-9"><div className="pointer-events-none absolute -right-10 -top-12 h-64 w-64 rounded-full border-[30px] border-white/[0.05]" /><div className="pointer-events-none absolute right-16 top-10 hidden rotate-12 text-white/[0.08] sm:block"><Gamepad2 size={180} /></div><div className="relative max-w-2xl"><span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider"><Sparkles size={15} /> Level up your brain</span><h2 className="mb-3 text-3xl font-black leading-tight sm:text-5xl">Think fast.<br /><span className="text-cyan-200">Play legendary.</span></h2><p className="mb-6 max-w-lg text-sm leading-6 text-teal-100 sm:text-base">Challenge your knowledge, climb the leaderboard, and invite your squad into the Arena.</p><div className="flex flex-wrap gap-3"><button onClick={() => setActiveTab('Explore Quizzes')} className="rounded-xl bg-white px-5 py-3 font-black text-teal-800 transition hover:-translate-y-0.5 hover:bg-teal-50">Start a challenge <ChevronRight className="ml-1 inline" size={18} /></button><button onClick={() => setActiveTab('Invite Friends')} className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/15"><Users className="mr-2 inline" size={17} /> Invite squad</button></div></div></section>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Available Quizzes', value: quizzes.length, icon: BookOpen, color: 'text-teal-300', bg: 'bg-teal-500/15' }, { label: 'My Quizzes', value: myQuizzes.length, icon: Plus, color: 'text-cyan-300', bg: 'bg-cyan-500/15' }, { label: 'Quizzes Completed', value: myResults.length, icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/15' }, { label: 'Average Score', value: `${averageScore}%`, icon: Trophy, color: 'text-amber-300', bg: 'bg-amber-500/15' }].map(({ label, value, icon: Icon, color, bg }) => <div key={label} className={`${panel} rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-teal-400/30`}><div className="mb-4 flex items-center justify-between"><span className={`text-sm ${muted}`}>{label}</span><span className={`rounded-xl p-2.5 ${bg} ${color}`}><Icon size={20} /></span></div><p className="text-3xl font-black tracking-tight">{value}</p><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" /></div></div>)}</section></>}

      {activeTab === 'Leaderboard' && <section><div className={`${panel} mb-5 rounded-2xl p-5`}><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-300"><Crown size={26} /></div><div><h2 className="text-xl font-black">Hall of Fame</h2><p className={`text-sm ${muted}`}>Recent scores from Arena players.</p></div></div></div><div className={`${panel} overflow-hidden rounded-2xl`}>{results.length === 0 ? <p className={`p-8 text-center ${muted}`}>No scores yet. Complete a quiz to appear here.</p> : <div className="divide-y divide-white/[0.06]">{[...results].sort((a,b) => (b.totalQuestions ? b.score / b.totalQuestions : 0) - (a.totalQuestions ? a.score / a.totalQuestions : 0)).map((result, index) => <div key={result.id} className="flex flex-wrap items-center gap-4 p-4"><span className={`grid h-10 w-10 place-items-center rounded-xl font-black ${index === 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-teal-500/15 text-teal-300'}`}>{index === 0 ? <Medal size={21} /> : index + 1}</span><div className="min-w-0 flex-1"><p className="font-bold">{result.userName || 'Player'}</p><p className={`truncate text-sm ${muted}`}>{result.quizTitle}</p></div><p className="font-black text-teal-300">{result.score}/{result.totalQuestions}</p></div>)}</div>}</div></section>}

      {activeTab === 'Chat' && <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"><div className={`${panel} rounded-2xl p-4`}><h2 className="mb-3 flex items-center gap-2 font-black"><MessageCircle size={18} className="text-teal-300" /> Channels</h2><button onClick={() => setChatMode('general')} className={`mb-2 flex w-full items-center gap-3 rounded-xl p-3 text-left ${chatMode === 'general' ? 'bg-teal-600 text-white' : 'hover:bg-white/[0.05]'}`}><Globe2 size={19} /><span className="flex-1"><span className="block font-bold">General chat</span><span className={`text-xs ${chatMode === 'general' ? 'text-teal-100' : muted}`}>Everyone in the Arena</span></span></button><p className={`mb-2 mt-5 px-2 text-[10px] font-black uppercase tracking-[0.2em] ${muted}`}>Your squad</p>{friends.length === 0 ? <p className={`px-2 py-3 text-sm ${muted}`}>Add friends to unlock private chats.</p> : friends.map((friend) => { const id = friendRoomId(user.uid, friend.otherId); return <button key={friend.id} onClick={() => setChatMode(id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${chatMode === id ? 'bg-teal-600 text-white' : 'hover:bg-white/[0.05]'}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 text-xs font-black text-cyan-300">{initials(friend.name)}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{friend.name}</span><span className="h-2 w-2 rounded-full bg-emerald-400" /></button>})}<button onClick={() => setActiveTab('Friends')} className={`${buttonSecondary} mt-4 w-full text-sm`}><UserPlus className="mr-2" size={16} /> Find friends</button></div>
        <div className={`${panel} flex min-h-[580px] flex-col overflow-hidden rounded-2xl`}><div className="flex items-center gap-3 border-b border-white/[0.07] p-4 sm:p-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600">{chatMode === 'general' ? <Globe2 size={21} /> : <Users size={21} />}</div><div className="min-w-0 flex-1"><h2 className="font-black">{chatMode === 'general' ? 'General Arena Chat' : selectedFriend?.name || 'Friends-only chat'}</h2><p className={`text-xs ${muted}`}>{chatMode === 'general' ? 'Be kind. Keep it fun.' : 'Private conversation between friends'}</p></div><span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live</span></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{messages.length === 0 ? <div className="grid h-full min-h-64 place-items-center text-center"><div><div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-teal-500/15 text-teal-300"><MessageSquare size={25} /></div><p className="font-bold">No messages yet</p><p className={`mt-1 text-sm ${muted}`}>Break the ice. Send the first message! ✨</p></div></div> : messages.map((message) => { const mine = message.senderId === user.uid; return <div key={message.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>{!mine && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-500/20 text-[10px] font-black text-teal-300">{initials(message.senderName)}</div>}<div className={`max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}><div className={`mb-1 flex items-center gap-2 text-[10px] ${muted}`}><span>{mine ? 'You' : message.senderName || 'Player'}</span><span>{timeLabel(message.createdAt)}</span></div><div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${mine ? 'rounded-br-md bg-gradient-to-r from-teal-600 to-cyan-700 text-white' : isDark ? 'rounded-bl-md bg-white/[0.07]' : 'rounded-bl-md bg-slate-100'}`}>{message.text}</div></div>{mine && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-500/20 text-[10px] font-black text-cyan-300">{initials(userName)}</div>}</div>})}<div ref={chatEndRef} /></div>
        {showEmoji && <div className="mx-4 mb-2 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#111b24] p-3">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => setChatText((v) => v + emoji)} className="rounded-lg p-1.5 text-xl hover:bg-white/10">{emoji}</button>)}</div>}
        <form onSubmit={sendMessage} className="border-t border-white/[0.07] p-3 sm:p-4"><div className={`flex items-center gap-2 rounded-2xl border p-2 ${isDark ? 'border-white/10 bg-[#111b24]' : 'border-slate-200 bg-slate-50'}`}><button type="button" onClick={() => setShowEmoji((v) => !v)} className={`rounded-xl p-2 ${showEmoji ? 'bg-teal-500/20 text-teal-300' : muted}`} title="Emoji picker"><Smile size={21} /></button><input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Send a message to the squad..." maxLength={1000} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none" /><button type="submit" disabled={!chatText.trim()} className={`${buttonPrimary} p-2.5`} aria-label="Send message"><Send size={18} /></button></div><p className={`mt-2 px-2 text-[10px] ${muted}`}>Messages are saved in Firebase. Keep it friendly. 💜</p></form></div></section>}

      {activeTab === 'Friends' && <section className="grid gap-5 xl:grid-cols-2"><div className={`${panel} rounded-2xl p-5`}><div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-500/15 text-teal-300"><Users size={22} /></div><div><h2 className="font-black">Your squad</h2><p className={`text-sm ${muted}`}>{friends.length} friend{friends.length === 1 ? '' : 's'} connected</p></div></div>{friends.length === 0 ? <p className={`rounded-xl border border-dashed border-white/10 p-6 text-center text-sm ${muted}`}>No friends yet. Send an invite or connect with a player.</p> : <div className="space-y-2">{friends.map((f) => <div key={f.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-500/30 to-cyan-500/20 font-black text-teal-200">{initials(f.name)}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{f.name}</p><p className={`text-xs ${muted}`}>Arena friend</p></div><button onClick={() => { setChatMode(friendRoomId(user.uid, f.otherId)); setActiveTab('Chat') }} className={buttonSecondary}><MessageCircle className="mr-2" size={16} /> Chat</button></div>)}</div>}
        <div className="mt-6 border-t border-white/[0.07] pt-5"><h3 className="mb-3 font-bold">Friend requests <span className="ml-1 rounded-full bg-teal-500/20 px-2 py-0.5 text-xs text-teal-300">{friendRequests.length}</span></h3>{friendRequests.length === 0 ? <p className={`text-sm ${muted}`}>You're all caught up.</p> : <div className="space-y-2">{friendRequests.map((r) => <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{r.fromName || 'Player'}</p><p className={`text-xs ${muted}`}>wants to connect</p></div><button onClick={() => acceptFriendRequest(r)} className={`${buttonPrimary} px-3 py-2`}><Check size={16} className="mr-1" /> Accept</button></div>)}</div>}</div></div>
        <div className={`${panel} rounded-2xl p-5`}><div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300"><Search size={21} /></div><div><h2 className="font-black">Find players</h2><p className={`text-sm ${muted}`}>Grow your Arena squad.</p></div></div><div className="relative mb-4"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={17} /><input value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} placeholder="Search players..." className={`w-full rounded-xl border py-3 pl-10 pr-3 outline-none focus:border-teal-500 ${field}`} /></div><div className="space-y-2">{filteredPeople.slice(0, 12).map((p) => { const alreadyFriend = friends.some((f) => f.otherId === p.id); return <div key={p.id} className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-white/[0.03]"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/15 font-black text-teal-300">{initials(p.displayName || p.name)}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{p.displayName || p.name || 'Quiz Player'}</p><p className={`truncate text-xs ${muted}`}>{p.email || 'Quiz Arena player'}</p></div>{alreadyFriend ? <span className="text-xs font-semibold text-emerald-300"><Check size={15} className="mr-1 inline" /> Friend</span> : <button onClick={() => sendFriendRequest(p)} className={`${buttonSecondary} px-3 py-2 text-xs`}><UserPlus size={15} className="mr-1" /> Add</button>}</div>})}{filteredPeople.length === 0 && <p className={`py-6 text-center text-sm ${muted}`}>No player profiles found yet.</p>}</div><p className={`mt-4 text-xs ${muted}`}>Players appear here after their profile is created in Firestore.</p></div></section>}

      {activeTab === 'Invite Friends' && <section className="mx-auto max-w-3xl"><div className="relative overflow-hidden rounded-3xl border border-teal-400/20 bg-gradient-to-br from-teal-800 via-cyan-800 to-slate-800 p-6 sm:p-9"><div className="absolute -right-8 -top-8 text-white/[0.08]"><Users size={190} /></div><div className="relative"><div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><UserPlus size={29} /></div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-teal-200">Build your squad</p><h2 className="mb-3 text-3xl font-black sm:text-4xl">The Arena is better together.</h2><p className="mb-7 max-w-xl text-sm leading-6 text-teal-100">Create a personal invitation link. Send it through Messenger, Facebook, or any app. When your friend opens the link and accepts, you can chat privately.</p><button onClick={createInvite} disabled={inviteBusy} className="rounded-xl bg-white px-5 py-3 font-black text-teal-800 transition hover:-translate-y-0.5 disabled:opacity-60">{inviteBusy ? 'Creating link...' : <><Link2 className="mr-2 inline" size={18} /> Create & copy invite link</>}</button></div></div>
        {inviteLink && <div className={`${panel} mt-5 rounded-2xl p-5`}><h3 className="mb-2 font-black">Your invitation link</h3><p className={`mb-3 text-sm ${muted}`}>Anyone with this link can request to connect with you. Only share it with people you trust.</p><div className="flex flex-col gap-2 sm:flex-row"><input readOnly value={inviteLink} className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm ${field}`} /><button onClick={() => { navigator.clipboard?.writeText(inviteLink).then(() => setNotice('Invite link copied!')).catch(() => setNotice('Select and copy the link manually.')) }} className={buttonPrimary}><Copy className="mr-2" size={17} /> Copy</button></div><button onClick={() => { const url = `https://www.facebook.com/messages/`; window.open(url, '_blank', 'noopener,noreferrer') }} className={`${buttonSecondary} mt-3`}><Mail className="mr-2" size={17} /> Open Messenger</button></div>}
        {inviteCode && !inviteLink && <div className={`${panel} mt-5 rounded-2xl p-5`}><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-500/15 text-teal-300"><ShieldCheck size={23} /></div><div className="flex-1"><h3 className="font-black">You've been invited to the Arena!</h3><p className={`my-2 text-sm ${muted}`}>Accept this invitation to connect and unlock a private friends chat.</p><button onClick={acceptInvite} className={buttonPrimary}>Accept invitation <ChevronRight className="ml-1" size={17} /></button></div></div></div>}
        <div className={`${panel} mt-5 rounded-2xl p-5`}><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black">Your Arena connections</h3><span className="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-bold text-teal-300">{friends.length} connected</span></div><p className={`text-sm ${muted}`}>Accepted invitations appear in Friends and unlock private chat. During a quiz, the live player list shows who joined that specific game room.</p>{friendRequests.length > 0 && <p className="mt-3 text-sm font-semibold text-amber-300">{friendRequests.length} pending friend request{friendRequests.length === 1 ? '' : 's'} waiting in Friends.</p>}</div>
        <div className={`${panel} mt-5 rounded-2xl p-5`}><h3 className="mb-3 font-black">How it works</h3><div className="grid gap-4 sm:grid-cols-3">{[{ n:'01', title:'Create a link', desc:'Generate a unique invitation.' },{ n:'02', title:'Share it', desc:'Send the link to your friend.' },{ n:'03', title:'Connect & chat', desc:'Accept to unlock private chat.' }].map((item) => <div key={item.n} className="rounded-xl bg-white/[0.03] p-4"><p className="mb-2 text-xs font-black text-teal-300">{item.n}</p><p className="mb-1 font-bold">{item.title}</p><p className={`text-sm ${muted}`}>{item.desc}</p></div>)}</div></div></section>}

      {(activeTab === 'Overview' || activeTab === 'Explore Quizzes' || activeTab === 'My Quizzes') && <section><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">{activeTab === 'My Quizzes' ? 'Your creations' : activeTab === 'Explore Quizzes' ? 'Explore challenges' : 'Popular challenges'}</h2><p className={`mt-1 text-sm ${muted}`}>Pick a challenge and prove your skills.</p></div><div className="relative w-full sm:w-72"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quizzes..." className={`w-full rounded-xl border py-3 pl-10 pr-4 outline-none focus:border-teal-500 ${field}`} /></div></div>
        {visibleQuizzes.length === 0 ? <div className={`${panel} rounded-2xl p-10 text-center`}><BookOpen className={`mx-auto mb-3 ${muted}`} size={36} /><h3 className="mb-2 text-lg font-black">No quizzes found</h3><p className={`mb-5 text-sm ${muted}`}>Try another search or create a challenge.</p><button className={buttonPrimary} onClick={() => setShowCreate(true)}><Plus className="mr-1" size={18} /> Create Quiz</button></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleQuizzes.map((quiz, index) => <article key={quiz.id} className={`${panel} group overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:border-teal-400/30`}><div className={`relative flex h-32 items-center justify-center overflow-hidden ${index % 3 === 0 ? 'bg-gradient-to-br from-teal-800 to-slate-700' : index % 3 === 1 ? 'bg-gradient-to-br from-cyan-800 to-teal-700' : 'bg-gradient-to-br from-slate-700 to-sky-800'}`}><div className="absolute -right-3 -top-7 rotate-12 text-white/10 transition group-hover:scale-110"><Gamepad2 size={120} /></div><BookOpen size={43} className="relative text-white drop-shadow-lg transition group-hover:scale-110" /><span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">{quiz.difficulty || 'Custom'}</span></div><div className="p-5"><span className="mb-3 inline-flex rounded-full bg-teal-500/15 px-3 py-1 text-xs font-bold text-teal-300">{quiz.category || 'General'}</span><h3 className="mb-2 text-lg font-black">{quiz.title}</h3><p className={`mb-5 flex items-center gap-2 text-sm ${muted}`}><BookOpen size={16} /> {quiz.questions?.length || 0} questions <span>·</span><Clock3 size={16} /> {Math.max(1, Math.ceil((quiz.questions?.length || 0) * .5))} min</p><div className="flex gap-2"><button onClick={() => startQuiz(quiz)} className={`${buttonPrimary} min-w-0 flex-1`}>Enter challenge <ChevronRight className="ml-1" size={18} /></button>{quiz.createdBy === user.uid && <button onClick={() => deleteQuiz(quiz)} className={`${buttonSecondary} border-rose-500/25 px-3 text-rose-400 hover:bg-rose-500/10`} title="Delete my quiz" aria-label={`Delete ${quiz.title}`}><Trash2 size={17} /></button>}</div></div></article>)}</div>}</section>}

      {(activeTab === 'Overview' || activeTab === 'Explore Quizzes' || activeTab === 'My Quizzes') && <section className={`${panel} mt-8 rounded-2xl p-5`}><div className="mb-4 flex items-center justify-between"><h2 className="font-black">Recent runs</h2><button onClick={() => setActiveTab('Leaderboard')} className="text-xs font-bold text-teal-300 hover:text-teal-200">View leaderboard <ChevronRight className="ml-1 inline" size={14} /></button></div>{myResults.length === 0 ? <p className={`text-sm ${muted}`}>No results yet. Choose a quiz above and start your first run.</p> : <div className="space-y-3">{myResults.slice(0, 5).map((result) => <div key={result.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.025] p-3"><div><p className="font-semibold">{result.quizTitle}</p><p className={`text-xs ${muted}`}>{result.totalQuestions} questions</p></div><span className="rounded-xl bg-teal-500/15 px-3 py-2 font-black text-teal-300">{result.score}/{result.totalQuestions}</span></div>)}</div>}</section>}
      <footer className={`mt-8 flex flex-wrap items-center justify-center gap-2 text-center text-xs ${muted}`}><Gamepad2 size={15} /> Quiz Arena <span>·</span> Learn, play, improve <span>·</span><span className="text-teal-300">GG, have fun!</span></footer>
    </main>

    {pendingGameRoom && <div className="fixed inset-0 z-[55] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><div className={`${panel} w-full max-w-md rounded-3xl p-6`}><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-teal-500/15 text-teal-300"><Gamepad2 size={28} /></div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-teal-300">Game invitation</p><h2 className="mb-2 text-2xl font-black">Join {pendingGameRoom.quiz?.title || 'this quiz'}?</h2><p className={`mb-5 text-sm ${muted}`}>Invited by {pendingGameRoom.creatorName || 'a Quiz Arena player'}. There {pendingGameRoom.players?.length === 1 ? 'is' : 'are'} {pendingGameRoom.players?.length || 1} player{(pendingGameRoom.players?.length || 1) === 1 ? '' : 's'} in this room. Accept to join the player list and access the live game chat.</p><div className="mb-5 flex flex-wrap gap-2">{(pendingGameRoom.players || []).map((player) => <span key={player.uid} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold">{player.name}{player.uid === pendingGameRoom.creatorId ? ' · Host' : ''}</span>)}</div><div className="flex flex-wrap justify-end gap-3"><button onClick={declineGameInvitation} disabled={joiningGame} className={buttonSecondary}>Decline</button><button onClick={acceptGameInvitation} disabled={joiningGame} className={buttonPrimary}>{joiningGame ? 'Joining...' : 'Accept & join game'} <ChevronRight className="ml-1" size={17} /></button></div></div></div>}

    {showCreate && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"><div className={`${panel} mx-auto my-4 max-w-4xl rounded-3xl p-5 sm:my-8 sm:p-7`}>
      <div className="mb-7 flex items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-300"><Sparkles size={14} /> Quiz Creator Studio</div><h2 className="text-3xl font-black">Build your challenge</h2><p className={`mt-2 text-sm ${muted}`}>Create your own questions and choose the answer format.</p></div><button type="button" onClick={() => setShowCreate(false)} className={`rounded-xl p-2 ${muted} hover:bg-white/10`}><X size={22} /></button></div>
      <form onSubmit={createQuiz} className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="mb-2 block text-sm font-bold">Quiz title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ultimate IT Knowledge Challenge" maxLength={100} required className={`w-full rounded-xl border px-4 py-3 outline-none focus:border-cyan-400 ${field}`} /></div><div><label className="mb-2 block text-sm font-bold">Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full rounded-xl border px-4 py-3 ${field}`}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="mb-2 block text-sm font-bold">Difficulty</label><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`w-full rounded-xl border px-4 py-3 ${field}`}>{['Easy','Medium','Hard'].map((item) => <option key={item}>{item}</option>)}</select></div></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">Questions</h3><p className={`text-xs ${muted}`}>{newQuestions.length} question(s) added</p></div><button type="button" onClick={() => setNewQuestions((prev) => [...prev, emptyQuestion()])} className={buttonPrimary}><Plus size={17} className="mr-1" /> Add question</button></div>
      {newQuestions.map((q, qi) => <div key={q.id || qi} className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.07] to-violet-500/[0.04] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 font-black text-white">{String(qi + 1).padStart(2, '0')}</span><div><h4 className="font-black">Question {qi + 1}</h4><p className={`text-xs ${muted}`}>Choose question format</p></div></div>{newQuestions.length > 1 && <button type="button" onClick={() => setNewQuestions((prev) => prev.filter((_, i) => i !== qi))} className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"><Trash2 size={18} /></button>}</div>
      <textarea value={q.question} onChange={(e) => updateQuestion(qi, 'question', e.target.value)} placeholder="Type your question here..." rows={2} required className={`mb-4 w-full resize-y rounded-xl border px-4 py-3 outline-none focus:border-cyan-400 ${field}`} />
      <label className="mb-2 block text-sm font-bold">Question type</label><div className="mb-5 grid grid-cols-3 gap-2">{[{value:'multiple',label:'Multiple Choice'},{value:'boolean',label:'True / False'},{value:'identification',label:'Identification'}].map((item) => <button key={item.value} type="button" onClick={() => changeQuestionType(qi, item.value)} className={`rounded-xl border px-2 py-3 text-xs font-black transition sm:text-sm ${q.type === item.value ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300' : 'border-white/10 bg-white/[0.03] hover:border-cyan-400/50'}`}>{item.label}</button>)}</div>
      {q.type === 'identification' ? <div><label className="mb-2 block text-sm font-bold">Correct answer</label><input value={q.correctText} onChange={(e) => updateQuestion(qi, 'correctText', e.target.value)} placeholder="Enter the exact correct answer" required className={`w-full rounded-xl border px-4 py-3 outline-none focus:border-cyan-400 ${field}`} /><p className={`mt-2 text-xs ${muted}`}>Answers are checked without case sensitivity and ignore extra spaces.</p></div> : <><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{q.type === 'boolean' ? 'Select the correct answer' : 'Answer choices'}</p>{q.type === 'multiple' && <span className="text-xs text-cyan-300">Pick the correct option</span>}</div><div className="space-y-3">{q.options.map((option, oi) => <div key={oi} className="flex items-center gap-2"><button type="button" onClick={() => updateQuestion(qi, 'correctAnswer', oi)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-black ${q.correctAnswer === oi ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-slate-400'}`}>{q.correctAnswer === oi ? <Check size={18} /> : String.fromCharCode(65 + oi)}</button><input value={option} onChange={(e) => updateOption(qi, oi, e.target.value)} placeholder={q.type === 'boolean' ? option : `Enter choice ${String.fromCharCode(65 + oi)}`} readOnly={q.type === 'boolean'} required className={`min-w-0 flex-1 rounded-xl border px-3 py-3 outline-none focus:border-cyan-400 ${field} ${q.type === 'boolean' ? 'opacity-80' : ''}`} /></div>)}</div>
      {q.type === 'multiple' && <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-cyan-300"><Sparkles size={13} className="mr-1 inline" /> Reusable Choice Library</p><span className={`text-[10px] ${muted}`}>{savedChoices.length} saved</span></div><input value={choiceSearch} onChange={(e) => setChoiceSearch(e.target.value)} placeholder="Search choices you used before..." className={`mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-cyan-400 ${field}`} /><div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{savedChoices.filter((choice) => choice.toLowerCase().includes(choiceSearch.toLowerCase())).map((choice) => <button key={choice} type="button" onClick={() => { const emptyIndex = q.options.findIndex((item) => !item.trim()); updateOption(qi, emptyIndex >= 0 ? emptyIndex : 0, choice) }} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20">+ {choice}</button>)}{savedChoices.length === 0 && <p className={`text-xs ${muted}`}>Choices you save in your quizzes will appear here.</p>}</div></div>}</>}
      <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-3 text-xs text-emerald-300"><CheckCircle2 size={14} className="mr-1 inline" /> Correct answer: {q.type === 'identification' ? (q.correctText || 'Not entered') : (q.options[q.correctAnswer] || 'Not selected')}</div></div>)}
      <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 pt-5"><button type="button" onClick={() => setShowCreate(false)} className={buttonSecondary}>Cancel</button><button type="submit" disabled={saving} className={buttonPrimary}>{saving ? 'Saving quiz...' : <><Zap size={17} className="mr-2" /> Save Quiz</>}</button></div></form></div></div>}

    {notice && <div className="fixed bottom-5 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#211a35] px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-black/40"><Sparkles className="shrink-0 text-teal-300" size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={16} /></button></div>}
  </div>
}
