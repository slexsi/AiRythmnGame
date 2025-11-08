const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// AI visualization
const aiCanvas = document.createElement("canvas");
aiCanvas.width = 600;
aiCanvas.height = 100;
aiCanvas.style.background = "#111";
aiCanvas.style.marginTop = "20px";
document.body.insertBefore(aiCanvas, canvas);
const aiCtx = aiCanvas.getContext("2d");
let rmsHistoryVisual = [];

const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);

const songUpload = document.getElementById("songUpload");

const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

let audioContext, sourceNode, analyzer;
let bpm = 120;
let rmsHistory = [];
const historyLength = 1024 * 30;

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

        // --- Store RMS for beat detection ---
        rmsHistory.push(rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();

        if (rmsHistory.length === historyLength) {
          const threshold = 0.08;
          const peaks = rmsHistory.filter(v => v > threshold).length;
          const seconds = (historyLength * 1024) / audioContext.sampleRate;
          bpm = Math.round((peaks / seconds) * 60);
        }

        const beatInterval = 60 / bpm;

        // --- Spawn note ---
        let noteSpawned = false;
        if (rms > 0.05 && now - lastNoteTime > beatInterval * 0.9) {
          lastNoteTime = now;
          const laneIndex = Math.floor(Math.random() * lanes.length);
          notes.push({ lane: laneIndex, y: 0, hit: false });
          noteSpawned = true;
        }

        // --- AI visualization: mark when note is spawned ---
        rmsHistoryVisual.push(noteSpawned ? 1 : 0);
        if (rmsHistoryVisual.length > aiCanvas.width) rmsHistoryVisual.shift();
        drawAIVisualization();
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

// --- Draw AI Visualization ---
function drawAIVisualization() {
  aiCtx.clearRect(0, 0, aiCanvas.width, aiCanvas.height);
  rmsHistoryVisual.forEach((val, i) => {
    if (val > 0) {
      aiCtx.fillStyle = "#0f8";
      aiCtx.fillRect(i, 0, 1, aiCanvas.height); // vertical line when AI spawns a note
    }
  });

  // Optional: show threshold line
  const thresholdY = aiCanvas.height - (0.05 * aiCanvas.height * 5);
  aiCtx.strokeStyle = "#f00";
  aiCtx.lineWidth = 1;
  aiCtx.beginPath();
  aiCtx.moveTo(0, thresholdY);
  aiCtx.lineTo(aiCanvas.width, thresholdY);
  aiCtx.stroke();
}

// --- Reset ---
function resetGame() {
  if (analyzer) analyzer.stop();
  if (audioContext) audioContext.close();

  notes = [];
  score = 0;
  bpm = 120;
  rmsHistory = [];
  rmsHistoryVisual = [];
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime = 0;
}
