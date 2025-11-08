const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const playBtn = document.getElementById("playBtn");
const songUpload = document.getElementById("songUpload");
const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;

let notes = [];
let score = 0;
let keys = {};
let rmsHistory = [];
const historyLength = 1024 * 30;
let lastNoteTime = 0;

// --- Audio & Analyzer ---
let audioElement = new Audio();
audioElement.crossOrigin = "anonymous";
let audioContext, sourceNode, analyzer;

// --- Magenta RNN Model ---
let nnModel;
const MODEL_URL = "model.mag"; // your hosted .mag file

async function loadRNN() {
  nnModel = new music_rnn.MusicRNN(MODEL_URL);
  await nnModel.initialize();
  console.log("Magenta model loaded!");
}
loadRNN();

// --- File upload ---
songUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioElement.src = URL.createObjectURL(file);
  resetGame();
});

// --- Play button ---
playBtn.addEventListener("click", async () => {
  resetGame();
  playBtn.disabled = true;
  playBtn.textContent = "Loading...";

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();

  sourceNode = audioContext.createMediaElementSource(audioElement);
  sourceNode.connect(audioContext.destination);

  analyzer = Meyda.createMeydaAnalyzer({
    audioContext,
    source: sourceNode,
    bufferSize: 1024,
    featureExtractors: ["rms"],
    callback: async (features) => {
      if (!features || !nnModel) return;

      const rms = features.rms;
      const now = audioContext.currentTime;

      // Store RMS
      rmsHistory.push(rms);
      if (rmsHistory.length > historyLength) rmsHistory.shift();

      // --- Magenta prediction (async) ---
      try {
        const seed = { notes: [{ pitch: 60, startTime: 0, endTime: 0.1 }], totalTime: 0.1 };
        const r = await nnModel.continueSequence(seed, 1, 1.0);
        const beatProb = r.notes.length > 0 ? 1 : 0;

        if (beatProb > 0.5 && now - lastNoteTime > 0.2) {
          lastNoteTime = now;
          const laneIndex = Math.floor(Math.random() * lanes.length);
          notes.push({ lane: laneIndex, y: 0, hit: false });
        }

      } catch (err) {
        console.warn("Prediction error:", err);
      }
    }
  });

  analyzer.start();
  await audioElement.play();
  playBtn.textContent = "Playing...";
  gameLoop();
});

// --- Key input ---
window.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", (e) => keys[e.key.toLowerCase()] = false);

// --- Game Loop ---
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw lanes
  lanes.forEach((key, i) => {
    ctx.fillStyle = keys[key] ? "#0f0" : "#333";
    ctx.fillRect(i * laneWidth, 0, laneWidth - 2, canvas.height);
  });

  // Hit line
  ctx.fillStyle = "yellow";
  ctx.fillRect(0, hitY, canvas.width, 5);

  // Draw notes
  notes.forEach((n) => {
    n.y += 5;
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

// --- Reset ---
function resetGame() {
  if (analyzer) analyzer.stop();
  if (audioContext) audioContext.close();

  notes = [];
  score = 0;
  rmsHistory = [];
  lastNoteTime = 0;
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime = 0;
}
