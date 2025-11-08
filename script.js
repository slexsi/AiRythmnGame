// ===== script.js (AI-Driven Rhythm Game using Magenta.js drum_kit_rnn) =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// === AI Visualization Canvas ===
const aiCanvas = document.createElement("canvas");
aiCanvas.width = 600;
aiCanvas.height = 100;
aiCanvas.style.background = "#111";
aiCanvas.style.marginTop = "20px";
document.body.insertBefore(aiCanvas, canvas);
const aiCtx = aiCanvas.getContext("2d");
let aiHistory = [];

// === Buttons ===
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);
const songUpload = document.getElementById("songUpload");

// === Audio ===
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

let audioContext, sourceNode, analyzer;
let rmsHistory = [];
const historyLength = 1024 * 30;

// === Magenta.js Model ===
let rnn;
let sequencePlayer;
let currentPattern = [];
let currentIndex = 0;
let lastNoteTime = 0;
let generating = false;

async function loadRNN() {
  if (rnn) return;
  console.log("Loading Magenta RNN model...");
  rnn = new mm.MusicRNN("https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn");
  await rnn.initialize();
  console.log("Magenta RNN model loaded ✅");
}

// === File Upload ===
songUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioElement.src = URL.createObjectURL(file);
  resetGame();
});

// === Play Button ===
playBtn.addEventListener("click", async () => {
  resetGame();
  playBtn.textContent = "Loading AI...";
  await loadRNN();

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize: 1024,
      featureExtractors: ["rms"],
      callback: (features) => {
        if (!features) return;
        const rms = features.rms;
        rmsHistory.push(rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();
      },
    });

    analyzer.start();
    await audioElement.play();
    playBtn.textContent = "Playing...";

    // Start generating beats from RNN
    generateAIPattern();

    gameLoop();
  } catch (err) {
    console.error(err);
    playBtn.textContent = "▶️ Try Again";
  }
});

// === Generate Rhythm Pattern using AI ===
async function generateAIPattern() {
  if (generating) return;
  generating = true;

  // Create seed: simple kick-snare pattern
  const seed = {
    notes: [
      { pitch: 36, startTime: 0.0, endTime: 0.5 },
      { pitch: 38, startTime: 0.5, endTime: 1.0 },
    ],
    totalTime: 1.0,
  };

  // Generate continuation (AI pattern)
  const continuation = await rnn.continueSequence(seed, 64, 1.1);
  generating = false;
  currentPattern = continuation.notes;

  console.log("AI pattern generated:", currentPattern.length, "notes");
  currentIndex = 0;
  playPattern();
}

// === Spawn Notes from AI pattern ===
function playPattern() {
  if (!currentPattern.length) return;

  const bpm = 120;
  const beatDuration = 60 / bpm;

  function step() {
    if (currentIndex >= currentPattern.length) {
      currentIndex = 0; // loop pattern
    }

    const note = currentPattern[currentIndex];
    const now = audioContext.currentTime;
    const timeSinceLast = now - lastNoteTime;

    if (timeSinceLast >= note.startTime * beatDuration) {
      const laneIndex = Math.floor(Math.random() * lanes.length);
      notes.push({ lane: laneIndex, y: 0, hit: false });
      lastNoteTime = now;

      aiHistory.push(1);
      if (aiHistory.length > aiCanvas.width) aiHistory.shift();
      drawAIVisualization(true);

      currentIndex++;
    }

    requestAnimationFrame(step);
  }
  step();
}

// === Key Input ===
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// === Game Loop ===
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw lanes
  lanes.forEach((key, i) => {
    ctx.fillStyle = keys[key] ? "#0f0" : "#333";
    ctx.fillRect(i * laneWidth, 0, laneWidth - 2, canvas.height);
  });

  // draw hit line
  ctx.fillStyle = "yellow";
  ctx.fillRect(0, hitY, canvas.width, 5);

  // draw notes
  notes.forEach((n) => {
    n.y += 6;
    ctx.fillStyle = "red";
    ctx.fillRect(n.lane * laneWidth + 5, n.y, laneWidth - 10, 30);

    const keyPressed = keys[lanes[n.lane]];
    if (Math.abs(n.y - hitY) < hitWindow && keyPressed && !n.hit) {
      score += 100;
      scoreEl.textContent = "Score: " + score;
      n.hit = true;
    }
  });

  notes = notes.filter(n => !n.hit && n.y < canvas.height);

  requestAnimationFrame(gameLoop);
}

// === AI Visualization ===
function drawAIVisualization(noteSpawned) {
  aiCtx.clearRect(0, 0, aiCanvas.width, aiCanvas.height);
  aiHistory.forEach((val, i) => {
    const h = val * aiCanvas.height;
    aiCtx.fillStyle = "#08f";
    aiCtx.fillRect(i, aiCanvas.height - h, 1, h);
    if (noteSpawned) {
      aiCtx.fillStyle = "#0f8";
      aiCtx.fillRect(i, 0, 1, aiCanvas.height);
    }
  });
}

// === Reset ===
function resetGame() {
  if (analyzer) analyzer.stop();
  if (audioContext) audioContext.close();
  notes = [];
  score = 0;
  rmsHistory = [];
  aiHistory = [];
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime = 0;
  currentPattern = [];
  currentIndex = 0;
  lastNoteTime = 0;
}
