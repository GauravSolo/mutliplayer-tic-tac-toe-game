// Op codes must match backend/index.js
// These are "message types" — when the server sends data,
// the op code tells us what kind of message it is.
export const OpCode = {
  STATE: 1,    // server → client: here's the current board
  MOVE: 2,     // client → server: I want to place here
  DONE: 3,     // server → client: game is over
  REJECTED: 4, // server → client: your move was invalid
}

// The game state that the server sends us
export interface GameState {
  board: number[]                        // [0,0,1,0,2,0,0,0,0] — 9 cells
  turn: string                           // userId of whose turn it is
  turnMark: number | null                // 1 (X) or 2 (O)
  playing: boolean                       // is the game in progress?
  winner: string | null                  // userId of winner
  winnerMark: number | null              // 1 or 2
  marks: { [userId: string]: number }    // { "user-abc": 1, "user-xyz": 2 }
  playerIds: string[]                    // ["user-abc", "user-xyz"]
  deadlineMs: number                     // turn deadline timestamp (0 = no timer)
}

// Game over info
export interface GameOverInfo {
  reason: string          // "winner" | "draw" | "opponent_left" | "timeout"
  winnerMark: number | null
}
