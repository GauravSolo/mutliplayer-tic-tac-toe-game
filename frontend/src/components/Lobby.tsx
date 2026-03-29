import { useState } from "react"

interface LobbyProps {
  connected: boolean
  status: string
  onFindMatch: () => void
  onJoinMatch: (matchId: string) => void
}

export default function Lobby({ connected, status, onFindMatch, onJoinMatch }: LobbyProps) {
  const [inputMatchId, setInputMatchId] = useState("")

  return (
    <div className="flex items-center justify-center px-4 pt-12 sm:pt-20 pb-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-grid grid-cols-3 gap-1 mb-4 sm:mb-5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">X</div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gray-100" />
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-rose-100 flex items-center justify-center text-rose-500 text-xs font-bold">O</div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gray-100" />
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">X</div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gray-100" />
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-rose-100 flex items-center justify-center text-rose-500 text-xs font-bold">O</div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gray-100" />
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-gray-100" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Tic Tac Toe</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time multiplayer</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
          <button
            onClick={onFindMatch}
            disabled={!connected}
            className="w-full py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
          >
            Find Match
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-gray-300 text-xs uppercase tracking-wide">or join by ID</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 sm:px-4 py-3 text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              placeholder="Paste match ID"
              value={inputMatchId}
              onChange={(e) => setInputMatchId(e.target.value)}
            />
            <button
              onClick={() => onJoinMatch(inputMatchId)}
              disabled={!connected || !inputMatchId.trim()}
              className="px-4 sm:px-5 py-3 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 active:scale-[0.98] disabled:text-gray-300 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all shrink-0"
            >
              Join
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-amber-400 animate-pulse"}`} />
          <p className="text-gray-400 text-xs">{status}</p>
        </div>
      </div>
    </div>
  )
}
