const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const nnCanvas = document.getElementById("nnCanvas");
const nnCtx = nnCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const loadingStatus = document.getElementById("loadingStatus");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;
let aiHistory = [];

const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);

const songUpload = document.getElementById("songUpload");

const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

let audioContext, sourceNode, analyzer;
let rmsHistory = [];
const historyLength = 1024 * 30;

// --- Magenta RNN ---
let rnnLoaded = false;
let rnnModel;
let rnnSequence = [];

async function loadRNN() {
  try {
    rnnModel = new mm.MusicRNN(
      'https://raw.githubusercontent.com/slexsi/AiRythmnGame/main/drum_kit_rnn.mag'
    );
    await rnnModel.initialize();
    rnnLoaded = true;
    loadingStatus.textContent = "RNN Model Ready!";
    console.log("RNN model loaded!");
  } catch (err) {
    console.error("Failed to load RNN:", err);
    loadingStatus.textContent = "Failed to load RNN model";
  }
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
  if (!rnnLoaded) {
    alert("RNN model is still loading...");
    return;
  }

  resetGame();
  playBtn.textContent = "Loading Audio...";

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

        // Store RMS
        rmsHistory.push(rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();

        // RNN decision
        let noteSpawned = false;
        if (now - lastNoteTime > 0.2) {
          lastNoteTime = now;

          const seed = rnnSequence.length > 0
            ? [rnnSequence[rnnSequence.length - 1]]
            : [{quantizedStartStep: 0, pitch: 36, duration: 1}];

          try {
            const rnnOut = await rnnModel.continueSequence(seed, 1, 1.0);
            const newNote = rnnOut.notes[0];
            if (newNote) {
              const laneIndex = Math.floor(Math.random() * lanes.length);
              notes.push({ lane: laneIndex, y: 0, hit: false });
              rnnSequence.push(newNote);
              noteSpawned = true;
            }
          } catch(err) {
            console.error("RNN generation failed:", err);
          }
        }

        // AI visualization
        aiHistory.push(rms);
        if (aiHistory.length > nnCanvas.width) aiHistory.shift();
        drawAIVisualization(noteSpawned);
      }
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

// --- Game loop ---
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  lanes.forEach((key, i) => {
    ctx.fillStyle = keys[key] ? "#0f0" : "#333";
    ctx.fillRect(i * laneWidth, 0, laneWidth - 2, canvas.height);
  });

  ctx.fillStyle = "yellow";
  ctx.fillRect(0, hitY, canvas.width, 5);

  notes.forEach(n => {
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

// --- AI Visualization ---
function drawAIVisualization(noteSpawned) {
  nnCtx.clearRect(0, 0, nnCanvas.width, nnCanvas.height);
  aiHistory.forEach((val, i) => {
    const h = val * nnCanvas.height;
    nnCtx.fillStyle = "#08f";
    nnCtx.fillRect(i, nnCanvas.height - h, 1, h);
    if (noteSpawned) {
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
  aiHistory = [];
  rnnSequence = [];
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime = 0;
}
