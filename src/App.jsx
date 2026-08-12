import React, { useEffect, useMemo, useRef, useState } from "react";
import { db, firebaseConfigured } from "./firebase";
import { ref, get, set, update, remove, onValue, onDisconnect } from "firebase/database";
import { GAMES, QUIZ, MOVIES } from "./data";

const PLAYER_KEY = "tiranga_player_id";

function getPlayerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function App() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");
  const playerId = useMemo(getPlayerId, []);
  const channelRef = useRef(null);

  const me = players.find(p => p.player_id === playerId);
  const isHost = Boolean(room && room.host_id === playerId);

  useEffect(() => {
    const saved = sessionStorage.getItem("tiranga-room");
    if (saved && firebaseConfigured) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.code && parsed.playerId) {
          setRoomCode(parsed.code);
          setName(parsed.name || "");
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!room || !firebaseConfigured) return;
    const roomRef = ref(db, `rooms/${room.id}`);
    const playersRef = ref(db, `rooms/${room.id}/players`);

    const unsubRoom = onValue(roomRef, snap => {
      const value = snap.val();
      if (value) setRoom({ ...value, id: room.id });
    });

    const unsubPlayers = onValue(playersRef, snap => {
      const value = snap.val() || {};
      setPlayers(Object.values(value).sort((x, y) => (x.joined_at || 0) - (y.joined_at || 0)));
    });

    onDisconnect(ref(db, `rooms/${room.id}/players/${playerId}`)).remove();

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [room?.id, playerId]);

  useEffect(() => {
    if (!room) return;
    if (room.status === "playing") setScreen("game");
    if (room.status === "finished") setScreen("results");
  }, [room?.status]);

  async function createRoom() {
    if (!name.trim()) return setError("Enter your name first.");
    setError("");
    const code = makeCode();
    const roomId = crypto.randomUUID();
    const data = { id: roomId, code, host_id: playerId, status: "lobby", game_index: 0, start_at: null, created_at: Date.now() };
    await set(ref(db, `rooms/${roomId}`), data);
    await set(ref(db, `rooms/${roomId}/players/${playerId}`), { player_id: playerId, name: name.trim(), score: 0, joined_at: Date.now() });
    sessionStorage.setItem("tiranga-room", JSON.stringify({ code, name: name.trim(), playerId, roomId }));
    setRoom(data);
    setRoomCode(code);
    setScreen("lobby");
  }

  async function joinRoom() {
    if (!name.trim() || !roomCode.trim()) return setError("Enter your name and room code.");
    setError("");
    const snap = await get(ref(db, "rooms"));
    let data = null;
    snap.forEach(child => {
      if (child.val()?.code === roomCode.trim().toUpperCase()) data = { ...child.val(), id: child.key };
    });
    if (!data) return setError("Room not found. Check the code.");
    if (data.status !== "lobby") return setError("This game has already started.");
    await set(ref(db, `rooms/${data.id}/players/${playerId}`), { player_id: playerId, name: name.trim(), score: 0, joined_at: Date.now() });
    sessionStorage.setItem("tiranga-room", JSON.stringify({ code: data.code, name: name.trim(), playerId, roomId: data.id }));
    setRoom(data);
    setRoomCode(data.code);
    setScreen("lobby");
  }

  async function startGame() {
    if (!isHost) return;
    const startAt = new Date(Date.now() + 3500).toISOString();
    await update(ref(db, `rooms/${room.id}`), { status: "starting", start_at: startAt, game_index: 0 });
    setTimeout(async () => {
      const snap = await get(ref(db, `rooms/${room.id}`));
      if (snap.val()?.host_id === playerId) await update(ref(db, `rooms/${room.id}`), { status: "playing" });
    }, 3500);
  }

  async function leaveRoom() {
    if (!room) return;
    await remove(ref(db, `rooms/${room.id}/players/${playerId}`));
    if (isHost) {
      const next = players.find(p => p.player_id !== playerId);
      if (next) await update(ref(db, `rooms/${room.id}`), { host_id: next.player_id });
    }
    sessionStorage.removeItem("tiranga-room");
    setRoom(null); setPlayers([]); setScreen("home");
  }

  if (!firebaseConfigured) {
    return <SetupScreen />;
  }

  if (screen === "home") {
    return <Home name={name} setName={setName} roomCode={roomCode} setRoomCode={setRoomCode}
      createRoom={createRoom} joinRoom={joinRoom} error={error} />;
  }

  if (screen === "lobby") {
    return <Lobby room={room} players={players} isHost={isHost} startGame={startGame}
      leaveRoom={leaveRoom} error={error} />;
  }

  if (screen === "game") {
    return <GameRoom room={room} players={players} me={me} isHost={isHost} />;
  }

  return <Results players={players} leaveRoom={leaveRoom} />;
}

function SetupScreen() {
  return <div className="app-shell"><div className="setup card">
    <div className="flag">🇮🇳</div>
    <h1>One small setup step</h1>
    <p>This rebuild uses Supabase Realtime so every phone shares the same lobby and game state.</p>
    <p>Copy <b>.env.example</b> to <b>.env</b>, add your Supabase URL and anon key, then run the app.</p>
    <pre>npm install{"\n"}npm run dev</pre>
  </div></div>;
}

function Home({ name, setName, roomCode, setRoomCode, createRoom, joinRoom, error }) {
  return <div className="app-shell">
    <header className="hero">
      <div className="flag">🇮🇳</div>
      <div>
        <div className="eyebrow">TIRANGA • GAME NIGHT</div>
        <h1>Freedom Games</h1>
        <p>One room. Everyone plays together.</p>
      </div>
    </header>

    <section className="host-note">
      <b>👑 Host is automatic.</b> The person who creates the room becomes the host. No special name is required.
    </section>

    <div className="card join-card">
      <label>Your name</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Raghav" maxLength={24} />
      <button className="primary" onClick={createRoom}>＋ Create New Room</button>
      <div className="or">OR JOIN A ROOM</div>
      <div className="join-row">
        <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} />
        <button onClick={joinRoom}>Join</button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>

    <section>
      <h2>🎮 Pick a Game</h2>
      {GAMES.map((g, i) => <GameCard key={g.title} game={g} index={i} />)}
    </section>

    <div className="flow">
      <b>Suggested event flow (~25 min):</b>
      <div>1 Freedom Quiz → 2 Movie Challenge → 3 Balloon Shooter → 4 Tiranga Catch → 5 Chakra Tap</div>
    </div>
  </div>;
}

function GameCard({ game, index }) {
  return <article className={`game-card ${game.tone}`}>
    <div className="number">{index + 1}</div>
    <div className="game-copy">
      <h3>{game.title}</h3>
      <p>{game.description}</p>
      <div className="meta">⏱ {game.duration} • {game.type}</div>
    </div>
    <div className="game-emoji">{game.emoji}</div>
  </article>;
}

function Lobby({ room, players, isHost, startGame, leaveRoom, error }) {
  return <div className="app-shell">
    <div className="lobby-top">
      <div className="flag">🇮🇳</div>
      <div>
        <div className="eyebrow">GAME LOBBY</div>
        <h1>{room.code}</h1>
      </div>
      <button className="ghost" onClick={leaveRoom}>Leave</button>
    </div>

    <div className="card room-card">
      <div className="room-label">SHARE THIS CODE</div>
      <div className="big-code">{room.code}</div>
      <p>Ask everyone to open the game and enter this room code.</p>
    </div>

    <div className="card players-card">
      <div className="section-row">
        <h2>Players</h2><span>{players.length}</span>
      </div>
      <div className="players">
        {players.map(p => <div className="player" key={p.player_id}>
          <div className="avatar">{p.name[0]?.toUpperCase()}</div>
          <div className="player-name">{p.name}</div>
          {p.player_id === room.host_id && <span className="host-pill">👑 HOST</span>}
          {p.player_id !== room.host_id && <span className="ready-pill">READY</span>}
        </div>)}
      </div>
    </div>

    <div className="host-control card">
      {room.status === "starting" ? (
        <Countdown startAt={room.start_at} />
      ) : isHost ? (
        <>
          <div className="host-title">👑 You're the host</div>
          <p>Everyone is connected. Start once you're ready.</p>
          <button className="start-btn" onClick={startGame}>▶ Start for Everyone</button>
        </>
      ) : (
        <>
          <div className="host-title">⏳ Waiting for host…</div>
          <p>The host will start the game for everyone at the same time.</p>
        </>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  </div>;
}

function Countdown({ startAt }) {
  const [left, setLeft] = useState(4);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(startAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startAt]);
  return <div className="starting"><div className="starting-label">STARTING FOR EVERYONE</div><div className="count">{left || "GO!"}</div></div>;
}

function GameRoom({ room, players, me, isHost }) {
  const [gameIndex, setGameIndex] = useState(room.game_index || 0);
  const [gameComplete, setGameComplete] = useState(false);
  useEffect(() => { setGameIndex(room.game_index || 0); setGameComplete(false); }, [room.game_index]);

  const game = GAMES[gameIndex];
  async function advanceGame() {
    if (!isHost || !room) return;
    if (gameIndex >= GAMES.length - 1) {
      await update(ref(db, `rooms/${room.id}`), { status: "finished", game_index: gameIndex });
      return;
    }
    await update(ref(db, `rooms/${room.id}`), { status: "playing", game_index: gameIndex + 1 });
  }

  return <div className="app-shell">
    <div className="game-head">
      <div><span className="eyebrow">LIVE GAME {gameIndex + 1} / {GAMES.length}</span><h1>{game.title}</h1></div>
      <div className="live-dot">● LIVE</div>
    </div>

    {gameIndex === 0 && <QuizGame room={room} me={me} onComplete={() => setGameComplete(true)} />}
    {gameIndex === 1 && <MovieGame room={room} me={me} onComplete={() => setGameComplete(true)} />}
    {gameIndex === 2 && <BalloonGame room={room} me={me} onComplete={() => setGameComplete(true)} />}
    {gameIndex === 3 && <CatchGame room={room} me={me} onComplete={() => setGameComplete(true)} />}
    {gameIndex === 4 && <TapGame room={room} me={me} onComplete={() => setGameComplete(true)} />}

    {gameComplete && isHost && <div className="card host-control">
      <div className="host-title">🎯 Game complete</div>
      <p>Everyone's results are being saved. Move the whole room to the next game.</p>
      <button className="start-btn" onClick={advanceGame}>
        {gameIndex === GAMES.length - 1 ? "🏆 Show Final Results" : "Next Game →"}
      </button>
    </div>}
    {gameComplete && !isHost && <div className="card host-control">
      <div className="host-title">⏳ Waiting for host…</div>
      <p>Your score has been saved. The host will move everyone to the next game.</p>
    </div>}

    <div className="mini-leaderboard card">
      <div className="section-row"><h2>Leaderboard</h2><span>{players.length} players</span></div>
      {[...players].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,5).map((p,i)=>(
        <div className="score-row" key={p.player_id}><b>#{i+1}</b><span>{p.name}</span><strong>{p.score||0}</strong></div>
      ))}
    </div>
  </div>;
}

async function saveAnswer(room, me, gameKey, questionNumber, answerIndex, correct, points) {
  if (!room || !me) return;
  const answerRef = ref(db, `rooms/${room.id}/players/${me.player_id}/answers/${gameKey}/${questionNumber}`);
  const existing = await get(answerRef);
  if (existing.exists()) return;
  await set(answerRef, {
    answerIndex,
    correct,
    points,
    answeredAt: Date.now()
  });
  if (points > 0) {
    await update(ref(db, `rooms/${room.id}/players/${me.player_id}`), {
      score: (me.score || 0) + points
    });
  }
}

function QuizGame({ room, me, onComplete }) {
  const [q, setQ] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [time, setTime] = useState(12);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done || answered) return;
    const id = setInterval(() => setTime(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [q, answered, done]);

  const current = QUIZ[q];

  async function answer(i) {
    if (answered || done || !me || !current) return;
    setAnswered(true);
    const correct = i === current[2];
    const points = correct ? Math.max(10, time) : 0;
    await saveAnswer(room, me, "quiz", q + 1, i, correct, points);
  }

  function next() {
    if (q >= QUIZ.length - 1) {
      setDone(true);
      onComplete();
      return;
    }
    setAnswered(false);
    setTime(12);
    setQ(v => v + 1);
  }

  if (done) return <div className="play-card card"><div className="question-count">QUIZ COMPLETE</div><h2>🎉 All {QUIZ.length} questions answered!</h2><p>Your answers and score have been saved.</p></div>;

  return <div className="play-card card">
    <div className="timer">⏱ {time}s</div>
    <div className="question-count">QUESTION {q + 1} / {QUIZ.length}</div>
    <h2>{current[0]}</h2>
    <div className="answers">{current[1].map((a,i)=>(
      <button className={answered ? (i===current[2] ? "correct" : "muted") : ""} key={a} onClick={()=>answer(i)}>{String.fromCharCode(65+i)}. {a}</button>
    ))}</div>
    {answered && <button className="next-btn" onClick={next}>{q === QUIZ.length - 1 ? "Finish Quiz →" : "Next question →"}</button>}
  </div>;
}

function MovieGame({ room, me, onComplete }) {
  const [round, setRound] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [done, setDone] = useState(false);
  const current = MOVIES[round];

  async function answer(i) {
    if (answered || done || !current) return;
    setAnswered(true);
    const correct = i === current[2];
    await saveAnswer(room, me, "movie", round + 1, i, correct, correct ? 20 : 0);
  }

  function next() {
    if (round >= MOVIES.length - 1) {
      setDone(true);
      onComplete();
      return;
    }
    setRound(r=>r+1);
    setAnswered(false);
  }

  if (done) return <div className="play-card card"><div className="question-count">MOVIE CHALLENGE COMPLETE</div><h2>🎬 All {MOVIES.length} rounds complete!</h2><p>Your results have been saved.</p></div>;

  return <div className="play-card card">
    <div className="question-count">ROUND {round+1} / {MOVIES.length}</div>
    <div className="movie-clue">{current[0]}</div>
    <h2>Which patriotic movie is this?</h2>
    <div className="answers">{current[1].map((a,i)=>(
      <button className={answered ? (i===current[2] ? "correct" : "muted") : ""} key={a} onClick={()=>answer(i)}>{a}</button>
    ))}</div>
    {answered && <button className="next-btn" onClick={next}>{round === MOVIES.length - 1 ? "Finish Challenge →" : "Next round →"}</button>}
  </div>;
}

function BalloonGame({ room, me, onComplete }) {
  const [score, setScore] = useState(0);
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(true);
  const saved = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const id = crypto.randomUUID();
      setItems(x => [...x.slice(-5), {id, left: 10 + Math.random()*80, emoji: Math.random()>.14 ? "🎈" : "💣"}]);
    }, 600);
    const end = setTimeout(() => setRunning(false), 30000);
    return () => { clearInterval(id); clearTimeout(end); };
  }, [running]);

  useEffect(() => {
    if (!running && !saved.current) {
      saved.current = true;
      saveMiniGameScore(room, me, "balloon", score);
      onComplete();
    }
  }, [running]);

  return <div className="arcade card">
    <div className="arcade-score">Score {score} • 30s</div>
    <div className="arcade-stage">{items.map(x =>
      <button className="floating" style={{left:`${x.left}%`}} key={x.id} onClick={()=>{
        setItems(a=>a.filter(y=>y.id!==x.id));
        if(x.emoji==="🎈") setScore(s=>s+10); else setScore(s=>Math.max(0,s-25));
      }}>{x.emoji}</button>
    )}</div>
    {!running && <div className="game-over">TIME!</div>}
  </div>;
}

function CatchGame({ room, me, onComplete }) {
  const [score, setScore] = useState(0);
  const [x, setX] = useState(50);
  const [items, setItems] = useState([]);
  const [time, setTime] = useState(30);
  const saved = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setItems(a=>[...a.slice(-8), {id:crypto.randomUUID(), left:10+Math.random()*80, top:0, emoji:Math.random()>.15 ? (Math.random()>.5?"🪔":"🇮🇳"):"💣"}]);
    }, 700);
    const move = setInterval(() => setItems(a=>a.map(i=>({...i,top:i.top+4})).filter(i=>i.top<100)), 120);
    const timer = setInterval(() => setTime(t=>Math.max(0,t-1)),1000);
    return () => { clearInterval(id); clearInterval(move); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (time === 0 && !saved.current) {
      saved.current = true;
      saveMiniGameScore(room, me, "catch", score);
      onComplete();
    }
  }, [time]);

  useEffect(() => {
    setItems(a=>a.filter(i=>{
      if(i.top>82 && Math.abs(i.left-x)<10){
        if(i.emoji==="💣") setScore(s=>Math.max(0,s-20)); else setScore(s=>s+10);
        return false;
      }
      return true;
    }));
  }, [items.length, x]);

  return <div className="arcade card">
    <div className="arcade-score">Score {score} • {time}s</div>
    <div className="catch-stage">{items.map(i=><span key={i.id} className="falling" style={{left:`${i.left}%`,top:`${i.top}%`}}>{i.emoji}</span>)}<div className="basket" style={{left:`${x}%`}}>🧺</div></div>
    <input aria-label="Move basket" type="range" min="5" max="95" value={x} onChange={e=>setX(+e.target.value)} />
  </div>;
}

function TapGame({ room, me, onComplete }) {
  const [target, setTarget] = useState({x:50,y:50,emoji:"🎈"});
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const saved = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setTime(t=>Math.max(0,t-1)),1000);
    return ()=>clearInterval(id);
  },[]);

  useEffect(() => {
    if (time === 0 && !saved.current) {
      saved.current = true;
      saveMiniGameScore(room, me, "chakra", score);
      onComplete();
    }
  }, [time]);

  function spawn() {
    setTarget({x:10+Math.random()*80,y:10+Math.random()*70,emoji:Math.random()>.15?"🎈":"💣"});
  }
  return <div className="arcade card">
    <div className="arcade-score">Score {score} • {time}s</div>
    <div className="tap-stage">
      <button className="tap-target" style={{left:`${target.x}%`,top:`${target.y}%`}} onClick={()=>{setScore(s=>target.emoji==="🎈"?s+10:Math.max(0,s-30));spawn()}}>{target.emoji}</button>
    </div>
  </div>;
}

async function saveMiniGameScore(room, me, gameKey, score) {
  if (!room || !me) return;
  const scoreRef = ref(db, `rooms/${room.id}/players/${me.player_id}/gameScores/${gameKey}`);
  const existing = await get(scoreRef);
  if (existing.exists()) return;
  await set(scoreRef, { score, completedAt: Date.now() });
  await update(ref(db, `rooms/${room.id}/players/${me.player_id}`), { score: (me.score || 0) + score });
}

function Results({ players, leaveRoom }) {
  const sorted = [...players].sort((a,b)=>b.score-a.score);
  return <div className="app-shell">
    <div className="results">
      <div className="flag">🇮🇳</div><div className="eyebrow">FINAL RESULTS</div><h1>🏆 Winners</h1>
      <div className="podium">
        {sorted.slice(0,3).map((p,i)=><div className="pod" key={p.player_id}><div className="medal">{["🥇","🥈","🥉"][i]}</div><b>{p.name}</b><strong>{p.score}</strong></div>)}
      </div>
      <button className="primary" onClick={leaveRoom}>Back to home</button>
    </div>
  </div>;
}

export default App;
