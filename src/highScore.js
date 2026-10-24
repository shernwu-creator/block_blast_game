export const HIGH_SCORE_KEY = 'blockBlastHighScore'
const LEGACY_HIGH_SCORE_KEY = 'block-blast-best-score'

function resolveStorage(storage) {
  if (storage) return storage
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function parseScore(rawValue) {
  if (rawValue === null) return null
  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function readHighScore(storage) {
  const target = resolveStorage(storage)
  if (!target) return 0

  try {
    const current = parseScore(target.getItem(HIGH_SCORE_KEY))
    if (current !== null) return current

    // Preserve records earned in the first release of the game.
    const legacy = parseScore(target.getItem(LEGACY_HIGH_SCORE_KEY))
    if (legacy !== null) {
      target.setItem(HIGH_SCORE_KEY, String(legacy))
      return legacy
    }
  } catch {
    // Storage can be blocked in private or hardened browser contexts.
  }

  return 0
}

export function persistHighScore(score, storage) {
  const target = resolveStorage(storage)
  if (!target) return false

  try {
    target.setItem(HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))))
    return true
  } catch {
    return false
  }
}
