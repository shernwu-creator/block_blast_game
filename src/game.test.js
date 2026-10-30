import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOARD_SIZE,
  canPlace,
  canPlaceAnywhere,
  clearCompletedLines,
  createEmptyBoard,
  findCompletedLines,
  findValidAnchors,
  generateBatch,
  hasAvailableMove,
  placePiece,
  replaceUsedPiece,
  scoreClear,
} from './game'

const O_PIECE = [
  [1, 1],
  [1, 1],
]

describe('board placement', () => {
  it('creates an empty 8x8 board by default', () => {
    const board = createEmptyBoard()
    expect(board).toHaveLength(DEFAULT_BOARD_SIZE)
    expect(board.every((row) => row.length === DEFAULT_BOARD_SIZE)).toBe(true)
    expect(board.flat().every((cell) => cell === null)).toBe(true)
  })

  it('creates a 10x10 board when a larger size is requested', () => {
    const board = createEmptyBoard(10)
    expect(board).toHaveLength(10)
    expect(board.every((row) => row.length === 10)).toBe(true)
    expect(board.flat().every((cell) => cell === null)).toBe(true)
    expect(canPlace(board, O_PIECE, 8, 8)).toBe(true)
    expect(canPlace(board, O_PIECE, 9, 9)).toBe(false)
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

  it('ignores transparent matrix cells when checking collisions', () => {
    const tPiece = [
      [0, 1, 0],
      [1, 1, 1],
    ]
    const board = createEmptyBoard()
    board[0][0] = 'rose'

    expect(canPlace(board, tPiece, 0, 0)).toBe(true)

    const placed = placePiece(board, tPiece, 0, 0, 'violet')
    expect(placed[0][0]).toBe('rose')
    expect(placed[0][1]).toBe('violet')
    expect(placed[1][0]).toBe('violet')
  })

  it('does not reject valid placements for transparent cells outside the board', () => {
    const sparsePiece = [
      [1, 0],
      [0, 0],
    ]
    const board = createEmptyBoard(2)

    expect(canPlace(board, sparsePiece, 1, 1)).toBe(true)
    expect(canPlace(board, sparsePiece, 2, 0)).toBe(false)
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
    const size = board.length
    board[2] = Array(size).fill('cyan')
    for (let row = 0; row < size; row += 1) board[row][5] = 'rose'

    const lines = findCompletedLines(board)
    expect(lines.rows).toEqual([2])
    expect(lines.cols).toEqual([5])
    expect(lines.count).toBe(2)
  })

  it('detects completed lines on a 10x10 board', () => {
    const board = createEmptyBoard(10)
    const size = board.length
    board[9] = Array(size).fill('cyan')
    for (let row = 0; row < size; row += 1) board[row][8] = 'rose'

    const lines = findCompletedLines(board)
    expect(lines.rows).toEqual([9])
    expect(lines.cols).toEqual([8])
    expect(lines.count).toBe(2)
  })

  it('clears intersecting rows and columns', () => {
    const board = createEmptyBoard()
    const size = board.length
    board[0] = Array(size).fill('lime')
    for (let row = 0; row < size; row += 1) board[row][3] = 'violet'
    board[7][7] = 'orange'

    const cleared = clearCompletedLines(board, [0], [3])
    expect(cleared[0].every((cell) => cell === null)).toBe(true)
    expect(cleared.every((row) => row[3] === null)).toBe(true)
    expect(cleared[7][7]).toBe('orange')
    expect(board[0][0]).toBe('lime')
  })

  it('clears a full row on a 10x10 board without touching other rows', () => {
    const board = createEmptyBoard(10)
    const size = board.length
    board[4] = Array(size).fill('violet')
    board[9][9] = 'orange'

    const cleared = clearCompletedLines(board, [4], [])
    expect(cleared[4].every((cell) => cell === null)).toBe(true)
    expect(cleared[9][9]).toBe('orange')
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

  it('finds valid anchors on an empty 10x10 board', () => {
    const anchors = findValidAnchors(createEmptyBoard(10), O_PIECE)
    expect(anchors).toHaveLength(81)
    expect(anchors.at(-1)).toEqual({ row: 8, col: 8 })
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

  it('replaces only the used tray slot to keep three pieces available', () => {
    let seed = 98765
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }

    const original = generateBatch(3, random)
    const used = original[1]
    const next = replaceUsedPiece(original, used.id, random)

    expect(next).toHaveLength(3)
    expect(next[1].id).not.toBe(used.id)
    expect(next[0]).toBe(original[0])
    expect(next[2]).toBe(original[2])
    expect(next.every(Boolean)).toBe(true)
  })
})
