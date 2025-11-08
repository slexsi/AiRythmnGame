const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const playBtn = document.getElementById("playBtn");

const lanes = ["a", "s", "k", "l"];
const laneWidth = canvas.width / lanes.length;
let notes = [];
let score = 0;

let audioContext, sourceNode, analyzer;
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

// === Play button logic ===
playBtn.addEventListener("click", async () => {
  console.log("Play button clicked...");
  playBtn.disabled = true;
  playBtn.textContent = "Loading...";

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();

  audioElement.load(); // force audio load

  audioElement.addEventListener("canplaythrough", () => {
    console.log("Audio ready, starting analyzer...");
    try {
      sourceNode = audioContext.createMediaElementSource(audioElement);
      sourceNode.connect(audioContext.destination);

      analyzer = Meyda.createMeydaAnalyzer({
        audioContext,
        source: sourceNode,
        bufferSize: 1024,
        featureExtractors: ["spectralFlux"],
        callback: (features) => {
          if (features && features.spectralFlux > 0.02) {
            const laneIndex = Math.floor(Math.random() * lanes.length);
            notes.push({ lane: laneIndex, y: 0 });
          }
        },
      });

      analyzer.start();
      audioElement.play();
      gameLoop();
      playBtn.textContent = "Playing...";
      playBtn.style.opacity = "0.5";
    } catch (err) {
      console.error("Analyzer setup failed:", err);
    }
  });

  audioElement.addEventListener("error", (e) => {
    console.error("Audio failed to load:", e);
  });
});

// === Input logic ===
const keys = {};
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (lanes.includes(key)) {
    keys[key] = true;
    handleHit(key);
  }
});
window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (lanes.includes(key)) keys[key] = false;
});

// === Hit detection ===
function handleHit(key) {
  const laneIndex = lanes.indexOf(key);
  const hitY = canvas.height - 100;
  const hitWindow = 40;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (note.lane === laneIndex && Math.abs(note.y - hitY) < hitWindow) {
      notes.splice(i, 1);
      score += 100;
      scoreEl.textContent = "Score: " + score;
      return;
    }
  }
}

// === Main game loop ===
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw lanes
  for (let i = 0; i < lanes.length; i++) {
    ctx.fillStyle = keys[lanes[i]] ? "#0f0" : "#333";
    ctx.fillRect(i * laneWidth, 0, laneWidth - 5, canvas.height);
  }

  // Draw hit line
  ctx.fillStyle = "yellow";
  ctx.fillRect(0, canvas.height - 100, canvas.width, 5);

  // Draw notes
  for (let note of notes) {
    ctx.fillStyle = "red";
    ctx.fillRect(
      note.lane * laneWidth + laneWidth / 4,
      note.y,
      laneWidth / 2,
      20
    );
    note.y += 5;
  }

  // Remove notes off screen
  notes = notes.filter((n) => n.y < canvas.height);

  requestAnimationFrame(gameLoop);
}
