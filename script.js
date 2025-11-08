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
const historyLength = 1024 * 30; // ~30 buffers for BPM estimation

// --- File upload listener ---
songUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  audioElement.src = url;

  // reset game state
  if (analyzer) analyzer.stop();
  if (audioContext) audioContext.close();

  notes = [];
  score = 0;
  bpm = 120;
  rmsHistory = [];
  scoreEl.textContent = "Score: 0";
  playBtn.disabled = false;
  playBtn.textContent = "▶️ Play Song";
});

// --- Play button logic ---
playBtn.addEventListener("click", async () => {
  playBtn.disabled = true;
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

        // simple BPM estimation every historyLength frames
        if (rmsHistory.length === historyLength) {
          const threshold = 0.08;
          const peaks = rmsHistory.filter(v => v > threshold).length;
          const seconds = (historyLength * 1024) / audioContext.sampleRate;
          bpm = Math.round((peaks / seconds) * 60);
        }

        // spawn notes
        const now = audioContext.currentTime;
        const beatInterval = 60 / bpm;

        if (features.rms > 0.05 && now - lastBeat > beatInterval * 0.9) {
          lastBeat = now;
          const laneIndex = Math.floor(Math.random() * lanes.length);

          // randomly create hold notes (20% chance)
          const type = Math.random() < 0.2 ? "hold" : "normal";
          const length = type === "hold" ? 80 : 30;

          notes.push({ lane: laneIndex, y: 0, type, length, holding: false });
          console.log("Beat! Lane:", lanes[laneIndex], "Type:", type, "RMS:", features.rms.toFixed(3));
        }
      },
    });

    analyzer.start();
    await audioElement.play();
    playBtn.textContent = "Playing...";
    playBtn.style.opacity = "0.5";

    gameLoop();
  } catch (err) {
    console.error("Error:", err);
    playBtn.disabled = false;
    playBtn.textContent = "▶️ Try Again";
  }
});

// --- Key input ---
const keys = {};
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  handleHit(key);
});
window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = false;

  // handle releasing hold notes
  notes.forEach((n) => {
    if (n.lane === lanes.indexOf(key) && n.type === "hold" && n.holding) {
      n.holding = false;
      score += Math.round(n.length / 5); // reward for hold
      scoreEl.textContent = "Score: " + score;
    }
  });
});

// --- Hit detection ---
function handleHit(key) {
  const laneIndex = lanes.indexOf(key);
  if (laneIndex === -1) return;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (note.lane === laneIndex) {
      if (note.type === "normal" && Math.abs(note.y - hitY) < hitWindow) {
        notes.splice(i, 1);
        score += 100;
        scoreEl.textContent = "Score: " + score;
        break;
      } else if (note.type === "hold" && Math.abs(note.y - hitY) < hitWindow) {
        note.holding = true; // start tracking hold
        break;
      }
    }
  }
}

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
    n.y += 5; // note speed
    ctx.fillStyle = n.type === "hold" ? "orange" : "red";
    ctx.fillRect(n.lane * laneWidth + 5, n.y, laneWidth - 10, n.length);
  });

  // remove notes off screen
  notes = notes.filter(n => n.y < canvas.height);

  requestAnimationFrame(gameLoop);
}
