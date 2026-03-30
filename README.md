# Multiplayer Tic-Tac-Toe

A real-time, server-authoritative multiplayer Tic-Tac-Toe game built with React and Nakama.

**Live URL**: https://mutliplayer-tic-tac-toe-game.vercel.app
**Nakama Server**: https://68-233-113-132.nip.io

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
|                         CLOUD                                     |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |                   NAKAMA SERVER                               | |
|  |         Oracle Cloud VM + Caddy (SSL reverse proxy)           | |
|  |                                                               | |
|  |  +-------------------------+  +----------------------------+  | |
|  |  |   BUILT-IN FEATURES     |  |   OUR CODE                 |  | |
|  |  |   (provided by Nakama)  |  |   (backend/index.js)       |  | |
|  |  |                         |  |                            |  | |
|  |  |  - Authentication       |  |   matchInit()              |  | |
|  |  |  - WebSocket mgmt      |  |     -> empty board          |  | |
|  |  |  - Matchmaking engine   |  |                            |  | |
|  |  |  - Storage              |  |   matchJoinAttempt()       |  | |
|  |  |  - Session mgmt        |  |     -> max 2 players       |  | |
|  |  |                         |  |                            |  | |
|  |  |                         |  |   matchJoin()              |  | |
|  |  |                         |  |     -> assign X/O, start   |  | |
|  |  |                         |  |                            |  | |
|  |  |                         |  |   matchLoop() (every 1s)   |  | |
|  |  |                         |  |     -> validate moves      |  | |
|  |  |                         |  |     -> check win/draw      |  | |
|  |  |                         |  |     -> broadcast state     |  | |
|  |  |                         |  |                            |  | |
|  |  |                         |  |   matchLeave()             |  | |
|  |  |                         |  |     -> forfeit on leave    |  | |
|  |  +-------------------------+  +----------------------------+  | |
|  +-------------------------------------------------------------+ |
|                          |                                        |
|                 WSS (via Caddy :443)                              |
|                          |                                        |
|              +-----------+-----------+                            |
|              |                       |                            |
|     +--------+--------+    +--------+--------+                   |
|     |  PLAYER 1 (X)   |    |  PLAYER 2 (O)   |                  |
|     |  React App       |    |  React App       |                 |
|     |  (Vercel)        |    |  (Vercel)        |                 |
|     +-----------------+    +-----------------+                   |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |                 PostgreSQL (Alpine)                           | |
|  |         Stores: users, sessions, match history               | |
|  +-------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### What is Nakama?

Nakama is a game server framework. Think of it like Express.js but for games. It provides:

- **Built-in features** (no code needed): authentication, WebSockets, matchmaking, storage
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

### Step 2: Player Enters Name and Clicks "Find Match"

```
Browser                          Nakama Server
  |                                    |
  |-- updateAccount(display_name) ---->|  Saves player name
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

### Step 5: Game Ends

```
Nakama Server detects win/draw/disconnect:
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
├── docker-compose.yml              # Runs Nakama + PostgreSQL
├── .gitignore
│
├── backend/
│   └── index.js                    # ALL server game logic (loaded by Nakama)
│       ├── matchInit()             # Create empty board
│       ├── matchJoinAttempt()      # Allow max 2 players
│       ├── matchJoin()             # Assign X/O, start game
│       ├── matchLoop()             # Validate moves, check win, broadcast
│       ├── matchLeave()            # Handle disconnection
│       ├── rpcFindMatch()          # Matchmaking RPC
│       └── checkWinner()           # Win detection
│
└── frontend/
    └── src/
        ├── main.tsx                # Entry point — mounts <App />
        ├── nakamaClient.ts         # Nakama client config (env-based)
        ├── constants.ts            # OpCodes + TypeScript types
        ├── index.css               # Tailwind CSS entry
        │
        ├── App.tsx                 # Router: Name → Lobby → Game
        │
        ├── hooks/
        │   └── useNakama.ts        # All Nakama communication
        │       ├── connect()       # Auth + WebSocket
        │       ├── setDisplayName()# Set player name
        │       ├── findMatch()     # RPC call + join
        │       ├── joinMatch()     # Join by ID
        │       ├── makeMove()      # Send move to server
        │       └── playAgain()     # Reset state
        │
        └── components/
            ├── Lobby.tsx           # "Find Match" + "Join by ID" UI
            ├── Board.tsx           # 3x3 grid (dumb component)
            └── Game.tsx            # Board + status + player names + match ID
```

### Data Flow

```
useNakama (hook — talks to Nakama server)
    |
    v
App.tsx (passes data down as props)
    |
    +---> Name Screen (enter username)
    |
    +---> Lobby (no match yet)
    |       receives: connected, status
    |       callbacks: onFindMatch, onJoinMatch
    |
    +---> Game (in a match)
            receives: gameState, userId, username, players, gameOver
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
| `matchLoop` | Every tick (1/second) | Processes move messages, validates, checks win/draw |
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
- **`setDisplayName()`**: Sets the player's name on the Nakama account
- **`findMatch()`**: Calls `find_match` RPC on server, joins the returned match
- **`joinMatch(id)`**: Joins a match by ID (for sharing with friends)
- **`makeMove(position)`**: Sends a MOVE message to the server (position 0-8)
- **`fetchPlayerNames()`**: Fetches display names for players via `getUsers` API
- **`onmatchdata` listener**: Receives STATE/DONE/REJECTED messages, updates React state

### `App.tsx` — The Router

Calls `useNakama()`, then shows one of three screens:
1. No username? → Name input screen
2. No match? → Lobby
3. In match? → Game

### `Lobby.tsx` — Home Screen

Two options:
1. "Find Match" button — auto matchmaking
2. Text input + "Join" button — paste a match ID from a friend

### `Board.tsx` — The Grid

Receives `board` (9 numbers), `disabled` (boolean), `onCellClick` (function).
Knows nothing about Nakama, matches, or game rules. Just renders cells with classic grid lines.

### `Game.tsx` — Game Screen

Shows player names (You vs Opponent), colored status bar (win/lose/draw/turn), the Board, a copyable match ID, and "Play Again" button.

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
- **PostgreSQL** (Alpine) — lightweight database
- **Nakama** on port 7350 — loads `backend/index.js` automatically

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

### 3. Environment Variables

The frontend reads Nakama connection settings from env vars. For local development, create `frontend/.env`:

```
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_SSL=false
VITE_NAKAMA_KEY=defaultkey
```

### 4. Open the Nakama Admin Console (optional)

http://localhost:7351
- Username: `admin`
- Password: `password`

---

## How to Test Multiplayer

### Option A: Live (deployed)

1. Open https://mutliplayer-tic-tac-toe-game.vercel.app in **Tab 1**
2. Enter a name, click **"Find Match"**
3. Open the same URL in **Tab 2**
4. Enter a name, click **"Find Match"** — auto-joins Tab 1's match
5. Play! X goes first.

### Option B: Share Match ID

1. Tab 1: Click "Find Match" → copy the match ID at the bottom
2. Tab 2: Paste the match ID → click "Join"

### Option C: Local Development

Same as above but use http://localhost:5173

### What to verify

- Player names appear correctly for both players
- Only the current player's cells are clickable
- Clicking an occupied cell does nothing (server rejects it)
- When someone wins, both players see the result
- Closing a tab = other player wins (opponent left)
- "Play Again" returns to lobby
- Match ID is copyable

---

## Nakama Configuration

### Docker Compose Services

| Service | Image | Ports | Purpose |
|---|---|---|---|
| `nakama` | `heroiclabs/nakama:3.38.0` | 7350 (API/WS), 7351 (Admin), 7352 (Console gRPC) | Game server |
| `postgres` | `postgres:15-alpine` | 5432 | Database |

### Nakama Startup Flags

| Flag | Value | Purpose |
|---|---|---|
| `--database.address` | `postgres:localdb@postgres:5432/nakama` | Database connection |
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
const host = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1"
const port = import.meta.env.VITE_NAKAMA_PORT || "7350"
const useSSL = import.meta.env.VITE_NAKAMA_SSL === "true"
const serverKey = import.meta.env.VITE_NAKAMA_KEY || "defaultkey"

const client = new Client(serverKey, host, port, useSSL)
```

---

## Features

- [x] Server-authoritative game logic — all moves validated server-side
- [x] Real-time multiplayer via WebSocket (WSS in production)
- [x] Matchmaking — auto find/create matches via RPC
- [x] Manual join — share match ID with friends
- [x] Win/draw/forfeit detection
- [x] Player disconnect handling
- [x] Player names — username input + display in game
- [x] Multiple concurrent matches (each match is isolated)
- [x] Responsive UI with Tailwind CSS (mobile-friendly)
- [x] Copyable match ID for sharing

---

## Deployment

### Current Setup

- **Frontend**: Vercel (https://mutliplayer-tic-tac-toe-game.vercel.app)
- **Backend**: Oracle Cloud free-tier VM (Ubuntu, Docker)
- **SSL**: Caddy reverse proxy with auto Let's Encrypt certificates via nip.io
- **Database**: PostgreSQL 15 Alpine (inside Docker)

### Backend (Oracle Cloud VM)

1. Create an always-free VM (VM.Standard.E2.1.Micro, Ubuntu)
2. Install Docker:
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose-v2
   ```
3. Copy `backend/index.js` and `docker-compose.yml` to the VM
4. Start services:
   ```bash
   sudo docker compose up -d
   ```
5. Install Caddy for SSL:
   ```bash
   # Install Caddy, then configure:
   # /etc/caddy/Caddyfile
   68-233-113-132.nip.io {
       reverse_proxy localhost:7350
   }
   ```
6. Open ports 80, 443, 7350 in Oracle security list and VM iptables

### Frontend (Vercel)

1. Connect GitHub repo to Vercel
2. Set root directory to `frontend`
3. Add environment variables:
   ```
   VITE_NAKAMA_HOST = 68-233-113-132.nip.io
   VITE_NAKAMA_PORT = 443
   VITE_NAKAMA_SSL = true
   VITE_NAKAMA_KEY = defaultkey
   ```
4. Deploy — auto-builds on push to master
