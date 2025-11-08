const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// button setup
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);

// file input for uploading a song
const songUpload = document.getElementById("songUpload");

// audio element
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

let audioContext, sourceNode, analyzer;
let bpm = 120; // default BPM
let rmsHistory = [];
const historyLength = 1024 * 30;

// --- File upload listener ---
songUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  audioElement.src = url;

  resetGame();
});

// --- Play button logic ---
playBtn.addEventListener("click", async () => {
  resetGame();
  playBtn.textContent = "Loading...";

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    let lastBeat = 0;

    analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize: 1024,
      featureExtractors: ["rms"],
      callback: (features) => {
        if (!features) return;

        // store RMS for BPM estimation
        rmsHistory.push(features.rms);
        if (rmsHistory.length > historyLength) rmsHistory.shift();

        // simple BPM estimation
        if (rmsHistory.length === historyLength) {
          const threshold = 0.08;
          const peaks = rmsHistory.filter(v => v > threshold).length;
          const seconds = (historyLength * 1024) / audioContext.sampleRate;
          bpm = Math.round((peaks / seconds) * 60);
        }

        const now = audioContext.currentTime;
        const beatInterval = 60 / bpm;

        if (features.rms > 0.05 && now - lastBeat > beatInterval * 0.9) {
          lastBeat = now;
          const laneIndex = Math.floor(Math.random() * lanes.length);
          const type = Math.random() < 0.2 ? "hold" : "normal";
          const length = type === "hold" ? 80 : 30;

          notes.push({ lane: laneIndex, y: 0, type, length, holding: false, hit: false });
        }
      },
    });

    analyzer.start();
    await audioElement.play();
    playBtn.textContent = "Playing...";
    gameLoop();
  } catch (err) {
    console.error("Error:", err);
    playBtn.textContent = "▶️ Try Again";
  }
});

// --- Key input ---
const keys = {};
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = false;
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

  // draw notes & scoring
  notes.forEach((n) => {
    n.y += 5;
    ctx.fillStyle = n.type === "hold" ? "orange" : "red";
    ctx.fillRect(n.lane * laneWidth + 5, n.y, laneWidth - 10, n.length);

    const keyPressed = keys[lanes[n.lane]];

    // normal note hit
    if (n.type === "normal" && Math.abs(n.y - hitY) < hitWindow && keyPressed && !n.hit) {
      score += 100;
      scoreEl.textContent = "Score: " + score;
      n.hit = true;
    }

    // hold note
    if (n.type === "hold") {
      if (keyPressed && !n.hit && Math.abs(n.y - hitY) < hitWindow) {
        n.holding = true;
        n.hit = true;
      }
      if (n.holding) {
        score += 1;
        scoreEl.textContent = "Score: " + score;
      }
    }
  });

  // remove notes that are done
  notes = notes.filter((n) => {
    if (n.type === "normal" && (n.hit || n.y > canvas.height)) return false;
    if (n.type === "hold" && n.hit && n.y > hitY + n.length) return false;
    return true;
  });

  requestAnimationFrame(gameLoop);
}

// --- Reset game function ---
function resetGame() {
  if (analyzer) analyzer.stop();
  if (audioContext) audioContext.close();

  notes = [];
  score = 0;
  bpm = 120;
  rmsHistory = [];
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime = 0;
}
