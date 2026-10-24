import { describe, expect, it } from 'vitest'
import {
  BOARD_SIZE,
  canPlace,
  canPlaceAnywhere,
  clearCompletedLines,
  createEmptyBoard,
  findCompletedLines,
  findValidAnchors,
  generateBatch,
  hasAvailableMove,
  placePiece,
  scoreClear,
} from './game'

const O_PIECE = [
  [1, 1],
  [1, 1],
]

describe('board placement', () => {
  it('creates an empty 8x8 board', () => {
    const board = createEmptyBoard()
    expect(board).toHaveLength(BOARD_SIZE)
    expect(board.every((row) => row.length === BOARD_SIZE)).toBe(true)
    expect(board.flat().every((cell) => cell === null)).toBe(true)
  })

  it('accepts valid placements and rejects out-of-bounds spots', () => {
    const board = createEmptyBoard()
    expect(canPlace(board, O_PIECE, 0, 0)).toBe(true)
    expect(canPlace(board, O_PIECE, 6, 6)).toBe(true)
    expect(canPlace(board, O_PIECE, 7, 7)).toBe(false)
    expect(canPlace(board, O_PIECE, -1, 0)).toBe(false)
    expect(canPlace(board, O_PIECE, 0, 7)).toBe(false)
  })

  it('rejects overlaps', () => {
    const board = createEmptyBoard()
    board[1][1] = 'cyan'
    expect(canPlace(board, O_PIECE, 0, 0)).toBe(false)
    expect(canPlace(board, O_PIECE, 2, 2)).toBe(true)
  })

  it('requires an empty top-left origin even for shapes with an empty corner', () => {
    const tPiece = [
      [0, 1, 0],
      [1, 1, 1],
    ]
    const board = createEmptyBoard()
    board[0][0] = 'rose'

    expect(canPlace(board, tPiece, 0, 0)).toBe(false)
    board[0][0] = null
    expect(canPlace(board, tPiece, 0, 0)).toBe(true)
  })

  it('places a piece without mutating the source board', () => {
    const board = createEmptyBoard()
    const next = placePiece(board, O_PIECE, 3, 4, 'yellow')

    expect(next).not.toBeNull()
    expect(next[3][4]).toBe('yellow')
    expect(next[4][5]).toBe('yellow')
    expect(board[3][4]).toBeNull()
    expect(placePiece(board, O_PIECE, 7, 7, 'yellow')).toBeNull()
  })
})

describe('line clearing', () => {
  it('detects completed rows and columns', () => {
    const board = createEmptyBoard()
    board[2] = Array(BOARD_SIZE).fill('cyan')
    for (let row = 0; row < BOARD_SIZE; row += 1) board[row][5] = 'rose'

    const lines = findCompletedLines(board)
    expect(lines.rows).toEqual([2])
    expect(lines.cols).toEqual([5])
    expect(lines.count).toBe(2)
  })

  it('clears intersecting rows and columns', () => {
    const board = createEmptyBoard()
    board[0] = Array(BOARD_SIZE).fill('lime')
    for (let row = 0; row < BOARD_SIZE; row += 1) board[row][3] = 'violet'
    board[7][7] = 'orange'

    const cleared = clearCompletedLines(board, [0], [3])
    expect(cleared[0].every((cell) => cell === null)).toBe(true)
    expect(cleared.every((row) => row[3] === null)).toBe(true)
    expect(cleared[7][7]).toBe('orange')
    expect(board[0][0]).toBe('lime')
  })
})

describe('scoring', () => {
  it('doubles simultaneous line clears', () => {
    expect(scoreClear(0, 1)).toBe(0)
    expect(scoreClear(1, 1)).toBe(100)
    expect(scoreClear(2, 1)).toBe(400)
    expect(scoreClear(3, 1)).toBe(1200)
    expect(scoreClear(4, 1)).toBe(3200)
  })

  it('doubles back-to-back clears and caps the combo at x8', () => {
    expect(scoreClear(1, 2)).toBe(200)
    expect(scoreClear(1, 3)).toBe(400)
    expect(scoreClear(1, 4)).toBe(800)
    expect(scoreClear(1, 9)).toBe(800)
  })
})

describe('piece generation and move search', () => {
  it('generates three different shapes', () => {
    let seed = 123456
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    const pieces = generateBatch(3, random)
    expect(pieces).toHaveLength(3)
    expect(new Set(pieces.map((piece) => piece.shapeId)).size).toBe(3)
    for (const piece of pieces) {
      expect(piece.matrix.flat().filter(Boolean)).toHaveLength(4)
      expect(piece.width).toBe(piece.matrix[0].length)
      expect(piece.height).toBe(piece.matrix.length)
    }
  })

  it('finds valid anchors on an empty board', () => {
    const anchors = findValidAnchors(createEmptyBoard(), O_PIECE)
    expect(anchors).toHaveLength(49)
    expect(anchors[0]).toEqual({ row: 0, col: 0 })
  })

  it('detects when a piece has no space and the board has no moves', () => {
    const board = createEmptyBoard(4)
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        if ((row + col) % 2 === 0) board[row][col] = 'blue'
      }
    }

    expect(canPlaceAnywhere(board, O_PIECE)).toBe(false)
    expect(
      hasAvailableMove(board, [
        { matrix: O_PIECE },
        { matrix: [[1]] },
      ]),
    ).toBe(true)
    expect(hasAvailableMove(board, [{ matrix: O_PIECE }])).toBe(false)
  })
})
