// --- Setup ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// AI visualization canvas
const aiCanvas = document.createElement("canvas");
aiCanvas.width = 600;
aiCanvas.height = 100;
aiCanvas.style.background = "#111";
aiCanvas.style.marginTop = "20px";
document.body.insertBefore(aiCanvas, canvas);
const aiCtx = aiCanvas.getContext("2d");
let aiHistory = [];

// Buttons and audio
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);
const songUpload = document.getElementById("songUpload");
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

let audioContext, sourceNode, analyzer;
let rmsHistory = [];
const historyLength = 1024 * 30;

// --- Player key input ---
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// --- TensorFlow.js AI model ---
const aiModel = tf.sequential();
aiModel.add(tf.layers.dense({ inputShape: [16], units: 32, activation: "relu" }));
aiModel.add(tf.layers.dense({ units: 32, activation: "relu" }));
aiModel.add(tf.layers.dense({ units: 4, activation: "sigmoid" }));
aiModel.compile({ optimizer: "adam", loss: "meanSquaredError" });

// --- AI helper functions ---
function getAIInput() {
  const input = new Array(16).fill(0); // 4 lanes × 4 upcoming notes
  notes.forEach(note => {
    if (note.y > hitY - 200 && note.y < hitY + 50) {
      const laneIndex = note.lane;
      const posIndex = Math.floor((note.y - (hitY - 200)) / 50);
      if (posIndex < 4) input[laneIndex * 4 + posIndex] = 1;
    }
  });
  return tf.tensor2d([input]);
}

async function aiStep() {
  if (notes.length === 0) return;
  const state = getAIInput();
  const pred = aiModel.predict(state).dataSync();
  const action = pred.map(v => v > 0.5 ? 1 : 0);

  // Press keys
  action.forEach((press, i) => {
    if (press) pressKey(lanes[i]);
  });

  // Reward = 1 for hitting a note, 0 for miss
  let reward = 0;
  notes.forEach(note => {
    if (!note.hit && Math.abs(note.y - hitY) < hitWindow) {
      const laneIndex = note.lane;
      if (action[laneIndex]) reward = 1;
    }
  });

  // Train online
  const target = tf.tensor2d([pred.map((p) => p + 0.1 * (reward - p))]);
  await aiModel.fit(state, target, { epochs: 1, verbose: 0 });

  state.dispose();
  target.dispose();

  // AI visualization
  const beatProb = Math.max(...pred);
  aiHistory.push(beatProb);
  if (aiHistory.length > aiCanvas.width) aiHistory.shift();
  drawAIVisualization();
}

// --- Press key helper ---
function pressKey(key) {
  notes.forEach(note => {
    if (note.lane === lanes.indexOf(key) && !note.hit && Math.abs(note.y - hitY) < hitWindow) {
      note.hit = true;
      score += 100;
      scoreEl.textContent = "Score: " + score;
    }
  });
}

// --- Draw AI visualization ---
function drawAIVisualization() {
  aiCtx.clearRect(0, 0, aiCanvas.width, aiCanvas.height);
  aiHistory.forEach((val, i) => {
    const h = val * aiCanvas.height;
    aiCtx.fillStyle = "#08f";
    aiCtx.fillRect(i, aiCanvas.height - h, 1, h);
  });
}

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
      callback: (features) => {
        if (!features) return;
        const rms = features.rms;
        const now = audioContext.currentTime;

        rmsHistory.push(rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();

        const inputWindow = rmsHistory.slice(-20);
        const beatProb = Math.min(inputWindow.reduce((a, b) => a + b, 0) / inputWindow.length * 20, 1);

        if (beatProb > 0.5 && now - lastNoteTime > 0.2) {
          lastNoteTime = now;
          const laneIndex = Math.floor(Math.random() * lanes.length);
          notes.push({ lane: laneIndex, y: 0, hit: false });
        }
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
  notes.forEach(n => {
    n.y += 5;
    ctx.fillStyle = n.hit ? "#555" : "red";
    ctx.fillRect(n.lane * laneWidth + 5, n.y, laneWidth - 10, 30);
  });

  notes = notes.filter(n => !n.hit && n.y < canvas.height);

  // AI step
  aiStep();

  requestAnimationFrame(gameLoop);
}

// --- Reset ---
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
