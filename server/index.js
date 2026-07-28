require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { AccessToken } = require("livekit-server-sdk");
const { ACTIONS, TRUTHS, CONSEQUENCES, pick, fillTemplate } = require("./gameData");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // en prod, restreins à l'URL de ton frontend
});

const PFC = [
  { key: "pierre", beats: "ciseaux" },
  { key: "feuille", beats: "pierre" },
  { key: "ciseaux", beats: "feuille" },
];

// État de toutes les parties en mémoire : { [code]: RoomState }
const rooms = {};

function makeRoomCode() {
  let code;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
  } while (rooms[code]);
  return code;
}

function playerNames(room) {
  return room.players.map((p) => p.name);
}

function publicState(room) {
  return {
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    players: room.players.map((p) => ({ name: p.name })),
    losers: room.losers,
    activeLoserIdx: room.activeLoserIdx,
    promptText: room.promptText,
    choiceType: room.choiceType,
    consequenceText: room.consequenceText,
    // On expose seulement QUI a déjà joué/voté, jamais le contenu avant résolution
    pfcSubmittedCount: Object.keys(room.pfcChoices).length,
    votesSubmittedCount: room.votes.length,
    revealChoices:
      room.phase === "pfc-reveal"
        ? room.players.map((p) => ({ name: p.name, choice: room.pfcChoices[p.id] }))
        : null,
  };
}

function broadcastState(code) {
  const room = rooms[code];
  if (room) io.to(code).emit("room-state", publicState(room));
}

function resolvePfcRound(room) {
  const entries = Object.entries(room.pfcChoices); // [socketId, choiceKey]
  const uniqueChoices = new Set(entries.map(([, key]) => key));

  if (uniqueChoices.size === 1) {
    room.pfcChoices = {};
    return; // égalité totale, on relance la manche sans changer de phase
  }

  const loserIds = entries
    .filter(([, key]) => {
      const move = PFC.find((c) => c.key === key);
      return entries.some(([, otherKey]) => otherKey === move.beats);
    })
    .map(([id]) => id);

  if (loserIds.length === 0 || loserIds.length === entries.length) {
    room.pfcChoices = {};
    return; // égalité fonctionnelle, on relance
  }

  room.losers = loserIds.map((id) => room.players.find((p) => p.id === id).name);
  room.loserIds = loserIds;
  room.activeLoserIdx = 0;
  room.phase = "pfc-reveal";
}

io.on("connection", (socket) => {
  socket.on("create-room", ({ name, mode }, cb) => {
    const code = makeRoomCode();
    rooms[code] = {
      code,
      mode: mode === "hard" ? "hard" : "soft",
      phase: "lobby",
      players: [{ id: socket.id, name }],
      pfcChoices: {},
      losers: [],
      loserIds: [],
      activeLoserIdx: 0,
      choiceType: null,
      promptText: "",
      consequenceText: "",
      votes: [],
    };
    socket.join(code);
    cb({ ok: true, code });
    broadcastState(code);
  });

  socket.on("join-room", ({ code, name }, cb) => {
    const room = rooms[code];
    if (!room) return cb({ ok: false, error: "Salle introuvable." });
    if (room.players.length >= 4) return cb({ ok: false, error: "Salle complète (4 max)." });
    if (room.phase !== "lobby") return cb({ ok: false, error: "La partie a déjà commencé." });
    room.players.push({ id: socket.id, name });
    socket.join(code);
    cb({ ok: true, code });
    broadcastState(code);
  });

  socket.on("start-game", ({ code }) => {
    const room = rooms[code];
    if (!room || room.players.length < 2) return;
    room.phase = "pfc";
    room.pfcChoices = {};
    broadcastState(code);
  });

  socket.on("submit-pfc", ({ code, choice }) => {
    const room = rooms[code];
    if (!room || room.phase !== "pfc") return;
    room.pfcChoices[socket.id] = choice;
    if (Object.keys(room.pfcChoices).length === room.players.length) {
      resolvePfcRound(room);
      if (room.phase !== "pfc-reveal") {
        // égalité : on redémarre discrètement la manche
        broadcastState(code);
        return;
      }
    }
    broadcastState(code);
  });

  socket.on("acknowledge-reveal", ({ code }) => {
    const room = rooms[code];
    if (!room || room.phase !== "pfc-reveal") return;
    room.phase = "choice";
    broadcastState(code);
  });

  socket.on("choose-type", ({ code, type }) => {
    const room = rooms[code];
    if (!room || room.phase !== "choice") return;
    const loserName = room.losers[room.activeLoserIdx];
    const pool = type === "action" ? ACTIONS[room.mode] : TRUTHS[room.mode];
    room.choiceType = type;
    room.promptText = fillTemplate(pick(pool), playerNames(room), loserName);
    room.phase = "prompt";
    broadcastState(code);
  });

  socket.on("go-to-vote", ({ code }) => {
    const room = rooms[code];
    if (!room || room.phase !== "prompt") return;
    room.votes = [];
    room.phase = "vote";
    broadcastState(code);
  });

  socket.on("submit-vote", ({ code, value }) => {
    const room = rooms[code];
    if (!room || room.phase !== "vote") return;
    const loserId = room.loserIds[room.activeLoserIdx];
    if (socket.id === loserId) return; // le concerné ne vote pas sur lui-même
    if (room.votes.find((v) => v.voterId === socket.id)) return; // déjà voté
    room.votes.push({ voterId: socket.id, value });

    const totalVoters = room.players.length - 1;
    if (room.votes.length === totalVoters) {
      const noCount = room.votes.filter((v) => v.value === "non").length;
      if (noCount > totalVoters - noCount) {
        room.consequenceText = pick(CONSEQUENCES);
        room.phase = "consequence";
      } else {
        advanceAfterVote(room);
      }
    }
    broadcastState(code);
  });

  socket.on("next-after-consequence", ({ code }) => {
    const room = rooms[code];
    if (!room || room.phase !== "consequence") return;
    advanceAfterVote(room);
    broadcastState(code);
  });

  socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          delete rooms[code];
        } else {
          broadcastState(code);
        }
      }
    }
  });
});

function advanceAfterVote(room) {
  if (room.activeLoserIdx + 1 < room.losers.length) {
    room.activeLoserIdx += 1;
    room.phase = "choice";
  } else {
    room.pfcChoices = {};
    room.losers = [];
    room.loserIds = [];
    room.activeLoserIdx = 0;
    room.phase = "pfc";
  }
}

// ---------- LiveKit : génération de token pour le vocal de groupe ----------
app.post("/livekit-token", async (req, res) => {
  const { roomCode, identity } = req.body;
  if (!roomCode || !identity) return res.status(400).json({ error: "roomCode et identity requis." });

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "LiveKit non configuré côté serveur (clés manquantes)." });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity });
  at.addGrant({ roomJoin: true, room: `game-${roomCode}`, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();
  res.json({ token, livekitUrl: process.env.LIVEKIT_URL });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Serveur de jeu lancé sur le port ${PORT}`));
