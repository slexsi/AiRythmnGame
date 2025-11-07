// ====== Setup Canvas ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ====== Background & Character placeholders ======
const bg = new Image();
bg.src = "assets/background.png"; // put your background image here

const character = new Image();
character.src = "assets/character.png"; // put your character sprite here
const charX = canvas.width / 2 - 50;
const charY = canvas.height - 150;

// ====== Audio Setup ======
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioElement = new Audio("songs/example.mp3"); // your song
audioElement.crossOrigin = "anonymous";

let sourceNode = audioContext.createMediaElementSource(audioElement);
sourceNode.connect(audioContext.destination);

// ====== Beat Detection (AI Chart Generation) ======
let beatMap = []; // stores timestamps of detected beats
let notes = [];   // stores notes to display on canvas

const analyzer = Meyda.createMeydaAnalyzer({
  audioContext: audioContext,
  source: sourceNode,
  bufferSize: 512,
  featureExtractors: ["spectralFlux"],
  callback: (features) => {
    // simple beat detection threshold
    if (features.spectralFlux > 0.05) {
      const currentTime = audioContext.currentTime;
      beatMap.push(currentTime);

      // create a falling note at a random x position
      notes.push({ x: Math.random() * (canvas.width - 30), y: 0 });
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
    notes[i].y += 4; // speed of falling
    ctx.fillStyle = "red";
    ctx.fillRect(notes[i].x, notes[i].y, 30, 30);

    // remove notes if they go off screen
    if (notes[i].y > canvas.height) {
      notes.splice(i, 1);
      i--;
    }
  }

  // draw simple score (optional)
  ctx.fillStyle = "white";
  ctx.font = "24px sans-serif";
  ctx.fillText("Beats detected: " + beatMap.length, 20, 30);

  requestAnimationFrame(gameLoop);
}

// ====== Start Everything ======
analyzer.start();
audioElement.play();
gameLoop();
