const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const songInput = document.getElementById("songInput");

let audioContext;
let audioElement;
let sourceNode;
let analyzer;

let notes = []; // store generated notes

songInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  if (audioElement) audioElement.pause();

  audioElement = new Audio(url);
  audioElement.crossOrigin = "anonymous";

  if (!audioContext) audioContext = new AudioContext();
  sourceNode = audioContext.createMediaElementSource(audioElement);

  analyzer = Meyda.createMeydaAnalyzer({
    audioContext: audioContext,
    source: sourceNode,
    bufferSize: 512,
    featureExtractors: ["rms", "spectralFlux"],
    callback: (features) => {
      if (features.spectralFlux > 0.05) {
        // Detected beat → create a note
        notes.push({x: Math.random() * (canvas.width - 50), y: 0});
      }
    }
  });

  sourceNode.connect(audioContext.destination);
  analyzer.start();
  audioElement.play();

  requestAnimationFrame(gameLoop);
});

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw notes
  for (let i = 0; i < notes.length; i++) {
    notes[i].y += 4; // falling speed
    ctx.fillStyle = "red";
    ctx.fillRect(notes[i].x, notes[i].y, 30, 30);
  }

  requestAnimationFrame(gameLoop);
}
