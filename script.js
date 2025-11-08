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

    // Meyda analyzer: RMS-based beat detection
    analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize: 1024,
      featureExtractors: ["rms"],
      callback: (features) => {
        if (features && features.rms > 0.05) {
          const now = audioContext.currentTime;
          if (now - lastBeat > 0.25) { // min spacing between notes
            lastBeat = now;
            const laneIndex = Math.floor(Math.random() * lanes.length);
            notes.push({ lane: laneIndex, y: 0 });
            console.log("Beat! Lane:", lanes[laneIndex], "RMS:", features.rms.toFixed(3));
          }
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
  keys[e.key.toLowerCase()] = false;
});

// --- Hit detection ---
function handleHit(key) {
  const laneIndex = lanes.indexOf(key);
  if (laneIndex === -1) return;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (note.lane === laneIndex && Math.abs(note.y - hitY) < hitWindow) {
      notes.splice(i, 1);
      score += 100;
      scoreEl.textContent = "Score: " + score;
      break;
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
    ctx.fillStyle = "red";
    ctx.fillRect(n.lane * laneWidth + 5, n.y, laneWidth - 10, 30);
  });

  // remove notes off screen
  notes = notes.filter(n => n.y < canvas.height);

  requestAnimationFrame(gameLoop);
}
