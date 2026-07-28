import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Room, RoomEvent, createLocalAudioTrack } from "livekit-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const CHOICES = [
  { key: "pierre", emoji: "✊" },
  { key: "feuille", emoji: "✋" },
  { key: "ciseaux", emoji: "✌️" },
];

export default function App() {
  const socketRef = useRef(null);
  const livekitRoomRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState("home"); // home, create, join, game
  const [myName, setMyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState("soft");
  const [code, setCode] = useState(null);
  const [error, setError] = useState("");
  const [roomState, setRoomState] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState("déconnecté");
  const [micMuted, setMicMuted] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("room-state", (state) => setRoomState(state));
    return () => socket.disconnect();
  }, []);

  async function connectVoice(roomCode, identity) {
    try {
      setVoiceStatus("connexion…");
      const res = await fetch(`${SERVER_URL}/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, identity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur token vocal");

      const room = new Room();
      livekitRoomRef.current = room;
      room.on(RoomEvent.Disconnected, () => setVoiceStatus("déconnecté"));

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "audio") {
          const el = track.attach();
          el.autoplay = true;
          el.dataset.livekitAudio = "true";
          document.body.appendChild(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      await room.connect(data.livekitUrl, data.token);
      const track = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(track);
      setVoiceStatus("connecté 🎙️");
    } catch (e) {
      setVoiceStatus("indisponible (" + e.message + ")");
    }
  }

  function toggleMic() {
    const room = livekitRoomRef.current;
    if (!room) return;
    const newMuted = !micMuted;
    room.localParticipant.audioTracks.forEach((pub) => {
      pub.track && pub.track.mute && (newMuted ? pub.track.mute() : pub.track.unmute());
    });
    setMicMuted(newMuted);
  }

  function createRoom() {
    if (!myName.trim()) return;
    socketRef.current.emit("create-room", { name: myName.trim(), mode }, (res) => {
      if (!res.ok) return setError(res.error || "Erreur");
      setCode(res.code);
      setScreen("game");
      connectVoice(res.code, myName.trim());
    });
  }

  function joinRoom() {
    if (!myName.trim() || !joinCode.trim()) return;
    socketRef.current.emit("join-room", { code: joinCode.trim(), name: myName.trim() }, (res) => {
      if (!res.ok) return setError(res.error || "Erreur");
      setCode(res.code);
      setScreen("game");
      connectVoice(res.code, myName.trim());
    });
  }

  function startGame() {
    socketRef.current.emit("start-game", { code });
  }
  function submitPfc(choice) {
    socketRef.current.emit("submit-pfc", { code, choice });
  }
  function ackReveal() {
    socketRef.current.emit("acknowledge-reveal", { code });
  }
  function chooseType(type) {
    socketRef.current.emit("choose-type", { code, type });
  }
  function goToVote() {
    socketRef.current.emit("go-to-vote", { code });
  }
  function submitVote(value) {
    socketRef.current.emit("submit-vote", { code, value });
  }
  function nextAfterConsequence() {
    socketRef.current.emit("next-after-consequence", { code });
  }

  const iAmActiveLoser =
    roomState && roomState.losers.length
      ? roomState.losers[roomState.activeLoserIdx] === myName
      : false;

  const iHaveSubmittedPfc = roomState && roomState.phase === "pfc"; // affichage géré par pfcSubmittedCount

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          CHI-FOU-MI<span style={styles.titleAccent}>ACTION</span>
        </h1>
        <p style={styles.connStatus}>
          {connected ? "🟢 connecté au serveur" : "🔴 connexion au serveur…"}
        </p>

        {error && <p style={styles.error}>{error}</p>}

        {screen === "home" && (
          <div>
            <input
              style={styles.input}
              placeholder="Ton prénom"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
            />
            <div style={styles.modeRow}>
              <button
                style={{ ...styles.modeButton, ...(mode === "soft" ? styles.modeActive : {}) }}
                onClick={() => setMode("soft")}
              >
                Soft
              </button>
              <button
                style={{ ...styles.modeButton, ...(mode === "hard" ? styles.modeActive : {}) }}
                onClick={() => setMode("hard")}
              >
                Hard
              </button>
            </div>
            <button style={styles.mainButton} onClick={createRoom}>
              Créer une partie
            </button>
            <div style={{ height: 14 }} />
            <input
              style={styles.input}
              placeholder="Code de la salle"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button style={styles.ghostButton} onClick={joinRoom}>
              Rejoindre une partie
            </button>
          </div>
        )}

        {screen === "game" && roomState && (
          <div>
            <div style={styles.roomBar}>
              <span>Salle {roomState.code}</span>
              <span>{voiceStatus}</span>
            </div>
            {roomState.phase === "lobby" && (
              <div style={styles.center}>
                <p style={styles.subtitle}>Joueurs dans la salle :</p>
                {roomState.players.map((p) => (
                  <p key={p.name} style={styles.playerLine}>
                    {p.name}
                  </p>
                ))}
                <button
                  style={{ ...styles.mainButton, opacity: roomState.players.length < 2 ? 0.4 : 1 }}
                  disabled={roomState.players.length < 2}
                  onClick={startGame}
                >
                  Lancer la partie
                </button>
              </div>
            )}

            {roomState.phase === "pfc" && (
              <div style={styles.center}>
                <p style={styles.subtitle}>
                  {roomState.pfcSubmittedCount}/{roomState.players.length} ont choisi
                </p>
                <div style={styles.choiceRow}>
                  {CHOICES.map((c) => (
                    <button key={c.key} style={styles.choiceButton} onClick={() => submitPfc(c.key)}>
                      <span style={styles.choiceEmoji}>{c.emoji}</span>
                    </button>
                  ))}
                </div>
                <p style={styles.hint}>Choisis en secret, les autres ne voient pas ton choix.</p>
              </div>
            )}

            {roomState.phase === "pfc-reveal" && (
              <div style={styles.center}>
                <p style={styles.subtitle}>Résultats</p>
                {(roomState.revealChoices || []).map(({ name, choice }) => {
                  const c = CHOICES.find((x) => x.key === choice);
                  return (
                    <div key={name} style={styles.resultRow}>
                      <span>{name}</span> <span style={styles.choiceEmoji}>{c ? c.emoji : "❓"}</span>
                    </div>
                  );
                })}
                <p style={styles.playerName}>
                  {roomState.losers.join(" & ")} perd{roomState.losers.length > 1 ? "ent" : ""} !
                </p>
                <button style={styles.mainButton} onClick={ackReveal}>
                  Continuer
                </button>
              </div>
            )}

            {roomState.phase === "choice" && (
              <div style={styles.center}>
                <p style={styles.playerName}>{roomState.losers[roomState.activeLoserIdx]}</p>
                {iAmActiveLoser ? (
                  <>
                    <p style={styles.subtitle}>Action ou Vérité ?</p>
                    <div style={styles.avRow}>
                      <button
                        style={{ ...styles.avButton, background: "linear-gradient(135deg,#ff2d95,#ff7a1a)" }}
                        onClick={() => chooseType("action")}
                      >
                        ACTION
                      </button>
                      <button
                        style={{ ...styles.avButton, background: "linear-gradient(135deg,#7b2ff7,#00d4ff)" }}
                        onClick={() => chooseType("verite")}
                      >
                        VÉRITÉ
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={styles.hint}>En attente du choix…</p>
                )}
              </div>
            )}

            {roomState.phase === "prompt" && (
              <div style={styles.center}>
                <p style={styles.passLabel}>
                  {roomState.choiceType === "action" ? "Action pour" : "Vérité pour"}
                </p>
                <p style={styles.playerName}>{roomState.losers[roomState.activeLoserIdx]}</p>
                <div style={styles.promptBox}>{roomState.promptText}</div>
                {iAmActiveLoser && (
                  <button style={styles.mainButton} onClick={goToVote}>
                    Passer au vote
                  </button>
                )}
              </div>
            )}

            {roomState.phase === "vote" && (
              <div style={styles.center}>
                <p style={styles.subtitle}>
                  {roomState.losers[roomState.activeLoserIdx]} a-t-il/elle bien réalisé le défi ?
                </p>
                {!iAmActiveLoser ? (
                  <div style={styles.avRow}>
                    <button
                      style={{ ...styles.avButton, background: "linear-gradient(135deg,#00d4ff,#7b2ff7)" }}
                      onClick={() => submitVote("oui")}
                    >
                      OUI
                    </button>
                    <button
                      style={{ ...styles.avButton, background: "linear-gradient(135deg,#ff2d95,#ff7a1a)" }}
                      onClick={() => submitVote("non")}
                    >
                      NON
                    </button>
                  </div>
                ) : (
                  <p style={styles.hint}>Les autres votent sur ta performance…</p>
                )}
                <p style={styles.hint}>{roomState.votesSubmittedCount} vote(s) reçu(s)</p>
              </div>
            )}

            {roomState.phase === "consequence" && (
              <div style={styles.center}>
                <p style={styles.passLabel}>Conséquence pour</p>
                <p style={styles.playerName}>{roomState.losers[roomState.activeLoserIdx]}</p>
                <div style={styles.promptBox}>{roomState.consequenceText}</div>
                <button style={styles.mainButton} onClick={nextAfterConsequence}>
                  Manche suivante
                </button>
              </div>
            )}

            <button style={styles.micButton} onClick={toggleMic}>
              {micMuted ? "🔇 Micro coupé" : "🎙️ Micro actif"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0d0620",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Poppins', 'Segoe UI', sans-serif",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 28,
    color: "#fff",
    boxShadow: "0 0 60px rgba(123,47,247,0.25)",
  },
  title: { textAlign: "center", fontSize: 24, fontWeight: 800, margin: "0 0 6px 0" },
  titleAccent: {
    background: "linear-gradient(135deg,#ff2d95,#00d4ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginLeft: 6,
  },
  connStatus: { textAlign: "center", fontSize: 11, opacity: 0.6, marginBottom: 18 },
  error: { color: "#ff6b81", textAlign: "center", fontSize: 13, marginBottom: 10 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 16px",
    marginBottom: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 15,
    outline: "none",
  },
  modeRow: { display: "flex", gap: 10, marginBottom: 16 },
  modeButton: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  modeActive: { background: "linear-gradient(135deg,#7b2ff7,#ff2d95)", border: "1px solid transparent" },
  mainButton: {
    width: "100%",
    padding: 16,
    borderRadius: 18,
    border: "none",
    background: "linear-gradient(135deg,#ff2d95,#7b2ff7,#00d4ff)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  ghostButton: {
    width: "100%",
    padding: 14,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.3)",
    background: "transparent",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  roomBar: { display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, marginBottom: 16 },
  center: { textAlign: "center" },
  subtitle: { opacity: 0.75, fontSize: 14, marginBottom: 14 },
  hint: { opacity: 0.55, fontSize: 12, marginTop: 10 },
  playerLine: { fontSize: 16, fontWeight: 600, margin: "4px 0" },
  playerName: { fontSize: 22, fontWeight: 800, margin: "0 0 16px 0" },
  passLabel: { opacity: 0.6, fontSize: 13, marginBottom: 4 },
  choiceRow: { display: "flex", gap: 14, justifyContent: "center", marginBottom: 10 },
  choiceButton: {
    width: 76,
    height: 76,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    cursor: "pointer",
  },
  choiceEmoji: { fontSize: 32 },
  resultRow: {
    display: "inline-block",
    padding: "8px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    margin: 4,
  },
  avRow: { display: "flex", gap: 12, justifyContent: "center", marginTop: 6 },
  avButton: {
    flex: 1,
    padding: "18px 10px",
    borderRadius: 18,
    border: "none",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  promptBox: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 1.4,
  },
  micButton: {
    marginTop: 20,
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    cursor: "pointer",
  },
};
