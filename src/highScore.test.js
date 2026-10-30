import { describe, expect, it } from 'vitest'
import {
  EXTENDED_HIGH_SCORE_KEY,
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
  it('reads the blockBlastHighScore key for the classic board', () => {
    const storage = createStorage({ [HIGH_SCORE_KEY]: '4200' })
    expect(readHighScore(8, storage)).toBe(4200)
  })

  it('persists a new high score to the classic key', () => {
    const storage = createStorage()
    expect(persistHighScore(314, 8, storage)).toBe(true)
    expect(storage.value(HIGH_SCORE_KEY)).toBe('314')
  })

  it('keeps the 10x10 record in its own key', () => {
    const storage = createStorage({
      [HIGH_SCORE_KEY]: '4200',
      [EXTENDED_HIGH_SCORE_KEY]: '7800',
    })

    expect(readHighScore(8, storage)).toBe(4200)
    expect(readHighScore(10, storage)).toBe(7800)
  })

  it('does not overwrite the classic record when persisting a 10x10 score', () => {
    const storage = createStorage({ [HIGH_SCORE_KEY]: '4200' })
    expect(persistHighScore(900, 10, storage)).toBe(true)

    expect(storage.value(EXTENDED_HIGH_SCORE_KEY)).toBe('900')
    expect(storage.value(HIGH_SCORE_KEY)).toBe('4200')
  })

  it('starts the 10x10 record at zero without reusing the classic score', () => {
    const storage = createStorage({ [HIGH_SCORE_KEY]: '4200' })
    expect(readHighScore(10, storage)).toBe(0)
  })

  it('migrates the legacy best-score key for the classic board only', () => {
    const storage = createStorage({ 'block-blast-best-score': '1300' })
    expect(readHighScore(8, storage)).toBe(1300)
    expect(storage.value(HIGH_SCORE_KEY)).toBe('1300')
    expect(readHighScore(10, storage)).toBe(0)
  })

  it('falls back safely when storage is unavailable or malformed', () => {
    expect(readHighScore(8)).toBe(0)
    expect(readHighScore(10, null)).toBe(0)
    expect(readHighScore(8, createStorage({ [HIGH_SCORE_KEY]: 'oops' }))).toBe(0)
    expect(readHighScore(10, createStorage({ [EXTENDED_HIGH_SCORE_KEY]: 'x' }))).toBe(0)
  })
})
