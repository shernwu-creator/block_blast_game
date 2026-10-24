import { describe, expect, it } from 'vitest'
import { calculateDropAnchor } from './dragGeometry'
import { createEmptyBoard } from './game'

const metrics = {
  left: 0,
  top: 0,
  right: 320,
  bottom: 320,
  pitchX: 40,
  pitchY: 40,
}

const squarePiece = {
  matrix: [
    [1, 1],
    [1, 1],
  ],
  width: 2,
  height: 2,
}

const linePiece = {
  matrix: [[1, 1, 1, 1]],
  width: 4,
  height: 1,
}

describe('drag drop geometry', () => {
  it('maps the centre of a dragged piece to the nearest board anchor', () => {
    const board = createEmptyBoard()
    const result = calculateDropAnchor({
      board,
      piece: squarePiece,
      pieceRect: { left: 120, top: 120, width: 80, height: 80 },
      metrics,
    })

    expect(result).toEqual({ row: 3, col: 3, valid: true })
  })

  it('rejects drops whose centre is outside the board', () => {
    const board = createEmptyBoard()
    const result = calculateDropAnchor({
      board,
      piece: squarePiece,
      pieceRect: { left: 340, top: 40, width: 80, height: 80 },
      metrics,
    })

    expect(result).toBeNull()
  })

  it('marks anchors invalid when the piece would leave the board', () => {
    const board = createEmptyBoard()
    const result = calculateDropAnchor({
      board,
      piece: linePiece,
      pieceRect: { left: 200, top: 20, width: 160, height: 40 },
      metrics,
    })

    expect(result).toMatchObject({ valid: false })
  })

  it('marks anchors invalid when the target cells are occupied', () => {
    const board = createEmptyBoard()
    board[3][3] = 'cyan'
    const result = calculateDropAnchor({
      board,
      piece: squarePiece,
      pieceRect: { left: 120, top: 120, width: 80, height: 80 },
      metrics,
    })

    expect(result).toEqual({ row: 3, col: 3, valid: false })
  })
})
