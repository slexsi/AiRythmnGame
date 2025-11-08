const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// --- AI Visualization ---
const aiCanvas = document.createElement("canvas");
aiCanvas.width = 600;
aiCanvas.height = 100;
aiCanvas.style.background = "#111";
aiCanvas.style.marginTop = "20px";
document.body.insertBefore(aiCanvas, canvas);
const aiCtx = aiCanvas.getContext("2d");
let aiHistory = [];

// --- Buttons ---
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);
const songUpload = document.getElementById("songUpload");

// --- Audio ---
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";
let audioContext, sourceNode, analyzer;

// --- Magenta Drum RNN Model ---
const drumModel = new mm.MusicRNN(
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn"
);
let aiSequence = [];
let aiReady = false;

// --- Load AI Model ---
async function loadAI() {
  playBtn.textContent = "Loading AI...";
  await drumModel.initialize();

  // Seed: 1 bar of simple kick-snare
  const seed = {
    notes: [
      { pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1 },
      { pitch: 38, quantizedStartStep: 2, quantizedEndStep: 3 },
    ],
    quantizationInfo: { stepsPerQuarter: 4 },
    totalQuantizedSteps: 4,
  };

  // Generate 32 steps (4 bars)
  const steps = 32;
  const temperature = 1.2;
  const result = await drumModel.continueSequence(seed, steps, temperature);

  // Convert to time (approx 0.3s per step)
  aiSequence = result.notes.map((n) => ({
    time: n.quantizedStartStep * 0.3,
    pitch: n.pitch,
  }));
  aiReady = true;
  playBtn.textContent = "▶️ Play Song";
  console.log("✅ AI Generated Sequence:", aiSequence);
}

// --- Generate sequence immediately on load ---
loadAI();

// --- File upload ---
songUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioElement.src = URL.createObjectURL(file);
  resetGame();
});

// --- Play button ---
playBtn.addEventListener("click", async () => {
  if (!aiReady) {
    alert("AI model is still loading! Wait a few seconds.");
    return;
  }

  resetGame();
  playBtn.textContent = "Playing...";

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    const startTime = audioContext.currentTime;

    await audioElement.play();
    gameLoop();

    // Spawn notes based on AI timing
    aiSequence.forEach((n) => {
      const laneIndex = n.pitch % lanes.length;
      const spawnTime = startTime + n.time;
      setTimeout(() => {
        notes.push({ lane: laneIndex, y: 0, hit: false });
        aiHistory.push(1); // visual spike
        if (aiHistory.length > aiCanvas.width) aiHistory.shift();
        drawAIVisualization(true);
      }, n.time * 1000);
    });
  } catch (err) {
    console.error(err);
    playBtn.textContent = "▶️ Try Again";
  }
});

// --- Key input ---
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// --- Main game loop ---
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw lanes
  lanes.forEach((key, i) => {
    ctx.fillStyle = keys[key] ? "#0f0" : "#333";
    ctx.fillRect(i * laneWidth, 0, laneWidth - 2, canvas.height);
  });

  // hit line
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

  notes = notes.filter((n) => !n.hit && n.y < canvas.height);
  requestAnimationFrame(gameLoop);
}

// --- AI Visualization ---
function drawAIVisualization(noteSpawned) {
  aiCtx.clearRect(0, 0, aiCanvas.width, aiCanvas.height);
  aiHistory.forEach((val, i) => {
    const h = val * aiCanvas.height;
    aiCtx.fillStyle = noteSpawned ? "#0f8" : "#08f";
    aiCtx.fillRect(i, aiCanvas.height - h, 1, h);
  });
}

// --- Reset ---
function resetGame() {
  if (audioContext) audioContext.close();
  notes = [];
  score = 0;
  aiHistory = [];
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime = 0;
}
