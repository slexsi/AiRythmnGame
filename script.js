const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// AI / NN visualization canvas
const nnCanvas = document.getElementById("nnCanvas");
const nnCtx = nnCanvas.getContext("2d");
let nnHistory = [];

// Buttons
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);
const songUpload = document.getElementById("songUpload");

// Audio
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

let audioContext, sourceNode, analyzer;
let rmsHistory = [];
const historyLength = 1024 * 30;

// --- Magenta MusicRNN Setup ---
const rnnModel = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn');
let rnnReady = false;

rnnModel.initialize().then(() => {
  console.log("RNN model loaded.");
  rnnReady = true;
});

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
  playBtn.textContent = "Loading...";

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    let lastNoteTime = 0;

    analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize: 1024,
      featureExtractors: ["rms"],
      callback: async (features) => {
        if (!features) return;
        const rms = features.rms;
        const now = audioContext.currentTime;

        // --- store RMS ---
        rmsHistory.push(rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();

        // --- Neural Network Prediction ---
        let beatProb = 0;
        if (rnnReady) {
          // Create a simple dummy sequence for prediction
          const seq = {
            notes: [{ pitch: 36, startTime: 0, endTime: 0.1 }], // Kick drum
            totalTime: 0.5
          };
          const continuation = await rnnModel.continueSequence(seq, 1, 1.0);
          // If a note is predicted, we treat it as a beat
          beatProb = continuation.notes.length > 0 ? 1 : 0;
        }

        // spawn note if NN predicts
        let noteSpawned = false;
        if (beatProb > 0.5 && now - lastNoteTime > 0.2) {
          lastNoteTime = now;
          const laneIndex = Math.floor(Math.random() * lanes.length);
          notes.push({ lane: laneIndex, y: 0, hit: false });
          noteSpawned = true;
        }

        // --- AI Visualization ---
        nnHistory.push(beatProb);
        if (nnHistory.length > nnCanvas.width) nnHistory.shift();
        drawNNVisualization(noteSpawned);
      },
    });

    analyzer.start();
    await audioElement.play();
    playBtn.textContent = "Playing...";
    gameLoop();
  } catch (err) {
    console.error(err);
    playBtn.textContent = "▶️ Try Again";
  }
});

// --- Key input ---
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// --- Main game loop ---
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

// --- AI / NN Visualization ---
function drawNNVisualization(noteSpawned) {
  nnCtx.clearRect(0, 0, nnCanvas.width, nnCanvas.height);
  nnHistory.forEach((val, i) => {
    const h = val * nnCanvas.height;
    nnCtx.fillStyle = "#08f";
    nnCtx.fillRect(i, nnCanvas.height - h, 1, h);

    if (val > 0.5 && noteSpawned) {
      nnCtx.fillStyle = "#0f8";
      nnCtx.fillRect(i, 0, 1, nnCanvas.height);
    }
  });
}

// --- Reset ---
function resetGame() {
  if (analyzer) analyzer.stop();
  if (audioContext) audioContext.close();

  notes = [];
  score = 0;
  rmsHistory = [];
  nnHistory = [];
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime = 0;
}
