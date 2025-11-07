// ====== Setup Canvas ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ====== Background & Character placeholders ======
const bg = new Image();
bg.src = "assets/background.png"; // your background image

const character = new Image();
character.src = "assets/character.png"; // your character sprite
const charX = canvas.width / 2 - 50;
const charY = canvas.height - 150;

// ====== Audio Setup ======
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioElement = new Audio("songs/example.mp3"); // your song
audioElement.crossOrigin = "anonymous";

let sourceNode = audioContext.createMediaElementSource(audioElement);
sourceNode.connect(audioContext.destination);

// ====== Beat Detection (AI Chart Generation) ======
let beatMap = [];
let notes = [];

const analyzer = Meyda.createMeydaAnalyzer({
  audioContext: audioContext,
  source: sourceNode,
  bufferSize: 512,
  featureExtractors: ["spectralFlux"],
  callback: (features) => {
    try {
      if (features && features.spectralFlux > 0.05) {
        const currentTime = audioContext.currentTime;
        beatMap.push(currentTime);
        notes.push({ x: Math.random() * (canvas.width - 30), y: 0 });
      }
    } catch (e) {
      console.warn("Meyda skipped a frame:", e);
    }
  }
});

// ====== Game Loop ======
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw background
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  // draw character
  ctx.drawImage(character, charX, charY, 100, 100);

  // draw falling notes
  for (let i = 0; i < notes.length; i++) {
    notes[i].y += 4; // falling speed
    ctx.fillStyle = "red";
    ctx.fillRect(notes[i].x, notes[i].y, 30, 30);

    if (notes[i].y > canvas.height) {
      notes.splice(i, 1);
      i--;
    }
  }

  // draw beats detected
  ctx.fillStyle = "white";
  ctx.font = "24px sans-serif";
  ctx.fillText("Beats detected: " + beatMap.length, 20, 30);

  requestAnimationFrame(gameLoop);
}

// ====== Play Button ======
const playBtn = document.createElement("button");
playBtn.innerText = "Play Song";
document.body.insertBefore(playBtn, canvas);

playBtn.addEventListener("click", async () => {
  // unlock audio context in browsers
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  // start analyzer & play audio
  analyzer.start();
  audioElement.play();

  // hide play button after starting
  playBtn.style.display = "none";
});

// ====== Start Game Loop ======
gameLoop();
