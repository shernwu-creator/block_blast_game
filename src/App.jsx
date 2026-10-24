import { useEffect, useMemo, useRef, useState } from 'react'
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
  scoreClear,
} from './game'

const BEST_SCORE_KEY = 'block-blast-best-score'
const CLEAR_DELAY = 520
const EMPTY_LINES = { rows: [], cols: [] }

function readBestScore() {
  try {
    const stored = Number.parseInt(
      window.localStorage.getItem(BEST_SCORE_KEY) ?? '0',
      10,
    )
    return Number.isFinite(stored) ? stored : 0
  } catch {
    return 0
  }
}

function persistBestScore(score) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score))
  } catch {
    // A blocked storage API should never interrupt the game.
  }
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

function App() {
  const [board, setBoard] = useState(createEmptyBoard)
  const [pieces, setPieces] = useState(() => generateBatch(BATCH_SIZE))
  const [selectedId, setSelectedId] = useState(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(readBestScore)
  const [combo, setCombo] = useState(0)
  const [linesCleared, setLinesCleared] = useState(0)
  const [round, setRound] = useState(1)
  const [status, setStatus] = useState('playing')
  const [clearingLines, setClearingLines] = useState(EMPTY_LINES)
  const [hoverCell, setHoverCell] = useState(null)
  const [burst, setBurst] = useState(null)

  const clearTimerRef = useRef(null)
  const burstIdRef = useRef(0)
  const restartButtonRef = useRef(null)
  const dragPieceRef = useRef(null)

  const selectedPiece = pieces.find((piece) => piece?.id === selectedId) ?? null
  const isPlaying = status === 'playing'

  const pieceAnchors = useMemo(() => {
    const anchorsById = new Map()
    for (const piece of pieces) {
      if (piece) anchorsById.set(piece.id, findValidAnchors(board, piece.matrix))
    }
    return anchorsById
  }, [board, pieces])

  const anchorKeys = useMemo(
    () =>
      new Set(
        (selectedId ? (pieceAnchors.get(selectedId) ?? []) : []).map(
          ({ row, col }) => `${row}-${col}`,
        ),
      ),
    [pieceAnchors, selectedId],
  )

  const previewCells = useMemo(() => {
    const cells = new Set()
    if (!selectedPiece || !hoverCell || !isPlaying) return cells
    if (!canPlace(board, selectedPiece.matrix, hoverCell.row, hoverCell.col)) {
      return cells
    }

    for (let row = 0; row < selectedPiece.matrix.length; row += 1) {
      for (let col = 0; col < selectedPiece.matrix[row].length; col += 1) {
        if (selectedPiece.matrix[row][col]) {
          cells.add(`${hoverCell.row + row}-${hoverCell.col + col}`)
        }
      }
    }
    return cells
  }, [board, hoverCell, isPlaying, selectedPiece])

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
    if (status === 'gameover') restartButtonRef.current?.focus()
  }, [status])

  function resolveTurn(nextBoard, remainingPieces) {
    let resolvedPieces = remainingPieces
    let resolvedRound = round

    if (remainingPieces.every((piece) => piece === null)) {
      resolvedPieces = generateBatch(BATCH_SIZE)
      resolvedRound = round + 1
      setRound(resolvedRound)
    }

    setPieces(resolvedPieces)
    setBoard(nextBoard)
    setStatus(
      hasAvailableMove(nextBoard, resolvedPieces) ? 'playing' : 'gameover',
    )
  }

  function handlePlace(pieceId, row, col) {
    if (!isPlaying) return false

    const piece = pieces.find((candidate) => candidate?.id === pieceId)
    if (!piece) return false

    const filledBoard = placePiece(board, piece.matrix, row, col, piece.color)
    if (!filledBoard) return false

    const completed = findCompletedLines(filledBoard)
    const remainingPieces = pieces.map((candidate) =>
      candidate?.id === pieceId ? null : candidate,
    )

    setSelectedId(null)
    setHoverCell(null)
    dragPieceRef.current = null

    if (completed.count > 0) {
      const nextCombo = combo + 1
      const points = scoreClear(completed.count, nextCombo)
      const nextScore = score + points

      setScore(nextScore)
      if (nextScore > best) {
        setBest(nextScore)
        persistBestScore(nextScore)
      }
      setCombo(nextCombo)
      setLinesCleared((current) => current + completed.count)
      setBoard(filledBoard)
      setClearingLines({ rows: completed.rows, cols: completed.cols })
      setStatus('clearing')
      burstIdRef.current += 1
      setBurst({
        id: burstIdRef.current,
        lines: completed.count,
        points,
        combo: nextCombo,
      })

      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = window.setTimeout(() => {
        const clearedBoard = clearCompletedLines(
          filledBoard,
          completed.rows,
          completed.cols,
        )
        setClearingLines(EMPTY_LINES)
        resolveTurn(clearedBoard, remainingPieces)
        clearTimerRef.current = null
      }, CLEAR_DELAY)
    } else {
      setCombo(0)
      setBurst(null)
      resolveTurn(filledBoard, remainingPieces)
    }

    return true
  }

  function startNewGame() {
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
    setRound(1)
    setStatus('playing')
    setClearingLines(EMPTY_LINES)
    setHoverCell(null)
    setBurst(null)
    dragPieceRef.current = null
  }

  function handleSelect(piece) {
    if (!isPlaying || !pieceAnchors.get(piece.id)?.length) return
    setSelectedId((current) => (current === piece.id ? null : piece.id))
    setHoverCell(null)
  }

  function handleCellClick(row, col) {
    if (!selectedPiece) return
    handlePlace(selectedPiece.id, row, col)
  }

  function handleDragStart(event, piece) {
    if (!isPlaying || !pieceAnchors.get(piece.id)?.length) {
      event.preventDefault()
      return
    }

    dragPieceRef.current = piece.id
    setSelectedId(piece.id)
    setHoverCell(null)
    event.dataTransfer.setData('text/plain', piece.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(event, row, col) {
    if (!isPlaying || !dragPieceRef.current) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setHoverCell({ row, col })
  }

  function handleDrop(event, row, col) {
    event.preventDefault()
    const droppedId =
      event.dataTransfer.getData('text/plain') ||
      dragPieceRef.current ||
      selectedId
    setHoverCell(null)
    dragPieceRef.current = null
    if (droppedId) handlePlace(droppedId, row, col)
  }

  function handleDragEnd() {
    setHoverCell(null)
    dragPieceRef.current = null
  }

  const burstTitle =
    burst?.lines >= 4
      ? 'MEGA CLEAR'
      : burst?.lines === 3
        ? 'TRIPLE CLEAR'
        : burst?.lines === 2
          ? 'DOUBLE CLEAR'
          : 'LINE CLEAR'

  return (
    <div className="arena relative min-h-[100svh] overflow-hidden text-slate-100">
      <div className="ambient-grid" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-cyan" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-pink" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-blue" aria-hidden="true" />

      <main
        className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[29rem] flex-col justify-center px-4 py-5 sm:px-5 sm:py-7"
        aria-hidden={status === 'gameover' ? 'true' : undefined}
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="logo-mark grid grid-cols-2 gap-[3px]" aria-hidden="true">
              <span className="logo-block bg-cyan-300" />
              <span className="logo-block bg-fuchsia-400" />
              <span className="logo-block bg-lime-300" />
              <span className="logo-block bg-amber-300" />
            </div>
            <div>
              <h1 className="font-display text-[clamp(1.35rem,5.6vw,1.7rem)] leading-none font-black tracking-[0.09em] whitespace-nowrap text-white">
                BLOCK <span className="title-gradient">BLAST</span>
              </h1>
              <p className="mt-1.5 text-[9px] font-semibold tracking-[0.3em] text-cyan-200/55">
                方塊爆破 · NEON PUZZLE
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={startNewGame}
            className="icon-button grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/75 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 active:scale-95"
            aria-label="重新開始遊戲"
            title="重新開始"
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
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </header>

        <section
          className="mt-4 grid grid-cols-2 gap-2.5"
          aria-label="分數板"
        >
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
              {formatScore(best)}
            </div>
          </div>
        </section>

        <section className="relative mt-3.5" aria-label="8乘8遊戲棋盤">
          <div className="board-glow" aria-hidden="true" />

          {combo > 1 && status !== 'gameover' ? (
            <div className="combo-badge animate-combo-in" aria-label={`連消 ${combo} 次`}>
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
              role="grid"
              aria-label="Block Blast 遊戲棋盤"
              aria-rowcount={BOARD_SIZE}
              aria-colcount={BOARD_SIZE}
              aria-busy={status === 'clearing'}
              className="board-grid grid grid-cols-8 gap-[5px] rounded-[18px] border border-white/[0.045] bg-[#030d1f] p-1.5 sm:gap-1.5 sm:p-2"
              onMouseLeave={() => setHoverCell(null)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setHoverCell(null)
                }
              }}
            >
              {board.map((rowCells, row) =>
                rowCells.map((cell, col) => {
                  const key = `${row}-${col}`
                  const isFilled = Boolean(cell)
                  const isClearing = clearingCellKeys.has(key)
                  const isPreview = previewCells.has(key)
                  const isAnchor = anchorKeys.has(key) && !isFilled
                  const cellLabel = isFilled
                    ? '已放置方塊'
                    : isAnchor
                      ? '可放置方塊的左上角'
                      : '空格'

                  return (
                    <button
                      type="button"
                      role="gridcell"
                      key={key}
                      disabled={!isPlaying || isFilled}
                      aria-label={`第 ${row + 1} 列，第 ${col + 1} 行，${cellLabel}`}
                      onClick={() => handleCellClick(row, col)}
                      onMouseEnter={() => {
                        if (selectedPiece) setHoverCell({ row, col })
                      }}
                      onFocus={() => {
                        if (selectedPiece) setHoverCell({ row, col })
                      }}
                      onDragOver={(event) => handleDragOver(event, row, col)}
                      onDrop={(event) => handleDrop(event, row, col)}
                      className={[
                        'board-cell relative aspect-square rounded-sm',
                        isFilled ? 'is-filled' : '',
                        isClearing ? 'is-clearing' : '',
                        isAnchor ? 'is-anchor' : '',
                        selectedPiece && isPlaying ? 'is-targetable' : '',
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
                          {isClearing ? (
                            <span className="clear-spark absolute inset-0 rounded-sm" />
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="cell-well absolute inset-0 rounded-sm" />
                          {isAnchor ? <span className="anchor-dot" /> : null}
                          {isPreview ? (
                            <span
                              className="block-ghost absolute inset-0 rounded-sm"
                              style={blockStyle(selectedPiece.color)}
                            />
                          ) : null}
                        </>
                      )}
                    </button>
                  )
                }),
              )}
            </div>

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
          className="mt-3 rounded-2xl border border-white/[0.08] bg-[#07142a]/85 p-2.5 shadow-[0_16px_45px_-25px_rgba(8,145,178,0.5)] backdrop-blur-sm"
          aria-label="方塊池"
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-fuchsia-400 shadow-[0_0_7px_#e879f9]" />
              <span className="text-[9px] font-bold tracking-[0.2em] text-slate-300/75">
                方塊庫 <span className="text-slate-500">/ PICK A PIECE</span>
              </span>
            </div>
            <span className="font-display text-[9px] font-semibold tracking-[0.18em] text-cyan-200/45">
              ROUND {String(round).padStart(2, '0')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {pieces.map((piece, index) => {
              if (!piece) {
                return (
                  <div
                    className="tray-slot is-used grid place-items-center"
                    key={`used-${index}`}
                    aria-label="已使用的方塊欄位"
                  >
                    <span className="rounded border border-dashed border-slate-600/40 px-1.5 py-0.5 text-[8px] tracking-[0.18em] text-slate-600">
                      USED
                    </span>
                  </div>
                )
              }

              const available = (pieceAnchors.get(piece.id)?.length ?? 0) > 0
              const selected = piece.id === selectedId
              const blocked = !available && isPlaying

              return (
                <button
                  key={piece.id}
                  type="button"
                  disabled={!isPlaying || !available}
                  draggable={isPlaying && available}
                  onClick={() => handleSelect(piece)}
                  onDragStart={(event) => handleDragStart(event, piece)}
                  onDragEnd={handleDragEnd}
                  aria-pressed={selected}
                  aria-label={`${piece.label} 型方塊，${
                    available ? '可放置，點選後放到棋盤' : '目前沒有可放置的位置'
                  }`}
                  className={[
                    'tray-slot group relative flex flex-col items-center justify-center',
                    selected ? 'is-selected' : '',
                    blocked ? 'is-blocked' : '',
                    !selected && available && isPlaying ? 'is-ready' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="font-display absolute top-1.5 left-2 text-[8px] font-bold tracking-widest text-white/25">
                    {piece.label}
                  </span>
                  {selected ? (
                    <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                  ) : null}
                  <MiniPiece piece={piece} />
                  {blocked ? (
                    <span className="mt-1 text-[8px] font-bold tracking-[0.12em] text-rose-300/70">
                      無空間
                    </span>
                  ) : (
                    <span
                      className={`mt-1 text-[8px] font-semibold tracking-[0.16em] ${
                        selected ? 'text-cyan-200/75' : 'text-slate-500/70'
                      }`}
                    >
                      {selected ? '已選取' : 'TAP / DRAG'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[9px] tracking-[0.08em] text-slate-500">
          <p>
            <span className="text-cyan-300/65">點選方塊</span> →{' '}
            <span className="text-cyan-300/65">點擊棋盤</span>
            <span className="hidden sm:inline"> · 桌機可拖曳</span>
          </p>
          <span className="font-display hidden text-[8px] tracking-[0.14em] text-slate-600 sm:inline">
            FILL LINES · CHAIN COMBOS
          </span>
        </div>

        <p className="sr-only" aria-live="polite">
          {status === 'clearing'
            ? `消除 ${clearingLines.rows.length + clearingLines.cols.length} 條線`
            : burst
              ? `獲得 ${burst.points} 分`
              : ''}
        </p>
      </main>

      {status === 'gameover' ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#010611]/80 px-5 py-8 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-over-title"
            aria-describedby="game-over-description"
            className="game-over-card relative w-full max-w-[22rem] overflow-hidden rounded-[28px] border border-cyan-300/25 bg-[#07152e] px-6 pt-7 pb-6 text-center shadow-[0_30px_100px_-20px_rgba(34,211,238,0.45)] animate-modal-in"
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
              <h2
                id="game-over-title"
                className="font-display mt-1 text-3xl font-black tracking-[0.06em] text-white"
              >
                遊戲結束
              </h2>
              <p
                id="game-over-description"
                className="mt-2 text-xs leading-relaxed text-slate-400"
              >
                方塊已無處可放，這局到此為止。
              </p>

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
                      {formatScore(best)}
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

              <button
                ref={restartButtonRef}
                type="button"
                onClick={startNewGame}
                className="restart-button mt-4 w-full rounded-xl px-4 py-3 font-display text-xs font-bold tracking-[0.18em] text-[#03111f] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 active:scale-[0.98]"
              >
                再玩一次
              </button>
              <p className="mt-3 text-[8px] tracking-[0.16em] text-slate-600">
                CLEAR LINES · BUILD COMBOS
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
