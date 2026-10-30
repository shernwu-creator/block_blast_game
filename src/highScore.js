export const HIGH_SCORE_KEY = 'blockBlastHighScore'
export const EXTENDED_HIGH_SCORE_KEY = 'blockBlastHighScore10'
const LEGACY_HIGH_SCORE_KEY = 'block-blast-best-score'
const DEFAULT_BOARD_SIZE = 8

/**
 * The classic 8×8 mode keeps the original key so records earned before the
 * extended mode existed are preserved. The 10×10 mode gets its own key, so the
 * two boards never overwrite each other's best score.
 */
export function highScoreKeyFor(boardSize = DEFAULT_BOARD_SIZE) {
  return boardSize === 10 ? EXTENDED_HIGH_SCORE_KEY : HIGH_SCORE_KEY
}

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

export function readHighScore(boardSize = DEFAULT_BOARD_SIZE, storage) {
  const target = resolveStorage(storage)
  if (!target) return 0

  const key = highScoreKeyFor(boardSize)

  try {
    const current = parseScore(target.getItem(key))
    if (current !== null) return current

    // Preserve records earned in the first release of the game (8×8 only).
    if (key === HIGH_SCORE_KEY) {
      const legacy = parseScore(target.getItem(LEGACY_HIGH_SCORE_KEY))
      if (legacy !== null) {
        target.setItem(HIGH_SCORE_KEY, String(legacy))
        return legacy
      }
    }
  } catch {
    // Storage can be blocked in private or hardened browser contexts.
  }

  return 0
}

export function persistHighScore(
  score,
  boardSize = DEFAULT_BOARD_SIZE,
  storage,
) {
  const target = resolveStorage(storage)
  if (!target) return false

  try {
    target.setItem(
      highScoreKeyFor(boardSize),
      String(Math.max(0, Math.floor(score))),
    )
    return true
  } catch {
    return false
  }
}
