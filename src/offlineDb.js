
const DB_NAME = 'quiz-arena-offline'
const DB_VERSION = 1

const STORES = {
  quizzes: 'quizzes',
  choices: 'choices',
  results: 'results',
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORES.quizzes)) {
        const store = db.createObjectStore(STORES.quizzes, {
          keyPath: 'localId',
        })
        store.createIndex('ownerId', 'ownerId', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.choices)) {
        const store = db.createObjectStore(STORES.choices, {
          keyPath: 'id',
        })
        store.createIndex('ownerId', 'ownerId', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.results)) {
        const store = db.createObjectStore(STORES.results, {
          keyPath: 'localId',
        })
        store.createIndex('ownerId', 'ownerId', { unique: false })
      }
    }

    request.onsuccess = () => {
      const db = request.result

      db.onversionchange = () => db.close()
      resolve(db)
    }

    request.onerror = () => {
      reject(request.error || new Error('Unable to open offline database.'))
    }

    request.onblocked = () => {
      reject(new Error('Database upgrade is blocked. Close other Quiz Arena tabs.'))
    }
  })
}

async function runTransaction(storeName, mode, operation) {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    let result
    let request

    try {
      const transaction = db.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)

      result = operation(store)
      request = result && typeof result === 'object' && 'result' in result
        ? result
        : null

      transaction.oncomplete = () => {
        db.close()
        resolve(request ? request.result : result)
      }

      transaction.onerror = () => {
        db.close()
        reject(transaction.error || new Error('Database transaction failed.'))
      }

      transaction.onabort = () => {
        db.close()
        reject(transaction.error || new Error('Database transaction was aborted.'))
      }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

async function getByOwner(storeName, ownerId) {
  if (!ownerId) return []

  return runTransaction(storeName, 'readonly', (store) =>
    store.index('ownerId').getAll(ownerId)
  )
}

async function updateRecord(storeName, ownerId, localId, changes) {
  if (!ownerId || !localId) return null

  const existing = await runTransaction(
    storeName,
    'readonly',
    (store) => store.get(localId)
  )

  if (!existing || existing.ownerId !== ownerId) return null

  const updated = {
    ...existing,
    ...changes,
  }

  await runTransaction(storeName, 'readwrite', (store) =>
    store.put(updated)
  )

  return updated
}

// ==========================================
// QUIZZES
// ==========================================

export async function getLocalQuizzes(ownerId) {
  return getByOwner(STORES.quizzes, ownerId)
}

export async function getPendingLocalQuizzes(ownerId) {
  const quizzes = await getLocalQuizzes(ownerId)

  return quizzes.filter((quiz) => quiz.syncStatus !== 'synced')
}

export async function saveLocalQuiz(ownerId, quiz) {
  if (!ownerId || !quiz) {
    throw new Error('Account and quiz are required.')
  }

  const localId = quiz.localId || quiz.id || createId()

  const record = {
    ...quiz,
    localId,
    ownerId,
    updatedAtLocal: Date.now(),
    syncStatus: quiz.syncStatus || 'pending',
  }

  await runTransaction(STORES.quizzes, 'readwrite', (store) =>
    store.put(record)
  )

  return record
}

export async function markLocalQuizSynced(ownerId, localId, cloudId) {
  return updateRecord(STORES.quizzes, ownerId, localId, {
    id: cloudId || localId,
    syncStatus: 'synced',
    syncedAtLocal: Date.now(),
  })
}

export async function deleteLocalQuiz(ownerId, localId) {
  if (!ownerId || !localId) return

  const existing = await runTransaction(
    STORES.quizzes,
    'readonly',
    (store) => store.get(localId)
  )

  if (!existing || existing.ownerId !== ownerId) return

  await runTransaction(STORES.quizzes, 'readwrite', (store) =>
    store.delete(localId)
  )
}

// ==========================================
// REUSABLE ANSWER CHOICES
// ==========================================

export async function getLocalChoices(ownerId) {
  return getByOwner(STORES.choices, ownerId)
}

export async function saveLocalChoice(ownerId, label) {
  const cleanLabel = label?.trim()

  if (!ownerId || !cleanLabel) return null

  const choices = await getLocalChoices(ownerId)

  const existing = choices.find(
    (choice) =>
      choice.label.toLowerCase() === cleanLabel.toLowerCase()
  )

  if (existing) return existing

  const record = {
    id: `${ownerId}_${createId()}`,
    ownerId,
    label: cleanLabel,
    createdAtLocal: Date.now(),
  }

  await runTransaction(STORES.choices, 'readwrite', (store) =>
    store.put(record)
  )

  return record
}

export async function saveLocalChoices(ownerId, labels) {
  if (!ownerId || !Array.isArray(labels)) return []

  const saved = []

  for (const label of labels) {
    const choice = await saveLocalChoice(ownerId, label)

    if (choice) saved.push(choice)
  }

  return saved
}

// ==========================================
// QUIZ RESULTS
// ==========================================

export async function getLocalResults(ownerId) {
  return getByOwner(STORES.results, ownerId)
}

export async function getPendingLocalResults(ownerId) {
  const results = await getLocalResults(ownerId)

  return results.filter((result) => result.syncStatus !== 'synced')
}

export async function saveLocalResult(ownerId, result) {
  if (!ownerId || !result) {
    throw new Error('Account and result are required.')
  }

  const record = {
    ...result,
    localId: result.localId || createId(),
    ownerId,
    createdAtLocal: result.createdAtLocal || Date.now(),
    syncStatus: result.syncStatus || 'pending',
  }

  await runTransaction(STORES.results, 'readwrite', (store) =>
    store.put(record)
  )

  return record
}

export async function markLocalResultSynced(ownerId, localId, cloudId) {
  return updateRecord(STORES.results, ownerId, localId, {
    id: cloudId || localId,
    syncStatus: 'synced',
    syncedAtLocal: Date.now(),
  })
}
