import { useEffect } from "react"
import client from "./nakamaClient"

function App() {

  useEffect(() => {

    const connect = async () => {

      const session = await client.authenticateDevice(
        crypto.randomUUID()
      )

      console.log("connected user", session.user_id)

      // create websocket connection
      const socket = client.createSocket()

      await socket.connect(session, true)

      console.log("socket connected")

      // create match
      const match = await socket.createMatch()

      console.log("match created", match.match_id, match)
    }

    connect()

  }, [])

  return (
    <div>
      <h1>Tic Tac Toe</h1>
      <p>Connecting to Nakama...</p>
    </div>
  )
}

export default App