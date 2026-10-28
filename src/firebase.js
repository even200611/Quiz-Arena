
import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAjmO-PsBnsn--LwBwlXwCeumnB6EqLQ_4",
  authDomain: "quiz-arena-3daea.firebaseapp.com",
  projectId: "quiz-arena-3daea",
  storageBucket: "quiz-arena-3daea.firebasestorage.app",
  messagingSenderId: "934410019189",
  appId: "1:934410019189:web:d63c8749aa64b05b0bf33c",
  measurementId: "G-4YXZRBB7Y9"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export const authPersistence = setPersistence(
  auth,
  browserLocalPersistence
)
