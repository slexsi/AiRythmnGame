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

// Buttons
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);
const songUpload = document.getElementById("songUpload");

// Optional loading status
const loadingStatus = document.createElement("div");
loadingStatus.style.color = "#0f8";
loadingStatus.style.marginTop = "10px";
document.body.insertBefore(loadingStatus, playBtn.nextSibling);

// Audio
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

let audioContext, sourceNode, analyzer;
let rmsHistory = [];
const historyLength = 1024 * 30;

// --- Magenta RNN Setup ---
let rnnLoaded = false;
let rnnModel;
let rnnSequence = []; // store generated notes

async function loadRNN() {
  loadingStatus.textContent = "Loading RNN model...";
  rnnModel = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn');
  try {
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

        // --- store RMS ---
        rmsHistory.push(rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();

        // --- Magenta RNN decision ---
        let noteSpawned = false;
        if (now - lastNoteTime > 0.2) {
          lastNoteTime = now;

          // use last generated note or default seed
          const seed = rnnSequence.length > 0 
            ? [rnnSequence[rnnSequence.length - 1]] 
            : [{quantizedStartStep:0,pitch:36,duration:1}];

          try {
            const rnnOut = await rnnModel.continueSequence(seed, 1, 1.0);
            const newNote = rnnOut.notes[0];
            if (newNote) {
              const laneIndex = Math.floor(Math.random() * lanes.length); // map pitch to lane if desired
              notes.push({ lane: laneIndex, y: 0, hit: false });
              rnnSequence.push(newNote);
              noteSpawned = true;
            }
          } catch(err) {
            console.error("RNN generation failed:", err);
          }
        }

        // --- AI visualization ---
        aiHistory.push(rms); // can still visualize RMS
        if (aiHistory.length > aiCanvas.width) aiHistory.shift();
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

// --- AI Visualization ---
function drawAIVisualization(noteSpawned) {
  aiCtx.clearRect(0, 0, aiCanvas.width, aiCanvas.height);
  aiHistory.forEach((val, i) => {
    const h = val * aiCanvas.height;
    aiCtx.fillStyle = "#08f";
    aiCtx.fillRect(i, aiCanvas.height - h, 1, h);

    // mark when note spawned
    if (noteSpawned) {
      aiCtx.fillStyle = "#0f8";
      aiCtx.fillRect(i, 0, 1, aiCanvas.height);
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
