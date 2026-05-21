import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'

let _db: Firestore | null = null
let _auth: Auth | null = null
let _app: App | null = null

function init(): boolean {
  if (_db && _auth) return true

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) return false

  try {
    _app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
    _db = getFirestore(_app)
    _auth = getAuth(_app)
    return true
  } catch {
    return false
  }
}

export function getDb(): Firestore {
  if (!init()) throw new Error('Firebase no configurado — verifica las variables FIREBASE_*')
  return _db!
}

export function getAdminAuth(): Auth {
  if (!init()) throw new Error('Firebase no configurado — verifica las variables FIREBASE_*')
  return _auth!
}
