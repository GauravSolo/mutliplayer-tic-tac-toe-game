# Multiplayer Tic-Tac-Toe

A real-time, server-authoritative multiplayer Tic-Tac-Toe game built with React and Nakama.

**Live URL**: _(deployment pending)_
**Nakama Server**: _(deployment pending)_

---

## Table of Contents

1. [Architecture](#architecture)
2. [How It Works — Full Game Flow](#how-it-works--full-game-flow)
3. [Server-Authoritative Design](#server-authoritative-design)
4. [Project Structure](#project-structure)
5. [Backend — Match Handler Explained](#backend--match-handler-explained)
6. [Frontend — Component Breakdown](#frontend--component-breakdown)
7. [Setup & Installation](#setup--installation)
8. [How to Test Multiplayer](#how-to-test-multiplayer)
9. [Nakama Configuration](#nakama-configuration)
10. [Features](#features)
11. [Deployment](#deployment)

---

## Architecture

```
+------------------------------------------------------------------+
|                        CLOUD / LOCAL                              |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |                   NAKAMA SERVER (:7350)                       | |
|  |                                                               | |
|  |  +-------------------------+  +----------------------------+  | |
|  |  |   BUILT-IN FEATURES     |  |   OUR CODE                 |  | |
|  |  |   (provided by Nakama)  |  |   (backend/index.js)       |  | |
|  |  |                         |  |                            |  | |
|  |  |  - Authentication       |  |   matchInit()              |  | |
|  |  |  - WebSocket mgmt      |  |     -> empty board          |  | |
|  |  |  - Matchmaking engine   |  |                            |  | |
|  |  |  - Leaderboards         |  |   matchJoinAttempt()       |  | |
|  |  |  - Storage              |  |     -> max 2 players       |  | |
|  |  |  - Session mgmt        |  |                            |  | |
|  |  |                         |  |   matchJoin()              |  | |
|  |  |                         |  |     -> assign X/O, start   |  | |
|  |  |                         |  |                            |  | |
|  |  |                         |  |   matchLoop() (every 1s)   |  | |
|  |  |                         |  |     -> validate moves      |  | |
|  |  |                         |  |     -> check win/draw      |  | |
|  |  |                         |  |     -> broadcast state     |  | |
|  |  |                         |  |     -> handle timeouts     |  | |
|  |  |                         |  |                            |  | |
|  |  |                         |  |   matchLeave()             |  | |
|  |  |                         |  |     -> forfeit on leave    |  | |
|  |  +-------------------------+  +----------------------------+  | |
|  +-------------------------------------------------------------+ |
|                          |                                        |
|                   WebSocket (:7350)                               |
|                          |                                        |
|              +-----------+-----------+                            |
|              |                       |                            |
|     +--------+--------+    +--------+--------+                   |
|     |  PLAYER 1 (X)   |    |  PLAYER 2 (O)   |                  |
|     |  React App       |    |  React App       |                 |
|     |  (Browser)       |    |  (Browser)       |                 |
|     +-----------------+    +-----------------+                   |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |                 CockroachDB (:26257)                         | |
|  |         Stores: users, leaderboards, match history           | |
|  +-------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### What is Nakama?

Nakama is a game server framework. Think of it like Express.js but for games. It provides:

- **Built-in features** (no code needed): authentication, WebSockets, matchmaking, leaderboards, storage
- **Custom logic** (we write this): game rules, move validation, win detection

Our game logic lives in a single JavaScript file (`backend/index.js`) that Nakama loads and executes. We don't need a separate backend server.

---

## How It Works — Full Game Flow

### Step 1: Player Opens the Page

```
Browser                          Nakama Server
  |                                    |
  |-- authenticateDevice(randomUUID) ->|  Creates anonymous user account
  |<----------- session token ---------|  Returns auth token
  |                                    |
  |-- WebSocket connect(session) ----->|  Opens persistent connection
  |<----------- connected ------------|  Ready for real-time messages
```

**Code**: `hooks/useNakama.ts` lines 36-75

### Step 2: Player Clicks "Find Match"

```
Browser                          Nakama Server
  |                                    |
  |-- RPC: "find_match" ------------->|
  |                                    |  rpcFindMatch() runs:
  |                                    |    1. matchList() — any open matches?
  |                                    |    2. If yes → return that match ID
  |                                    |    3. If no → matchCreate("tic_tac_toe")
  |                                    |       This triggers matchInit():
  |                                    |         board = [0,0,0,0,0,0,0,0,0]
  |                                    |         playing = false
  |<----------- { matchId } ----------|
  |                                    |
  |-- joinMatch(matchId) ------------>|
  |                                    |  matchJoinAttempt(): players < 2? allow
  |                                    |  matchJoin(): assign mark (X=1, O=2)
  |<-- broadcastMessage(STATE) -------|  Sends game state to all players
```

**Code**: Backend `rpcFindMatch` (line 247), `matchInit` (line 19), `matchJoin` (line 43)

### Step 3: Second Player Joins

```
Player 2                         Nakama Server                    Player 1
  |                                    |                              |
  |-- joinMatch(matchId) ------------>|                              |
  |                                    |  matchJoin():                |
  |                                    |    player2 = O               |
  |                                    |    playing = true            |
  |                                    |    turn = player1 (X first)  |
  |                                    |                              |
  |<-- broadcastMessage(STATE) -------|--- broadcastMessage(STATE) ->|
  |    { playing: true,               |                              |
  |      turn: player1,               |                              |
  |      board: [0,0,0,0,0,0,0,0,0]} |                              |
```

### Step 4: A Player Makes a Move

```
Player 1                         Nakama Server                    Player 2
  |                                    |                              |
  |  clicks cell 4                     |                              |
  |-- sendMatchState(MOVE, {pos:4}) ->|                              |
  |                                    |  matchLoop() processes:      |
  |                                    |    Is it player1's turn? YES |
  |                                    |    Is cell 4 empty? YES      |
  |                                    |    -> board[4] = 1 (X)       |
  |                                    |    -> checkWinner() = null   |
  |                                    |    -> switch turn to player2 |
  |                                    |                              |
  |<-- broadcastMessage(STATE) -------|--- broadcastMessage(STATE) ->|
  |    { board: [0,0,0,0,1,0,0,0,0], |                              |
  |      turn: player2 }              |                              |
```

**Code**: Backend `matchLoop` (line 94), Frontend `makeMove` in `useNakama.ts`

### Step 5: Game Ends

```
Nakama Server detects win/draw/timeout/disconnect:
  |
  |--- broadcastMessage(DONE, { reason, winnerMark }) --->  Both Players
  |
  matchLoop returns null → match is destroyed
```

### Board Position Mapping

```
 0 | 1 | 2
-----------
 3 | 4 | 5
-----------
 6 | 7 | 8
```

Cell values: `0` = empty, `1` = X, `2` = O

---

## Server-Authoritative Design

### Why Server-Authoritative?

In a client-authoritative game, the client manages the board. A cheater could:
- Play twice in a row
- Place marks on occupied cells
- Declare themselves the winner
- Modify the board directly

In our server-authoritative design, the client is a "dumb terminal". It:
- **Sends intentions**: "I want to place at position 4"
- **Receives state**: "Here's the new board after validation"
- **Never modifies game state directly**

### Server Validation (backend/index.js matchLoop)

Every move goes through these checks before the server applies it:

```
1. Is it this player's turn?        → if not → REJECTED "not_your_turn"
2. Is the data valid JSON?           → if not → REJECTED "invalid_data"
3. Is position 0-8 and integer?      → if not → REJECTED "invalid_position"
4. Is the cell empty?                → if not → REJECTED "cell_occupied"
5. All checks pass                   → apply move, check win, broadcast
```

### Win Detection

The server checks 8 possible winning lines after every move:

```
Rows:      [0,1,2]  [3,4,5]  [6,7,8]
Columns:   [0,3,6]  [1,4,7]  [2,5,8]
Diagonals: [0,4,8]  [2,4,6]
```

If any line has 3 of the same non-zero mark, that player wins.

---

## Project Structure

```
lila-assessment/
├── docker-compose.yml              # Runs Nakama + CockroachDB
│
├── backend/
│   └── index.js                    # ALL server game logic (loaded by Nakama)
│       ├── matchInit()             # Create empty board
│       ├── matchJoinAttempt()      # Allow max 2 players
│       ├── matchJoin()             # Assign X/O, start game
│       ├── matchLoop()             # Validate moves, check win, broadcast
│       ├── matchLeave()            # Handle disconnection
│       ├── rpcFindMatch()          # Matchmaking RPC
│       ├── checkWinner()           # Win detection
│       └── updateLeaderboard()     # Track wins
│
└── frontend/
    └── src/
        ├── main.tsx                # Entry point — mounts <App />
        ├── nakamaClient.ts         # Nakama client config (host, port, key)
        ├── constants.ts            # OpCodes + TypeScript types (shared)
        │
        ├── App.tsx                 # Router: Lobby or Game screen
        │
        ├── hooks/
        │   └── useNakama.ts        # All Nakama communication
        │       ├── connect()       # Auth + WebSocket
        │       ├── findMatch()     # RPC call + join
        │       ├── joinMatch()     # Join by ID
        │       ├── makeMove()      # Send move to server
        │       └── playAgain()     # Reset state
        │
        └── components/
            ├── Lobby.tsx           # "Find Match" + "Join by ID" UI
            ├── Board.tsx           # 3x3 grid (dumb component)
            └── Game.tsx            # Board + status + player info
```

### Data Flow

```
useNakama (hook — talks to Nakama server)
    |
    v
App.tsx (passes data down as props)
    |
    +---> Lobby (no match yet)
    |       receives: connected, status
    |       callbacks: onFindMatch, onJoinMatch
    |
    +---> Game (in a match)
            receives: gameState, userId, gameOver
            callbacks: onMove, onPlayAgain
                |
                +---> Board (just renders cells)
                        receives: board array, disabled flag
                        callback: onCellClick
```

---

## Backend — Match Handler Explained

Nakama requires 7 lifecycle functions for a match handler. Here's what each does:

| Function | When it runs | What it does |
|---|---|---|
| `matchInit` | Match is created | Sets up empty board, `playing = false` |
| `matchJoinAttempt` | Player tries to join | Rejects if already 2 players |
| `matchJoin` | Player successfully joins | Assigns X (first) or O (second), starts game when 2 players are in |
| `matchLoop` | Every tick (1/second) | Processes move messages, validates, checks win/draw, handles timeouts |
| `matchLeave` | Player disconnects | Other player wins by forfeit |
| `matchTerminate` | Server shutting down | Cleanup (no-op for us) |
| `matchSignal` | External signal received | No-op for us |

### Message Types (Op Codes)

| Code | Name | Direction | Purpose |
|---|---|---|---|
| 1 | STATE | Server -> Client | Updated game state after a valid move |
| 2 | MOVE | Client -> Server | Player wants to place at a position |
| 3 | DONE | Server -> Client | Game is over (includes reason) |
| 4 | REJECTED | Server -> Client | Move was invalid (includes reason) |

---

## Frontend — Component Breakdown

### `useNakama.ts` — The Brain

Handles all server communication. Components never talk to Nakama directly.

- **On mount**: Authenticates with a random device ID, opens WebSocket, sets up message listener
- **`findMatch()`**: Calls `find_match` RPC on server, joins the returned match
- **`joinMatch(id)`**: Joins a match by ID (for sharing with friends)
- **`makeMove(position)`**: Sends a MOVE message to the server (position 0-8)
- **`onmatchdata` listener**: Receives STATE/DONE/REJECTED messages, updates React state

### `App.tsx` — The Router

Tiny component. Calls `useNakama()`, then:
- No `matchId`? Render `<Lobby />`
- Has `matchId`? Render `<Game />`

### `Lobby.tsx` — Home Screen

Two options:
1. "Find Match" button — auto matchmaking
2. Text input + "Join" button — paste a match ID from a friend

### `Board.tsx` — The Grid

Receives `board` (9 numbers), `disabled` (boolean), `onCellClick` (function).
Knows nothing about Nakama, matches, or game rules. Just renders cells.

### `Game.tsx` — Game Screen

Combines Board + status text + match ID display + "Play Again" button.
Figures out: am I X or O? Is it my turn? Did I win or lose?

---

## Setup & Installation

### Prerequisites

- Docker and Docker Compose
- Node.js (v18+)

### 1. Start the backend

```bash
# From the project root
docker compose up -d
```

This starts:
- **CockroachDB** on port 26257 (database)
- **Nakama** on port 7350 (game server) — loads `backend/index.js` automatically

Verify it's working:
```bash
docker compose logs nakama | grep "Tic-Tac-Toe module loaded"
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on http://localhost:5173

### 3. Open the Nakama Admin Console (optional)

http://localhost:7351
- Username: `admin`
- Password: `password`

Here you can see active matches, connected users, and leaderboards.

---

## How to Test Multiplayer

### Option A: Two Browser Tabs (quickest)

1. Open http://localhost:5173 in **Tab 1**
2. Click **"Find Match"** — you'll see "Waiting for opponent..." and a match ID
3. Open http://localhost:5173 in **Tab 2**
4. Click **"Find Match"** — Tab 2 will auto-join Tab 1's match
5. Both tabs show the board. X goes first. Click cells to play!

### Option B: Share Match ID

1. Tab 1: Click "Find Match" → copy the match ID shown at the bottom
2. Tab 2: Paste the match ID into the input → click "Join"

### What to verify

- Only the current player's cells are clickable
- Clicking an occupied cell does nothing (server rejects it)
- When someone wins, both players see the result
- Closing a tab = other player wins (opponent left)
- "Play Again" returns to lobby

---

## Nakama Configuration

### Docker Compose Services

| Service | Image | Ports | Purpose |
|---|---|---|---|
| `nakama` | `heroiclabs/nakama:3.38.0` | 7350 (API/WS), 7351 (Admin), 7352 (Console gRPC) | Game server |
| `cockroachdb` | `cockroachdb/cockroach:latest` | 26257, 8080 | Database |

### Nakama Startup Flags

| Flag | Value | Purpose |
|---|---|---|
| `--database.address` | `root@cockroachdb:26257` | Database connection |
| `--logger.level` | `INFO` | Log verbosity |
| `--runtime.js_entrypoint` | `index.js` | Our game logic file |

### Volume Mounts

```yaml
volumes:
  - ./backend:/nakama/data/modules   # Our code → Nakama's module directory
```

Nakama scans `/nakama/data/modules` for runtime code on startup. By mounting our `backend/` directory there, Nakama loads `index.js` automatically.

### Frontend Client Config (`nakamaClient.ts`)

```typescript
const client = new Client("defaultkey", "127.0.0.1", "7350", false)
//                         ^server key   ^host        ^port  ^no SSL
```

---

## Features

### Core (Implemented)

- [x] Server-authoritative game logic — all moves validated server-side
- [x] Real-time multiplayer via WebSocket
- [x] Matchmaking — auto find/create matches via RPC
- [x] Manual join — share match ID with friends
- [x] Win/draw/forfeit detection
- [x] Player disconnect handling
- [x] Leaderboard — tracks wins per player
- [x] Turn timeout support (configurable per match)
- [x] Multiple concurrent matches (each match is isolated)

### Bonus

- [x] Concurrent game support — Nakama handles multiple matches in parallel
- [x] Leaderboard system — wins tracked in `tic_tac_toe_wins` leaderboard
- [x] Timer-based mode — configurable turn timeout with auto-forfeit

---

## Deployment

### Backend (Nakama)

Deploy to any cloud provider that supports Docker:

```bash
# Example: using a remote Docker host
docker compose -f docker-compose.yml up -d
```

Update `nakamaClient.ts` with the server's public IP:
```typescript
const client = new Client("defaultkey", "your-server-ip", "7350", false)
```

### Frontend

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

Deploy the `frontend/dist/` folder to any static hosting (Vercel, Netlify, S3, etc.).

### Production Checklist

- [ ] Change Nakama server key from `"defaultkey"` to a secure key
- [ ] Enable HTTPS/WSS for WebSocket connections
- [ ] Set `useSSL: true` in `nakamaClient.ts`
- [ ] Configure proper session token expiry in Nakama
- [ ] Set up a proper domain and DNS
