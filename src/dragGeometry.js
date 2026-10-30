import { canPlace } from './game'

/**
 * Reads the visible board geometry from the rendered grid (8×8 or 10×10).
 * Using the actual DOM rects keeps drop calculations correct on every screen
 * size, and `boardSize` makes the last-cell lookup independent of a fixed size.
 */
export function readBoardMetrics(gridElement, boardSize = 8) {
  if (!gridElement) return null

  const totalCells = boardSize * boardSize
  const cells = gridElement.querySelectorAll('.board-cell')
  if (cells.length < totalCells) return null

  const first = cells[0].getBoundingClientRect()
  const second = cells[1].getBoundingClientRect()
  const nextRow = cells[boardSize].getBoundingClientRect()
  const last = cells[totalCells - 1].getBoundingClientRect()

  const pitchX = second.left - first.left
  const pitchY = nextRow.top - first.top
  if (pitchX <= 0 || pitchY <= 0) return null

  return {
    left: first.left,
    top: first.top,
    right: last.right,
    bottom: last.bottom,
    pitchX,
    pitchY,
  }
}

/**
 * Maps the centre of the dragged piece onto the board. The result is the
 * top-left anchor of the piece plus whether placement is legal there.
 */
export function calculateDropAnchor({ board, piece, pieceRect, metrics }) {
  if (!piece || !pieceRect || !metrics || !board.length) return null

  const centerX = pieceRect.left + pieceRect.width / 2
  const centerY = pieceRect.top + pieceRect.height / 2

  if (
    centerX < metrics.left ||
    centerX > metrics.right ||
    centerY < metrics.top ||
    centerY > metrics.bottom
  ) {
    return null
  }

  const col = Math.round(
    (centerX - metrics.left) / metrics.pitchX - piece.width / 2,
  )
  const row = Math.round(
    (centerY - metrics.top) / metrics.pitchY - piece.height / 2,
  )

  return {
    row,
    col,
    valid: canPlace(board, piece.matrix, row, col),
  }
}
