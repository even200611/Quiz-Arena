
import { initializeApp, getApp, getApps } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAjmO-PsBnsn--LwBwlXwCeumnB6EqLQ_4",
  authDomain: "quiz-arena-3daea.firebaseapp.com",
  projectId: "quiz-arena-3daea",
  storageBucket: "quiz-arena-3daea.firebasestorage.app",
  messagingSenderId: "934410019189",
  appId: "1:934410019189:web:d63c8749aa64b05b0bf33c",
  measurementId: "G-4YXZRBB7Y9",
}

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Authentication
export const auth = getAuth(app)

// Keep the signed-in session on this browser
export const authPersistence = setPersistence(
  auth,
  browserLocalPersistence
)

// Firestore with persistent offline cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
