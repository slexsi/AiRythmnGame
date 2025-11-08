const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// === AI visualization canvas ===
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

// === Magenta model integration ===
let rnn;
async function loadMagentaModel() {
  try {
    const modelUrl = window.location.origin + "/drum_kit_rnn.mag";
    rnn = new mm.MusicRNN(modelUrl);
    await rnn.initialize();
    console.log("✅ Magenta model loaded successfully!");
  } catch (err) {
    console.error("❌ Failed to load Magenta model:", err);
  }
}

// === AI beat generator ===
let aiBeatTimer = 0;
let lastBeatProb = 0;

async function generateBeatPattern(rmsHistory) {
  if (!rnn || rmsHistory.length < 8) return 0;

  const seedSeq = {
    notes: rmsHistory.slice(-8).map((r, i) => ({
      pitch: 60 + Math.floor(r * 20),
      startTime: i * 0.25,
      endTime: i * 0.25 + 0.2,
    })),
    totalTime: 2.0,
  };

  try {
    const continuation = await rnn.continueSequence(seedSeq, 8, 1.0);
    return continuation.notes.length / 8;
  } catch (e) {
    console.error("RNN generation error:", e);
    return 0;
  }
}

// === Load model on start ===
loadMagentaModel();

// === File upload ===
songUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioElement.src = URL.createObjectURL(file);
  resetGame();
});

// === Play button ===
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
      callback: (features) => {
        if (!features) return;
        const rms = features.rms;
        const now = audioContext.currentTime;

        rmsHistory.push(rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();

        // Only ask AI every 0.3s to reduce lag
        if (now - aiBeatTimer > 0.3) {
          aiBeatTimer = now;
          generateBeatPattern(rmsHistory).then(prob => (lastBeatProb = prob));
        }

        // Mix AI beat and RMS amplitude
        const spawnChance = lastBeatProb * 0.7 + rms * 0.3;
        let noteSpawned = false;

        if (Math.random() < spawnChance * 0.4 && now - lastNoteTime > 0.25) {
          lastNoteTime = now;
          const laneIndex = Math.floor(Math.random() * lanes.length);
          notes.push({ lane: laneIndex, y: 0, hit: false });
          noteSpawned = true;
        }

        aiHistory.push(spawnChance);
        if (aiHistory.length > aiCanvas.width) aiHistory.shift();
        drawAIVisualization(noteSpawned);
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

// === Key input ===
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// === Main game loop ===
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
    drawArrow(n.lane * laneWidth + laneWidth / 2, n.y, 20, "red");

    const keyPressed = keys[lanes[n.lane]];
    if (Math.abs(n.y - hitY) < hitWindow && keyPressed && !n.hit) {
      score += 100;
      scoreEl.textContent = "Score: " + score;
      n.hit = true;
    }
  });

  notes = notes.filter((n) => !n.hit && n.y < canvas.height + 50);

  requestAnimationFrame(gameLoop);
}

// === Draw fancy arrow ===
function drawArrow(x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.6, y);
  ctx.lineTo(x + size * 0.3, y);
  ctx.lineTo(x + size * 0.3, y + size);
  ctx.lineTo(x - size * 0.3, y + size);
  ctx.lineTo(x - size * 0.3, y);
  ctx.lineTo(x - size * 0.6, y);
  ctx.closePath();
  ctx.fill();
}

// === AI Visualization ===
function drawAIVisualization(noteSpawned) {
  aiCtx.clearRect(0, 0, aiCanvas.width, aiCanvas.height);
  aiHistory.forEach((val, i) => {
    const h = val * aiCanvas.height;
    aiCtx.fillStyle = "#08f";
    aiCtx.fillRect(i, aiCanvas.height - h, 1, h);

    if (val > 0.5 && noteSpawned) {
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
}
