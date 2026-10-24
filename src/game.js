export const BOARD_SIZE = 8
export const BATCH_SIZE = 3

export const PIECE_COLORS = {
  cyan: {
    light: '#a5f3fc',
    base: '#22d3ee',
    dark: '#0e7490',
    glow: 'rgba(34, 211, 238, 0.52)',
  },
  yellow: {
    light: '#fef08a',
    base: '#facc15',
    dark: '#a16207',
    glow: 'rgba(250, 204, 21, 0.48)',
  },
  violet: {
    light: '#e9d5ff',
    base: '#c084fc',
    dark: '#7e22ce',
    glow: 'rgba(192, 132, 252, 0.5)',
  },
  lime: {
    light: '#d9f99d',
    base: '#a3e635',
    dark: '#4d7c0f',
    glow: 'rgba(163, 230, 53, 0.46)',
  },
  rose: {
    light: '#fecdd3',
    base: '#fb7185',
    dark: '#be123c',
    glow: 'rgba(251, 113, 133, 0.48)',
  },
  blue: {
    light: '#bfdbfe',
    base: '#60a5fa',
    dark: '#1d4ed8',
    glow: 'rgba(96, 165, 250, 0.5)',
  },
  orange: {
    light: '#fed7aa',
    base: '#fb923c',
    dark: '#c2410c',
    glow: 'rgba(251, 146, 60, 0.5)',
  },
}

const SHAPES = [
  {
    id: 'i',
    label: 'I',
    color: 'cyan',
    rotations: [
      [[1, 1, 1, 1]],
      [[1], [1], [1], [1]],
    ],
  },
  {
    id: 'o',
    label: 'O',
    color: 'yellow',
    rotations: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
  },
  {
    id: 't',
    label: 'T',
    color: 'violet',
    rotations: [
      [
        [0, 1, 0],
        [1, 1, 1],
      ],
      [
        [1, 0],
        [1, 1],
        [1, 0],
      ],
      [
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1],
        [1, 1],
        [0, 1],
      ],
    ],
  },
  {
    id: 's',
    label: 'S',
    color: 'lime',
    rotations: [
      [
        [0, 1, 1],
        [1, 1, 0],
      ],
      [
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
  },
  {
    id: 'z',
    label: 'Z',
    color: 'rose',
    rotations: [
      [
        [1, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 1],
        [1, 1],
        [1, 0],
      ],
    ],
  },
  {
    id: 'j',
    label: 'J',
    color: 'blue',
    rotations: [
      [
        [1, 0, 0],
        [1, 1, 1],
      ],
      [
        [1, 1],
        [1, 0],
        [1, 0],
      ],
      [
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1],
        [0, 1],
        [1, 1],
      ],
    ],
  },
  {
    id: 'l',
    label: 'L',
    color: 'orange',
    rotations: [
      [
        [0, 0, 1],
        [1, 1, 1],
      ],
      [
        [1, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1],
        [0, 1],
        [0, 1],
      ],
    ],
  },
]

let pieceSequence = 0

function buildPiece(shape, rotationIndex) {
  const matrix = shape.rotations[rotationIndex].map((row) => [...row])
  pieceSequence += 1

  return {
    id: `${shape.id}-${pieceSequence}`,
    shapeId: shape.id,
    label: shape.label,
    color: shape.color,
    matrix,
    width: matrix[0].length,
    height: matrix.length,
  }
}

/**
 * Draws a batch of pieces with distinct base shapes but random rotations.
 * Using no duplicate base shapes keeps every tray varied and readable.
 */
export function generateBatch(count = BATCH_SIZE, random = Math.random) {
  const shapePool = [...SHAPES]
  const pieces = []

  while (pieces.length < count && shapePool.length > 0) {
    const shapeIndex = Math.min(
      shapePool.length - 1,
      Math.floor(random() * shapePool.length),
    )
    const [shape] = shapePool.splice(shapeIndex, 1)
    const rotationIndex = Math.min(
      shape.rotations.length - 1,
      Math.floor(random() * shape.rotations.length),
    )
    pieces.push(buildPiece(shape, rotationIndex))
  }

  return pieces
}

export function createEmptyBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(null))
}

export function cloneBoard(board) {
  return board.map((row) => [...row])
}

export function canPlace(board, matrix, row, col) {
  if (!board.length || !matrix.length) return false

  // Only solid cells participate in bounds and collision checks. Transparent
  // matrix cells may hang over the board edge or an occupied cell safely.
  for (let r = 0; r < matrix.length; r += 1) {
    const matrixRow = matrix[r]
    if (!matrixRow) continue

    for (let c = 0; c < matrixRow.length; c += 1) {
      if (!matrixRow[c]) continue

      const boardRow = row + r
      const boardCol = col + c
      if (
        boardRow < 0 ||
        boardRow >= board.length ||
        boardCol < 0 ||
        boardCol >= board[0].length ||
        board[boardRow][boardCol] !== null
      ) {
        return false
      }
    }
  }

  return true
}

export function placePiece(board, matrix, row, col, color) {
  if (!canPlace(board, matrix, row, col)) return null

  const next = cloneBoard(board)
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix[r].length; c += 1) {
      if (matrix[r][c]) next[row + r][col + c] = color
    }
  }

  return next
}

export function findCompletedLines(board) {
  const size = board.length
  const rows = []
  const cols = []

  for (let row = 0; row < size; row += 1) {
    if (board[row].length === size && board[row].every(Boolean)) rows.push(row)
  }

  for (let col = 0; col < size; col += 1) {
    let full = true
    for (let row = 0; row < size; row += 1) {
      if (!board[row][col]) {
        full = false
        break
      }
    }
    if (full) cols.push(col)
  }

  return { rows, cols, count: rows.length + cols.length }
}

export function clearCompletedLines(board, rows, cols) {
  const next = cloneBoard(board)
  const rowSet = new Set(rows)
  const colSet = new Set(cols)

  for (let row = 0; row < next.length; row += 1) {
    for (let col = 0; col < next[row].length; col += 1) {
      if (rowSet.has(row) || colSet.has(col)) next[row][col] = null
    }
  }

  return next
}

/**
 * A line is worth 100 points, and each extra simultaneous line doubles it.
 * Back-to-back clears add a combo multiplier, capped at x8.
 */
export function scoreClear(lineCount, combo = 1) {
  if (lineCount <= 0) return 0
  const simultaneousMultiplier = 2 ** (lineCount - 1)
  const comboMultiplier = Math.min(2 ** Math.max(combo - 1, 0), 8)
  return 100 * lineCount * simultaneousMultiplier * comboMultiplier
}

export function findValidAnchors(board, matrix) {
  const anchors = []
  if (!board.length || !matrix.length) return anchors

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[0].length; col += 1) {
      if (canPlace(board, matrix, row, col)) anchors.push({ row, col })
    }
  }

  return anchors
}

export function canPlaceAnywhere(board, matrix) {
  if (!board.length || !matrix.length) return false

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[0].length; col += 1) {
      if (canPlace(board, matrix, row, col)) return true
    }
  }

  return false
}

/**
 * Immediately replaces a consumed tray piece while preserving its slot. This
 * keeps the tray at three pieces after every successful placement.
 */
export function replaceUsedPiece(pieces, usedPieceId, random = Math.random) {
  const usedIndex = pieces.findIndex((piece) => piece?.id === usedPieceId)
  if (usedIndex === -1) return pieces

  const nextPieces = [...pieces]
  nextPieces[usedIndex] = generateBatch(1, random)[0]
  return nextPieces
}

export function hasAvailableMove(board, pieces) {
  const activePieces = pieces.filter(Boolean)
  if (activePieces.length === 0) return true
  return activePieces.some((piece) => canPlaceAnywhere(board, piece.matrix))
}
