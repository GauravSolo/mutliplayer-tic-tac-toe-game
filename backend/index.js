"use strict";

// Op codes — message types between client and server
var OpCode = {
  STATE: 1,    // server sends full game state
  MOVE: 2,     // client sends a move
  DONE: 3,     // server says game is over
  REJECTED: 4, // server rejects an invalid move
};

// 1. matchInit
var matchInit = function (ctx, logger, nk, params) {
  var state = {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0], // 0=empty, 1=X, 2=O
    marks: {},           // { oddi: 1, oddi2: 2 } — who is X, who is O
    turn: "",            // userId of current player
    deadlineMs: 0,
    winner: null,
    playing: false,
    playerIds: [],
    turnTimeout: params.timeout ? parseInt(params.timeout) : 0,
  };

  return { state: state, tickRate: 1, label: "tic_tac_toe" };
};

// 2. matchJoinAttempt
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  if (state.playerIds.length >= 2) {
    return { state: state, accept: false, rejectMessage: "Match is full" };
  }
  return { state: state, accept: true };
};

// 3. matchJoin 
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var userId = presences[i].userId;

    if (state.playerIds.indexOf(userId) !== -1) continue; // already in

    if (state.playerIds.length === 0) {
      state.marks[userId] = 1; // X
      state.playerIds.push(userId);
    } else if (state.playerIds.length === 1) {
      state.marks[userId] = 2; // O
      state.playerIds.push(userId);
    }
  }

  // Start game when 2 players are in
  if (state.playerIds.length === 2 && !state.playing) {
    state.playing = true;
    state.turn = state.playerIds[0]; // X goes first

    if (state.turnTimeout > 0) {
      state.deadlineMs = Date.now() + state.turnTimeout * 1000;
    }

    logger.info("Game started: %s (X) vs %s (O)", state.playerIds[0], state.playerIds[1]);
  }

  dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify(getPublicState(state)));
  return { state: state };
};

// 4. matchLeave
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    if (state.playing) {
      var remaining = state.playerIds.filter(function (id) { return id !== presences[i].userId; });
      if (remaining.length > 0) {
        state.winner = remaining[0];
        state.playing = false;
        dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify({
          board: state.board, turn: "", playing: false,
          winner: state.winner, winnerMark: state.marks[state.winner],
          marks: state.marks, playerIds: state.playerIds, reason: "opponent_left",
        }));
      }
    }
  }
  return { state: state };
};

// 5. matchLoop — runs every tick (1/sec). Processes moves, checks wins.
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
  // Game over — end match
  if (!state.playing && state.winner !== null) return null;

  // Waiting for players
  if (!state.playing) return { state: state };

  // Check turn timeout
  if (state.turnTimeout > 0 && state.deadlineMs > 0 && Date.now() > state.deadlineMs) {
    var other = state.playerIds.filter(function (id) { return id !== state.turn; })[0];
    state.winner = other;
    state.playing = false;
    dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify({
      board: state.board, turn: "", playing: false,
      winner: other, winnerMark: state.marks[other],
      marks: state.marks, playerIds: state.playerIds, reason: "timeout",
    }));
    return { state: state };
  }

  // Process moves
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (msg.opCode !== OpCode.MOVE) continue;

    var userId = msg.sender.userId;

    // Not your turn
    if (userId !== state.turn) {
      dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: "not_your_turn" }), [msg.sender]);
      continue;
    }

    // Parse move
    var move;
    try { move = JSON.parse(nk.binaryToString(msg.data)); } catch (e) {
      dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: "invalid_data" }), [msg.sender]);
      continue;
    }

    var pos = move.position;

    // Invalid position
    if (pos < 0 || pos > 8 || pos !== Math.floor(pos)) {
      dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: "invalid_position" }), [msg.sender]);
      continue;
    }

    // Cell taken
    if (state.board[pos] !== 0) {
      dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: "cell_occupied" }), [msg.sender]);
      continue;
    }

    // --- Move is valid, apply it ---
    state.board[pos] = state.marks[userId];

    // Check win
    var winMark = checkWinner(state.board);
    if (winMark) {
      state.winner = userId;
      state.playing = false;
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify({
        board: state.board, turn: "", playing: false,
        winner: userId, winnerMark: winMark,
        marks: state.marks, playerIds: state.playerIds, reason: "winner",
      }));
      return { state: state };
    }

    // Check draw
    var isFull = state.board.every(function (c) { return c !== 0; });
    if (isFull) {
      state.playing = false;
      state.winner = null;
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify({
        board: state.board, turn: "", playing: false,
        winner: null, winnerMark: null,
        marks: state.marks, playerIds: state.playerIds, reason: "draw",
      }));
      return { state: state };
    }

    // Switch turn
    state.turn = state.playerIds.filter(function (id) { return id !== userId; })[0];
    if (state.turnTimeout > 0) {
      state.deadlineMs = Date.now() + state.turnTimeout * 1000;
    }

    dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify(getPublicState(state)));
  }

  return { state: state };
};

var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return { state: state };
};

var matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
  return { state: state, data: "" };
};

function getPublicState(s) {
  return {
    board: s.board,
    turn: s.turn,
    turnMark: s.marks[s.turn] || null,
    playing: s.playing,
    winner: s.winner,
    winnerMark: s.winner ? s.marks[s.winner] : null,
    marks: s.marks,
    playerIds: s.playerIds,
    deadlineMs: s.deadlineMs,
  };
}

function checkWinner(board) {
  var lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6],            // diagonals
  ];
  for (var i = 0; i < lines.length; i++) {
    var a = lines[i][0], b = lines[i][1], c = lines[i][2];
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return null;
}

var rpcFindMatch = function (ctx, logger, nk, payload) {
  var params = {};
  if (payload) try { params = JSON.parse(payload); } catch (e) {}

  // Look for a match with 0-1 players (has room)
  var matches = nk.matchList(10, true, "tic_tac_toe", 0, 1, "*");

  if (matches.length > 0) {
    return JSON.stringify({ matchId: matches[0].matchId });
  }

  // No open match, create one
  var matchId = nk.matchCreate("tic_tac_toe", { timeout: "0" });

  return JSON.stringify({ matchId: matchId });
};

var InitModule = function (ctx, logger, nk, initializer) {
  initializer.registerMatch("tic_tac_toe", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });

  initializer.registerRpc("find_match", rpcFindMatch);

  logger.info("Tic-Tac-Toe module loaded!");
};
