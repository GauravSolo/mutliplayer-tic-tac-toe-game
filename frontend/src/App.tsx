import { useEffect, useRef, useState } from "react"
import type { Match, Socket } from "@heroiclabs/nakama-js"
import client from "./nakamaClient"

function App() {
  const socketRef = useRef<Socket | null>(null)
  const [matchId, setMatchId] = useState("")
  const [inputMatchId, setInputMatchId] = useState("")
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const connect = async () => {
      const session = await client.authenticateDevice(crypto.randomUUID(), true)

      console.log("connected user", session.user_id)

      const socket = client.createSocket()
      socketRef.current = socket

      await socket.connect(session, true)

      console.log("socket connected")
      setConnected(true)
    }

    connect()
  }, [])

  const createMatch = async () => {
    const socket = socketRef.current
    if (!socket) {
      console.warn("Socket not ready yet")
      return
    }

    const match: Match = await socket.createMatch()
    setMatchId(match.match_id)
    console.log("match created", match.match_id, match)
  }

  const joinMatch = async () => {
    const socket = socketRef.current
    if (!socket) {
      console.warn("Socket not ready yet")
      return
    }

    const id = inputMatchId.trim()
    if (!id) {
      console.warn("Match ID is empty")
      return
    }

    const match: Match = await socket.joinMatch(id)
    setMatchId(match.match_id)
    console.log("joined match", match.match_id)
  }

  return (
    <div>
      <h1>Tic Tac Toe</h1>

      <button onClick={createMatch} disabled={!connected || !!matchId}>
        Create Match
      </button>

      {matchId && (
        <>
          <p>Your match id:</p>
          <h3>{matchId}</h3>
        </>
      )}

      <hr />

      <input
        placeholder="Enter match id"
        value={inputMatchId}
        onChange={(e) => setInputMatchId(e.target.value)}
        disabled={!!matchId}
      />

      <button onClick={joinMatch} disabled={!connected || !!matchId}>
        Join Match
      </button>
    </div>
  )
}

export default App
