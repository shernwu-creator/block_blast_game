import { describe, expect, it } from 'vitest'
import {
  HIGH_SCORE_KEY,
  persistHighScore,
  readHighScore,
} from './highScore'

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    value(key) {
      return values.get(key)
    },
  }
}

describe('high score storage', () => {
  it('reads the blockBlastHighScore key', () => {
    const storage = createStorage({ [HIGH_SCORE_KEY]: '4200' })
    expect(readHighScore(storage)).toBe(4200)
  })

  it('persists a new high score to the requested key', () => {
    const storage = createStorage()
    expect(persistHighScore(314, storage)).toBe(true)
    expect(storage.value(HIGH_SCORE_KEY)).toBe('314')
  })

  it('migrates the legacy best-score key', () => {
    const storage = createStorage({ 'block-blast-best-score': '1300' })
    expect(readHighScore(storage)).toBe(1300)
    expect(storage.value(HIGH_SCORE_KEY)).toBe('1300')
  })

  it('falls back safely when storage is unavailable or malformed', () => {
    expect(readHighScore(null)).toBe(0)
    expect(readHighScore(createStorage({ [HIGH_SCORE_KEY]: 'oops' }))).toBe(0)
  })
})
