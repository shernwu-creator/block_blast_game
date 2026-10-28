import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateDropAnchor, readBoardMetrics } from './dragGeometry'
import {
  BATCH_SIZE,
  BOARD_SIZE,
  PIECE_COLORS,
  canPlace,
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
import { persistHighScore, readHighScore } from './highScore'
import soundManager from './SoundManager'

const CLEAR_DELAY = 520
const EMPTY_LINES = { rows: [], cols: [] }
const DEFAULT_DRAG_SCALE = 2.2

const screenVariants = {
  initial: { opacity: 0, y: 20, filter: 'blur(7px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -16,
    filter: 'blur(5px)',
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
}

function formatScore(value) {
  return value.toLocaleString('en-US')
}

function blockStyle(color) {
  const palette = PIECE_COLORS[color] ?? PIECE_COLORS.cyan
  return {
    '--block-from': palette.light,
    '--block-base': palette.base,
    '--block-to': palette.dark,
    '--block-glow': palette.glow,
  }
}

function LogoMark({ large = false }) {
  return (
    <div
      className={`logo-mark grid shrink-0 grid-cols-2 gap-[3px] ${large ? 'is-large mx-auto' : ''}`}
      aria-hidden="true"
    >
      <span className="logo-block bg-cyan-300" />
      <span className="logo-block bg-fuchsia-400" />
      <span className="logo-block bg-lime-300" />
      <span className="logo-block bg-amber-300" />
    </div>
  )
}

function MiniPiece({ piece }) {
  return (
    <span
      className="piece-mini"
      style={{ gridTemplateColumns: `repeat(${piece.width}, var(--mini-cell))` }}
      aria-hidden="true"
    >
      {piece.matrix.flatMap((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <span
            key={`${rowIndex}-${colIndex}`}
            className={cell ? 'piece-mini-cell' : 'piece-mini-cell is-empty'}
            style={cell ? blockStyle(piece.color) : undefined}
          />
        )),
      )}
    </span>
  )
}

function FloatingShape({ matrix, color, className, delay = 0 }) {
  const width = matrix[0].length

  return (
    <motion.div
      aria-hidden="true"
      className={`menu-float pointer-events-none absolute ${className ?? ''}`}
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{
        opacity: 0.52,
        scale: 1,
        y: [0, -9, 0],
        rotate: [-7, -2, -7],
      }}
      transition={{
        opacity: { duration: 0.7, delay },
        scale: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
        y: {
          duration: 6.5,
          delay,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        rotate: {
          duration: 6.5,
          delay,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
    >
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${width}, 13px)` }}
      >
        {matrix.flatMap((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <span
              key={`${rowIndex}-${colIndex}`}
              className={cell ? 'menu-float-cell' : 'size-[13px]'}
              style={cell ? blockStyle(color) : undefined}
            />
          )),
        )}
      </div>
    </motion.div>
  )
}

function Screen({ name, className = '', children }) {
  return (
    <motion.main
      key={name}
      data-screen={name}
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`relative z-10 mx-auto flex min-h-[100svh] w-full flex-col justify-center px-4 py-6 sm:px-5 sm:py-7 ${className}`}
    >
      {children}
    </motion.main>
  )
}

function MenuScreen({ highScore, onStart }) {
  return (
    <Screen name="menu" className="max-w-[27rem]">
      <FloatingShape
        matrix={[
          [1, 1, 1],
          [0, 1, 0],
        ]}
        color="violet"
        className="top-[14%] left-[3%] hidden sm:block"
        delay={0.1}
      />
      <FloatingShape
        matrix={[
          [1, 0],
          [1, 0],
          [1, 1],
        ]}
        color="orange"
        className="right-[2%] bottom-[19%] hidden sm:block"
        delay={0.5}
      />
      <FloatingShape
        matrix={[[1, 1, 1, 1]]}
        color="cyan"
        className="bottom-[10%] left-[6%] hidden opacity-40 sm:block"
        delay={0.9}
      />

      <div className="relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <LogoMark large />
          <p className="menu-kicker mt-6">NEON PUZZLE · 8 × 8</p>
          <h1 className="font-display mt-3 text-[clamp(2.5rem,12vw,3.8rem)] leading-[0.92] font-black tracking-[0.03em] text-white">
            BLOCK
            <span className="title-gradient mt-1 block">BLAST</span>
          </h1>
          <p className="mt-4 text-sm font-bold tracking-[0.4em] text-cyan-100/75">
            方塊爆破
          </p>
          <p className="mx-auto mt-3 max-w-[19rem] text-xs leading-6 text-slate-400">
            拖曳霓虹方塊，填滿整行或整列。
            <br />
            連續消除，擊破你的最高分。
          </p>
        </motion.div>

        <motion.div
          className="high-score-panel mt-7"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-300">
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="m12 2.6 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.2l6.3-.9L12 2.6Z" />
              </svg>
            </span>
            <span className="text-left">
              <span className="block text-[9px] font-bold tracking-[0.2em] text-slate-500">
                歷史最高分
              </span>
              <span className="block text-[9px] tracking-[0.16em] text-amber-200/45">
                PERSONAL BEST
              </span>
            </span>
          </div>
          <span className="font-display text-xl font-bold tracking-[0.05em] text-amber-200">
            {formatScore(highScore)}
          </span>
        </motion.div>

        <motion.button
          type="button"
          onClick={onStart}
          className="start-button mt-6 w-full rounded-2xl px-5 py-4 font-display text-sm font-black tracking-[0.18em] text-[#03111f]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.42, ease: 'easeOut' }}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.975 }}
        >
          <span className="flex items-center justify-center gap-2.5">
            開始遊戲
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </motion.button>

        <motion.div
          className="mt-5 grid grid-cols-3 gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          {[
            ['01', '拖曳放置'],
            ['02', '填滿消除'],
            ['03', '連消加倍'],
          ].map(([number, label]) => (
            <div key={number} className="menu-rule">
              <span className="font-display block text-[8px] tracking-[0.18em] text-cyan-300/45">
                {number}
              </span>
              <span className="mt-1 block text-[9px] font-semibold tracking-[0.08em] text-slate-400">
                {label}
              </span>
            </div>
          ))}
        </motion.div>

        <p className="mt-6 text-[8px] font-semibold tracking-[0.24em] text-slate-600">
          FILL LINES · CHAIN COMBOS · KEEP GOING
        </p>
      </div>
    </Screen>
  )
}

function GameOverScreen({
  score,
  highScore,
  linesCleared,
  isNewHighScore,
  onRestart,
  onHome,
  restartRef,
}) {
  useEffect(() => {
    restartRef.current?.focus()
  }, [restartRef])

  return (
    <Screen name="gameover" className="max-w-[24rem]">
      <motion.div
        className="game-over-card relative w-full overflow-hidden rounded-[28px] border border-cyan-300/25 bg-[#07152e] px-6 pt-7 pb-6 text-center shadow-[0_30px_100px_-20px_rgba(34,211,238,0.45)]"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.45, ease: [0.18, 0.9, 0.28, 1.12] }}
      >
        <div className="game-over-halo" aria-hidden="true" />
        <div className="relative">
          <div
            className="mx-auto grid w-fit grid-cols-3 gap-1 rotate-[-4deg]"
            aria-hidden="true"
          >
            <span className="size-2.5 rounded-[2px] bg-cyan-300 shadow-[0_0_10px_#22d3ee]" />
            <span className="size-2.5 rounded-[2px] bg-fuchsia-400 shadow-[0_0_10px_#e879f9]" />
            <span className="size-2.5 rounded-[2px] bg-amber-300 shadow-[0_0_10px_#fcd34d]" />
            <span className="size-2.5 rounded-[2px] bg-lime-300 shadow-[0_0_10px_#bef264]" />
            <span className="size-2.5 rounded-[2px] bg-blue-400 shadow-[0_0_10px_#60a5fa]" />
            <span className="size-2.5 rounded-[2px] bg-rose-400 shadow-[0_0_10px_#fb7185]" />
          </div>

          <p className="font-display mt-4 text-[9px] font-bold tracking-[0.32em] text-cyan-200/55">
            GAME OVER
          </p>
          <h1 className="font-display mt-1 text-3xl font-black tracking-[0.06em] text-white">
            遊戲結束
          </h1>

          {isNewHighScore ? (
            <motion.div
              className="new-high-badge mt-3"
              initial={{ opacity: 0, scale: 0.7, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.32, type: 'spring', stiffness: 360, damping: 18 }}
            >
              <span aria-hidden="true">★</span> New High Score!
            </motion.div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              方塊已無處可放，再挑戰一次吧。
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#040e21] px-4 py-3.5">
            <p className="text-[8px] font-bold tracking-[0.28em] text-slate-500">
              FINAL SCORE
            </p>
            <p className="font-display mt-1 text-[2.35rem] leading-none font-black tracking-tight text-cyan-200 [text-shadow:0_0_28px_rgba(34,211,238,0.4)]">
              {formatScore(score)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
              <div>
                <p className="text-[8px] tracking-[0.16em] text-slate-500">
                  最高分 BEST
                </p>
                <p className="font-display mt-0.5 text-sm font-bold text-amber-200">
                  {formatScore(highScore)}
                </p>
              </div>
              <div>
                <p className="text-[8px] tracking-[0.16em] text-slate-500">
                  消除行數 LINES
                </p>
                <p className="font-display mt-0.5 text-sm font-bold text-fuchsia-200">
                  {formatScore(linesCleared)}
                </p>
              </div>
            </div>
          </div>

          <motion.button
            ref={restartRef}
            type="button"
            onClick={onRestart}
            className="restart-button mt-4 w-full rounded-xl px-4 py-3 font-display text-xs font-bold tracking-[0.18em] text-[#03111f] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98 }}
          >
            再玩一次
          </motion.button>

          <button
            type="button"
            onClick={onHome}
            className="mt-2.5 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-[10px] font-bold tracking-[0.16em] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.07] hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 active:scale-[0.99]"
          >
            回首頁
          </button>
          <p className="mt-3 text-[8px] tracking-[0.16em] text-slate-600">
            CLEAR LINES · BUILD COMBOS
          </p>
        </div>
      </motion.div>
    </Screen>
  )
}

function App() {
  const [gameState, setGameState] = useState('menu')
  const [board, setBoard] = useState(createEmptyBoard)
  const [pieces, setPieces] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(readHighScore)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [combo, setCombo] = useState(0)
  const [linesCleared, setLinesCleared] = useState(0)
  const [isClearing, setIsClearing] = useState(false)
  const [clearingLines, setClearingLines] = useState(EMPTY_LINES)
  const [hoverCell, setHoverCell] = useState(null)
  const [burst, setBurst] = useState(null)
  const [dragPieceId, setDragPieceId] = useState(null)
  const [dragTarget, setDragTarget] = useState(null)
  const [dragScale, setDragScale] = useState(DEFAULT_DRAG_SCALE)

  const clearTimerRef = useRef(null)
  const burstIdRef = useRef(0)
  const restartButtonRef = useRef(null)
  const boardGridRef = useRef(null)
  const miniRefs = useRef(new Map())
  const dragTargetRef = useRef(null)
  const dragTargetKeyRef = useRef('')
  const lastDragRectRef = useRef(null)
  const lastDragEndTimeRef = useRef(-Infinity)

  const isPlaying = gameState === 'playing'
  const isInteractive = isPlaying && !isClearing
  const selectedPiece = pieces.find((piece) => piece?.id === selectedId) ?? null
  const draggedPiece = pieces.find((piece) => piece?.id === dragPieceId) ?? null
  const previewPiece = draggedPiece ?? selectedPiece
  const previewAnchor = dragPieceId ? dragTarget : hoverCell

  const pieceAnchors = useMemo(() => {
    const anchorsById = new Map()
    for (const piece of pieces) {
      if (piece) anchorsById.set(piece.id, findValidAnchors(board, piece.matrix))
    }
    return anchorsById
  }, [board, pieces])

  const previewCells = useMemo(() => {
    const cells = new Set()
    if (!previewPiece || !previewAnchor || !isInteractive) return cells

    const anchorRow = previewAnchor.row
    const anchorCol = previewAnchor.col
    if (dragPieceId && !dragTarget?.valid) return cells
    if (!canPlace(board, previewPiece.matrix, anchorRow, anchorCol)) return cells

    for (let row = 0; row < previewPiece.matrix.length; row += 1) {
      for (let col = 0; col < previewPiece.matrix[row].length; col += 1) {
        if (previewPiece.matrix[row][col]) {
          cells.add(`${anchorRow + row}-${anchorCol + col}`)
        }
      }
    }
    return cells
  }, [
    board,
    dragPieceId,
    dragTarget,
    isInteractive,
    previewAnchor,
    previewPiece,
  ])

  const clearingCellKeys = useMemo(() => {
    const cells = new Set()
    for (const row of clearingLines.rows) {
      for (let col = 0; col < BOARD_SIZE; col += 1) cells.add(`${row}-${col}`)
    }
    for (const col of clearingLines.cols) {
      for (let row = 0; row < BOARD_SIZE; row += 1) cells.add(`${row}-${col}`)
    }
    return cells
  }, [clearingLines])

  useEffect(
    () => () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const unlockAudio = () => soundManager.unlock()
    window.addEventListener('pointerdown', unlockAudio, {
      once: true,
      passive: true,
    })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  function resetDragState() {
    setDragPieceId(null)
    setDragTarget(null)
    setDragScale(DEFAULT_DRAG_SCALE)
    setHoverCell(null)
    dragTargetRef.current = null
    dragTargetKeyRef.current = ''
    lastDragRectRef.current = null
  }

  function goHome() {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }

    setGameState('menu')
    setBoard(createEmptyBoard())
    setPieces([])
    setSelectedId(null)
    setScore(0)
    setCombo(0)
    setLinesCleared(0)
    setIsClearing(false)
    setClearingLines(EMPTY_LINES)
    setBurst(null)
    setIsNewHighScore(false)
    setHighScore(readHighScore())
    resetDragState()
  }

  function startGame() {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }

    setBoard(createEmptyBoard())
    setPieces(generateBatch(BATCH_SIZE))
    setSelectedId(null)
    setScore(0)
    setCombo(0)
    setLinesCleared(0)
    setIsClearing(false)
    setClearingLines(EMPTY_LINES)
    setBurst(null)
    setIsNewHighScore(false)
    resetDragState()
    setGameState('playing')
  }

  function endGame(finalScore) {
    const beatHighScore = finalScore > highScore

    setSelectedId(null)
    resetDragState()
    setIsClearing(false)
    setClearingLines(EMPTY_LINES)
    setGameState('gameover')
    setIsNewHighScore(beatHighScore)

    if (beatHighScore) {
      setHighScore(finalScore)
      persistHighScore(finalScore)
    }
  }

  function finishTurn(nextBoard, nextPieces, finalScore) {
    setBoard(nextBoard)
    setIsClearing(false)

    if (gameState !== 'playing') return

    if (hasAvailableMove(nextBoard, nextPieces)) {
      setGameState('playing')
    } else {
      endGame(finalScore)
    }
  }

  function handlePlace(pieceId, row, col) {
    if (!isInteractive) return false

    const piece = pieces.find((candidate) => candidate?.id === pieceId)
    if (!piece) {
      soundManager.playError()
      return false
    }

    const filledBoard = placePiece(board, piece.matrix, row, col, piece.color)
    if (!filledBoard) {
      soundManager.playError()
      return false
    }

    soundManager.playDrop()

    // Slot-for-slot refill: the tray is never allowed to drop below 3 pieces.
    const nextPieces = replaceUsedPiece(pieces, pieceId)
    setPieces(nextPieces)

    const completed = findCompletedLines(filledBoard)

    setSelectedId(null)
    resetDragState()

    if (completed.count > 0) {
      const nextCombo = combo + 1
      const points = scoreClear(completed.count, nextCombo)
      const nextScore = score + points

      soundManager.playClear()
      setScore(nextScore)
      setCombo(nextCombo)
      setLinesCleared((current) => current + completed.count)
      setBoard(filledBoard)
      setClearingLines({ rows: completed.rows, cols: completed.cols })
      setIsClearing(true)
      burstIdRef.current += 1
      setBurst({
        id: burstIdRef.current,
        lines: completed.count,
        points,
        combo: nextCombo,
      })

      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = window.setTimeout(() => {
        clearTimerRef.current = null
        const clearedBoard = clearCompletedLines(
          filledBoard,
          completed.rows,
          completed.cols,
        )
        setClearingLines(EMPTY_LINES)
        finishTurn(clearedBoard, nextPieces, nextScore)
      }, CLEAR_DELAY)
    } else {
      setCombo(0)
      setBurst(null)
      finishTurn(filledBoard, nextPieces, score)
    }

    return true
  }

  function handleSelect(piece) {
    if (!isInteractive || !pieceAnchors.get(piece.id)?.length) return
    setSelectedId((current) => (current === piece.id ? null : piece.id))
    setHoverCell(null)
  }

  function handleCellClick(row, col) {
    if (!selectedPiece || dragPieceId) return
    handlePlace(selectedPiece.id, row, col)
  }

  function measureDragScale(piece) {
    const gridElement = boardGridRef.current
    const miniElement = miniRefs.current.get(piece.id)
    if (!gridElement || !miniElement) return DEFAULT_DRAG_SCALE

    const boardCell = gridElement.querySelector('.board-cell')
    const miniCell = miniElement.querySelector('.piece-mini-cell')
    if (!boardCell || !miniCell) return DEFAULT_DRAG_SCALE

    const boardWidth = boardCell.getBoundingClientRect().width
    const miniWidth = miniCell.getBoundingClientRect().width
    if (miniWidth <= 0) return DEFAULT_DRAG_SCALE

    return Math.min(3, Math.max(1.7, boardWidth / miniWidth))
  }

  function handlePieceDragStart(piece) {
    if (!isInteractive || !pieceAnchors.get(piece.id)?.length) return

    setSelectedId(piece.id)
    setHoverCell(null)
    setDragPieceId(piece.id)
    setDragTarget(null)
    setDragScale(measureDragScale(piece))
    dragTargetRef.current = null
    dragTargetKeyRef.current = ''
    lastDragRectRef.current = null
  }

  function handlePieceDrag(piece) {
    const miniElement = miniRefs.current.get(piece.id)
    if (!miniElement) return

    const pieceRect = miniElement.getBoundingClientRect()
    lastDragRectRef.current = pieceRect

    const target = calculateDropAnchor({
      board,
      piece,
      pieceRect,
      metrics: readBoardMetrics(boardGridRef.current),
    })
    const key = target
      ? `${target.row}:${target.col}:${target.valid}`
      : 'outside'

    dragTargetRef.current = target
    if (key === dragTargetKeyRef.current) return

    dragTargetKeyRef.current = key
    setDragTarget(target)
  }

  function handlePieceDragEnd(piece, event) {
    // Recalculate from the last measured visual centre and the live board
    // rects. This avoids the snap-back transform that starts on touch release.
    const target = lastDragRectRef.current
      ? calculateDropAnchor({
          board,
          piece,
          pieceRect: lastDragRectRef.current,
          metrics: readBoardMetrics(boardGridRef.current),
        })
      : dragTargetRef.current
    const droppedId = piece.id
    lastDragEndTimeRef.current = event?.timeStamp ?? 0

    setDragPieceId(null)
    setDragTarget(null)
    setDragScale(DEFAULT_DRAG_SCALE)
    setHoverCell(null)
    dragTargetRef.current = null
    dragTargetKeyRef.current = ''
    lastDragRectRef.current = null

    if (target?.valid) {
      handlePlace(droppedId, target.row, target.col)
    } else {
      soundManager.playError()
      setSelectedId(null)
    }
  }

  function handleMiniRef(pieceId, node) {
    if (node) miniRefs.current.set(pieceId, node)
    else miniRefs.current.delete(pieceId)
  }

  const burstTitle =
    burst?.lines >= 4
      ? 'MEGA CLEAR'
      : burst?.lines === 3
        ? 'TRIPLE CLEAR'
        : burst?.lines === 2
          ? 'DOUBLE CLEAR'
          : 'LINE CLEAR'

  const dropHint = !dragPieceId
    ? null
    : !dragTarget
      ? '拖曳到棋盤上'
      : dragTarget.valid
        ? '放開即可放置'
        : '這個位置放不下'

  return (
    <div className="arena relative min-h-[100svh] overflow-hidden text-slate-100">
      <div className="ambient-grid" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-cyan" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-pink" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-blue" aria-hidden="true" />

      <AnimatePresence mode="wait" initial={false}>
        {gameState === 'menu' ? (
          <MenuScreen key="menu" highScore={highScore} onStart={startGame} />
        ) : null}

        {gameState === 'playing' ? (
          <Screen key="playing" name="playing" className="max-w-[29rem]">
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <LogoMark />
                <div>
                  <p className="font-display text-base leading-none font-black tracking-[0.11em] text-white">
                    BLOCK <span className="title-gradient">BLAST</span>
                  </p>
                  <p className="mt-1 text-[8px] font-semibold tracking-[0.24em] text-cyan-200/45">
                    NEON PUZZLE · 8 × 8
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={goHome}
                className="icon-button grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/75 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 active:scale-95"
                aria-label="回首頁"
                title="回首頁"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m3 10 9-7 9 7" />
                  <path d="M5 9v11h14V9" />
                  <path d="M9 20v-6h6v6" />
                </svg>
              </button>
            </header>

            <section className="mt-4 grid grid-cols-2 gap-2.5" aria-label="分數板">
              <div className="score-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="score-label">分數 SCORE</span>
                  <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                </div>
                <div
                  key={score}
                  className="score-value mt-1 animate-score-pop text-cyan-100"
                >
                  {formatScore(score)}
                </div>
              </div>

              <div className="score-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="score-label">最高分 BEST</span>
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3.5 text-amber-300/75"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="m12 2.6 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.2l6.3-.9L12 2.6Z" />
                  </svg>
                </div>
                <div className="score-value mt-1 text-amber-100/90">
                  {formatScore(highScore)}
                </div>
              </div>
            </section>

            <section className="relative mt-3.5" aria-label="8乘8遊戲棋盤">
              <div className="board-glow" aria-hidden="true" />

              {combo > 1 && gameState === 'playing' ? (
                <div
                  className="combo-badge animate-combo-in"
                  aria-label={`連消 ${combo} 次`}
                >
                  <span className="font-display text-[8px] tracking-[0.22em] text-fuchsia-200/80">
                    COMBO
                  </span>
                  <span className="font-display text-base leading-none font-black text-white">
                    ×{combo}
                  </span>
                </div>
              ) : null}

              <div className="board-frame relative rounded-[26px] border border-cyan-200/15 bg-[#07152e]/95 p-2.5 shadow-[0_25px_80px_-28px_rgba(34,211,238,0.55)]">
                <div
                  ref={boardGridRef}
                  role="grid"
                  aria-label="Block Blast 遊戲棋盤"
                  aria-rowcount={BOARD_SIZE}
                  aria-colcount={BOARD_SIZE}
                  aria-busy={isClearing}
                  className="board-grid grid grid-cols-8 gap-[5px] rounded-[18px] border border-white/[0.045] bg-[#030d1f] p-1.5 sm:gap-1.5 sm:p-2"
                  onMouseLeave={() => setHoverCell(null)}
                >
                  {board.map((rowCells, row) =>
                    rowCells.map((cell, col) => {
                      const key = `${row}-${col}`
                      const isFilled = Boolean(cell)
                      const isClearingCell = clearingCellKeys.has(key)
                      const isPreview = previewCells.has(key)
                      const cellLabel = isFilled ? '已放置方塊' : '空格'

                      return (
                        <button
                          type="button"
                          role="gridcell"
                          key={key}
                          disabled={!isInteractive || Boolean(dragPieceId) || isFilled}
                          aria-label={`第 ${row + 1} 列，第 ${col + 1} 行，${cellLabel}`}
                          onClick={() => handleCellClick(row, col)}
                          onMouseEnter={() => {
                            if (selectedPiece && !dragPieceId) {
                              setHoverCell({ row, col })
                            }
                          }}
                          onFocus={() => {
                            if (selectedPiece && !dragPieceId) {
                              setHoverCell({ row, col })
                            }
                          }}
                          className={[
                            'board-cell relative aspect-square rounded-sm',
                            isFilled ? 'is-filled' : '',
                            isClearingCell ? 'is-clearing' : '',
                            selectedPiece && isInteractive && !dragPieceId
                              ? 'is-targetable'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {isFilled ? (
                            <>
                              <span
                                className="block-face absolute inset-0 rounded-sm"
                                style={blockStyle(cell)}
                              />
                              {isClearingCell ? (
                                <span className="clear-spark absolute inset-0 rounded-sm" />
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="cell-well absolute inset-0 rounded-sm" />
                              {isPreview ? (
                                <span
                                  className="block-ghost absolute inset-0 rounded-sm"
                                  style={blockStyle(previewPiece.color)}
                                />
                              ) : null}
                            </>
                          )}
                        </button>
                      )
                    }),
                  )}
                </div>

                <AnimatePresence>
                  {dragPieceId ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      className={[
                        'drop-hint pointer-events-none absolute right-0 bottom-3 left-0 z-30 mx-auto w-fit px-3 py-1.5 text-[9px] font-bold tracking-[0.14em]',
                        dragTarget?.valid
                          ? 'is-valid'
                          : dragTarget
                            ? 'is-invalid'
                            : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-hidden="true"
                    >
                      {dropHint}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {burst ? (
                  <div
                    key={burst.id}
                    className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
                    aria-hidden="true"
                  >
                    <div className="clear-burst">
                      <span className="font-display block text-[10px] font-bold tracking-[0.28em] text-cyan-200">
                        {burstTitle}
                      </span>
                      <span className="font-display mt-0.5 block text-3xl font-black tracking-tight text-white">
                        +{formatScore(burst.points)}
                      </span>
                      {burst.combo > 1 ? (
                        <span className="mt-0.5 block text-[10px] font-bold tracking-[0.2em] text-fuchsia-300">
                          COMBO ×{burst.combo}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className="relative z-20 mt-3 rounded-2xl border border-white/[0.08] bg-[#07142a]/85 p-2.5 shadow-[0_16px_45px_-25px_rgba(8,145,178,0.5)] backdrop-blur-sm"
              aria-label="方塊池"
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-fuchsia-400 shadow-[0_0_7px_#e879f9]" />
                  <span className="text-[9px] font-bold tracking-[0.2em] text-slate-300/75">
                    方塊庫 <span className="text-slate-500">/ DRAG A PIECE</span>
                  </span>
                </div>
                <span className="font-display text-[9px] font-semibold tracking-[0.18em] text-cyan-200/45">
                  AUTO REFILL
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {pieces.map((piece) => {
                  const available = (pieceAnchors.get(piece.id)?.length ?? 0) > 0
                  const selected = piece.id === selectedId
                  const blocked = !available && isInteractive
                  const dragging = piece.id === dragPieceId

                  return (
                    <div
                      key={piece.id}
                      className={[
                        'tray-slot relative flex flex-col items-center justify-center',
                        selected ? 'is-selected' : '',
                        blocked ? 'is-blocked' : '',
                        dragging ? 'is-dragging-source' : '',
                        !selected && available && isInteractive ? 'is-ready' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="pointer-events-none font-display absolute top-1.5 left-2 z-10 text-[8px] font-bold tracking-widest text-white/25">
                        {piece.label}
                      </span>
                      {selected && !dragging ? (
                        <span className="pointer-events-none absolute top-1.5 right-1.5 z-10 size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                      ) : null}

                      <motion.div
                        role="button"
                        tabIndex={isInteractive ? 0 : -1}
                        aria-pressed={selected}
                        aria-disabled={!isInteractive || !available}
                        aria-label={`${piece.label} 型方塊，${
                          available
                            ? '拖曳到棋盤放置，或點選後再點擊棋盤'
                            : '目前沒有可放置的位置'
                        }`}
                        drag={isInteractive && available}
                        dragSnapToOrigin
                        dragMomentum={false}
                        dragElastic={0.08}
                        whileDrag={{ scale: dragScale, cursor: 'grabbing' }}
                        transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                        onTap={(event) => {
                          if (event.timeStamp - lastDragEndTimeRef.current < 300) {
                            return
                          }
                          handleSelect(piece)
                        }}
                        onDragStart={() => handlePieceDragStart(piece)}
                        onDrag={() => handlePieceDrag(piece)}
                        onDragEnd={(event) => handlePieceDragEnd(piece, event)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleSelect(piece)
                          }
                        }}
                        className={`drag-piece relative z-[2] grid place-items-center ${
                          isInteractive && available ? 'is-grabbable' : ''
                        }`}
                        style={{
                          touchAction: 'none',
                          zIndex: dragging ? 60 : undefined,
                        }}
                      >
                        <div
                          ref={(node) => handleMiniRef(piece.id, node)}
                          className={`drag-lift w-fit ${dragging ? 'is-lifted' : ''}`}
                        >
                          <MiniPiece piece={piece} />
                        </div>
                      </motion.div>

                      <span
                        className={`pointer-events-none mt-1 text-[8px] font-semibold tracking-[0.14em] ${
                          selected ? 'text-cyan-200/75' : 'text-slate-500/70'
                        }`}
                      >
                        {dragging
                          ? '拖曳中'
                          : blocked
                            ? '無空間'
                            : selected
                              ? '已選取'
                              : '拖曳 · 點選'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[9px] tracking-[0.08em] text-slate-500">
              <p>
                <span className="text-cyan-300/65">拖曳方塊</span> 到棋盤
                <span className="hidden sm:inline"> · 點一下也可選取</span>
              </p>
              <span className="font-display hidden text-[8px] tracking-[0.14em] text-slate-600 sm:inline">
                FILL LINES · CHAIN COMBOS
              </span>
            </div>

            <p className="sr-only" aria-live="polite">
              {isClearing
                ? `消除 ${clearingLines.rows.length + clearingLines.cols.length} 條線`
                : burst
                  ? `獲得 ${burst.points} 分`
                  : ''}
            </p>
          </Screen>
        ) : null}

        {gameState === 'gameover' ? (
          <GameOverScreen
            key="gameover"
            score={score}
            highScore={highScore}
            linesCleared={linesCleared}
            isNewHighScore={isNewHighScore}
            onRestart={startGame}
            onHome={goHome}
            restartRef={restartButtonRef}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default App
