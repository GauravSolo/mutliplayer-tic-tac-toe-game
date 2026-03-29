import { useState } from "react"
import Board from "./Board"
import type { GameState, GameOverInfo } from "../constants"

interface GameProps {
  userId: string
  username: string
  players: { [userId: string]: string }
  matchId: string
  gameState: GameState | null
  gameOver: GameOverInfo | null
  status: string
  onMove: (position: number) => void
  onPlayAgain: () => void
}

export default function Game({
  userId, username, players, matchId, gameState, gameOver, status, onMove, onPlayAgain,
}: GameProps) {
  const myMark = gameState?.marks[userId]
  const myMarkStr = myMark === 1 ? "X" : myMark === 2 ? "O" : "?"
  const oppMarkStr = myMark === 1 ? "O" : "X"
  const isMyTurn = gameState?.turn === userId

  // Find opponent's name
  const oppId = gameState?.playerIds.find((id) => id !== userId)
  const oppName = oppId ? (players[oppId] || "Opponent") : "Waiting..."

  const boardDisabled = !isMyTurn || !gameState?.playing

  const getStatusText = () => {
    if (gameOver) {
      if (gameOver.reason === "draw") return "It's a draw!"
      if (gameOver.reason === "opponent_left") return `${oppName} left`
      return gameOver.winnerMark === myMark ? "You won!" : "You lost"
    }
    if (!gameState?.playing) return status
    return isMyTurn ? "Your turn" : `${oppName}'s turn`
  }

  const isWin = gameOver && gameOver.winnerMark === myMark
  const isLoss = gameOver && gameOver.winnerMark !== null && gameOver.winnerMark !== myMark

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-900 text-center mb-5 sm:mb-6">Tic Tac Toe</h1>

        {/* Players */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 mb-4 sm:mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold ${myMark === 1 ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-500"}`}>
                {myMarkStr}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-900">{username}</p>
                <p className="text-[10px] sm:text-[11px] text-gray-400">You</p>
              </div>
            </div>

            <span className="text-gray-200 text-xs font-medium">vs</span>

            <div className="flex items-center gap-2">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-900 text-right">{oppName}</p>
                <p className="text-[10px] sm:text-[11px] text-gray-400 text-right">Opponent</p>
              </div>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold ${myMark === 1 ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-600"}`}>
                {oppMarkStr}
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className={`
          text-center py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl mb-4 sm:mb-5 text-sm font-medium
          ${gameOver
            ? isWin
              ? "bg-green-50 text-green-700 border border-green-100"
              : isLoss
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-amber-50 text-amber-700 border border-amber-100"
            : isMyTurn && gameState?.playing
              ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
              : "bg-gray-50 text-gray-400 border border-gray-100"
          }
        `}>
          {getStatusText()}
        </div>

        {/* Board */}
        <Board
          board={gameState?.board || [0, 0, 0, 0, 0, 0, 0, 0, 0]}
          disabled={boardDisabled}
          onCellClick={onMove}
        />

        {/* Play Again */}
        {gameOver && (
          <button
            onClick={onPlayAgain}
            className="w-full mt-5 sm:mt-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all"
          >
            Play Again
          </button>
        )}

        {/* Match ID */}
        <MatchId id={matchId} />
      </div>
    </div>
  )
}

function MatchId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-4 sm:mt-5">
      <p className="text-gray-600 text-xs text-center mb-1.5 font-medium">Match ID</p>
      <button
        onClick={copy}
        className="w-full flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2.5 hover:border-indigo-300 transition-colors group shadow-sm"
      >
        <span className="text-gray-700 text-xs font-mono break-all text-left leading-relaxed">
          {id}
        </span>
        <span className={`text-xs font-medium shrink-0 transition-colors ${copied ? "text-green-600" : "text-indigo-600"}`}>
          {copied ? "Copied!" : "Copy"}
        </span>
      </button>
    </div>
  )
}
