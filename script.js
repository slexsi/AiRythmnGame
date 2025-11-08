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
    // Automatically load from same folder (works on GitHub Pages)
    const modelUrl = window.location.origin + "/drum_kit_rnn.mag";
    rnn = new mm.MusicRNN(modelUrl);
    await rnn.initialize();
    console.log("✅ Magenta model loaded successfully!");
  } catch (err) {
    console.error("❌ Failed to load Magenta model:", err);
  }
}

// Convert RMS to a mini note seed and run the RNN
async function generateBeatPattern(rmsHistory) {
  if (!rnn) return 0;
  if (rmsHistory.length < 8) return 0;

  const seedSeq = {
    notes: rmsHistory.slice(-8).map((r, i) => ({
      pitch: 60 + Math.floor(r * 20), // RMS → pseudo pitch
      startTime: i * 0.25,
      endTime: i * 0.25 + 0.2,
    })),
    totalTime: 2.0,
  };

  try {
    const continuation = await rnn.continueSequence(seedSeq, 8, 1.0);
    return continuation.notes.length > 4 ? 1 : 0; // beat prob style
  } catch (e) {
    console.error("RNN generation error:", e);
    return 0;
  }
}

// Load model on start
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

        // --- Use Magenta model output asynchronously ---
        generateBeatPattern(rmsHistory).then((beatProb) => {
          let noteSpawned = false;
          if (beatProb > 0.5 && now - lastNoteTime > 0.2) {
            lastNoteTime = now;
            const laneIndex = Math.floor(Math.random() * lanes.length);
            notes.push({ lane: laneIndex, y: 0, hit: false });
            noteSpawned = true;
          }

          aiHistory.push(beatProb);
          if (aiHistory.length > aiCanvas.width) aiHistory.shift();
          drawAIVisualization(noteSpawned);
        });
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
