import { useEffect, useRef, useState, useCallback } from "react"
import type { MatchData, Socket, Session } from "@heroiclabs/nakama-js"
import client, { useSSL } from "../nakamaClient"
import { OpCode, type GameState, type GameOverInfo } from "../constants"

export function useNakama() {
  const socketRef = useRef<Socket | null>(null)
  const sessionRef = useRef<Session | null>(null)

  const [connected, setConnected] = useState(false)
  const [userId, setUserId] = useState("")
  const [username, setUsername] = useState("")
  const [matchId, setMatchId] = useState("")
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null)
  const [status, setStatus] = useState("Connecting...")
  const [players, setPlayers] = useState<{ [userId: string]: string }>({})

  // Fetch display names for user IDs we haven't seen
  const fetchedIdsRef = useRef<Set<string>>(new Set())
  const fetchPlayerNames = useCallback(async (playerIds: string[]) => {
    const session = sessionRef.current
    if (!session) return

    const newIds = playerIds.filter((id) => !fetchedIdsRef.current.has(id))
    if (newIds.length === 0) return

    try {
      const result = await client.getUsers(session, newIds)
      if (result.users) {
        setPlayers((prev) => {
          const next = { ...prev }
          for (const user of result.users!) {
            next[user.id!] = user.display_name || user.username || user.id!
            fetchedIdsRef.current.add(user.id!)
          }
          return next
        })
      }
    } catch (e) {
      console.warn("Failed to fetch player names:", e)
    }
  }, [])

  useEffect(() => {
    const connect = async () => {
      const session = await client.authenticateDevice(crypto.randomUUID(), true)
      sessionRef.current = session
      setUserId(session.user_id!)

      const socket = client.createSocket(useSSL)
      socketRef.current = socket

      socket.onmatchdata = (data: MatchData) => {
        const payload = JSON.parse(new TextDecoder().decode(data.data))

        switch (data.op_code) {
          case OpCode.STATE:
            setGameState(payload)
            setGameOver(null)
            break

          case OpCode.DONE:
            setGameState(payload)
            setGameOver({ reason: payload.reason, winnerMark: payload.winnerMark })
            break

          case OpCode.REJECTED:
            console.warn("Move rejected:", payload.reason)
            break
        }
      }

      await socket.connect(session, true)
      setConnected(true)
      setStatus("Ready")
    }

    connect()
  }, [])

  // When gameState.playerIds changes, fetch names for any new players
  useEffect(() => {
    if (gameState?.playerIds && gameState.playerIds.length > 0) {
      fetchPlayerNames(gameState.playerIds)
    }
  }, [gameState?.playerIds, fetchPlayerNames])

  const setDisplayName = useCallback(async (name: string) => {
    const session = sessionRef.current
    if (!session) return

    await client.updateAccount(session, { display_name: name })
    setUsername(name)
  }, [])

  const findMatch = useCallback(async () => {
    const session = sessionRef.current
    if (!session) return

    setStatus("Finding match...")

    const res = await client.rpc(session, "find_match", {})
    const data = typeof res.payload === "string" ? JSON.parse(res.payload) : res.payload
    const id = data.matchId

    await socketRef.current!.joinMatch(id)
    setMatchId(id)
    setStatus("Waiting for opponent...")
  }, [])

  const joinMatch = useCallback(async (id: string) => {
    const socket = socketRef.current
    if (!socket) return

    const trimmed = id.trim()
    if (!trimmed) return

    await socket.joinMatch(trimmed)
    setMatchId(trimmed)
    setStatus("Joined match!")
  }, [])

  const makeMove = useCallback((position: number) => {
    const socket = socketRef.current
    if (!socket || !matchId) return

    socket.sendMatchState(matchId, OpCode.MOVE, JSON.stringify({ position }))
  }, [matchId])

  const playAgain = useCallback(() => {
    setMatchId("")
    setGameState(null)
    setGameOver(null)
    setPlayers({})
    fetchedIdsRef.current.clear()
    setStatus("Ready")
  }, [])

  return {
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
  }
}
