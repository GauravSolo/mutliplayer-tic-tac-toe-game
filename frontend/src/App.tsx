import { useState } from "react"
import { useNakama } from "./hooks/useNakama"
import Lobby from "./components/Lobby"
import Game from "./components/Game"

function App() {
  const {
    connected,
    userId,
    username,
    players,
    matchId,
    gameState,
    gameOver,
    status,
    setDisplayName,
    findMatch,
    joinMatch,
    makeMove,
    playAgain,
  } = useNakama()

  const [nameInput, setNameInput] = useState("")

  // Step 1: Enter username
  if (!username) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <div className="inline-grid grid-cols-3 gap-1 mb-4">
              <div className="w-7 h-7 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">X</div>
              <div className="w-7 h-7 rounded bg-gray-100" />
              <div className="w-7 h-7 rounded bg-rose-100 flex items-center justify-center text-rose-500 text-xs font-bold">O</div>
              <div className="w-7 h-7 rounded bg-gray-100" />
              <div className="w-7 h-7 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">X</div>
              <div className="w-7 h-7 rounded bg-gray-100" />
              <div className="w-7 h-7 rounded bg-rose-100 flex items-center justify-center text-rose-500 text-xs font-bold">O</div>
              <div className="w-7 h-7 rounded bg-gray-100" />
              <div className="w-7 h-7 rounded bg-gray-100" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Tic Tac Toe</h1>
            <p className="text-gray-400 text-sm mt-1">Enter your name to play</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <input
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all text-center"
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameInput.trim() && connected) {
                  setDisplayName(nameInput.trim())
                }
              }}
              autoFocus
            />
            <button
              onClick={() => setDisplayName(nameInput.trim())}
              disabled={!connected || !nameInput.trim()}
              className="w-full mt-3 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
            >
              {connected ? "Continue" : "Connecting..."}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 2: Lobby
  if (!matchId) {
    return (
      <Lobby
        connected={connected}
        status={status}
        onFindMatch={findMatch}
        onJoinMatch={joinMatch}
      />
    )
  }

  // Step 3: Game
  return (
    <Game
      userId={userId}
      username={username}
      players={players}
      matchId={matchId}
      gameState={gameState}
      gameOver={gameOver}
      status={status}
      onMove={makeMove}
      onPlayAgain={playAgain}
    />
  )
}

export default App
