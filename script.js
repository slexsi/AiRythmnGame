const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let notes = [];
let beatMap = [];
let audioContext, sourceNode, analyzer;

// create play button
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas);

// create audio element
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

playBtn.addEventListener("click", async () => {
  playBtn.disabled = true;
  playBtn.textContent = "Playing...";

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioContext.createMediaElementSource(audioElement);

  analyzer = Meyda.createMeydaAnalyzer({
    audioContext: audioContext,
    source: sourceNode,
    bufferSize: 512,
    featureExtractors: ["spectralFlux"],
    callback: (features) => {
      try {
        if (features.spectralFlux > 0.05) {
          beatMap.push(audioContext.currentTime);
          notes.push({ x: Math.random() * (canvas.width - 30), y: 0 });
        }
      } catch (e) {
        console.warn("Meyda skipped a frame:", e);
      }
    }
  });

  sourceNode.connect(audioContext.destination);

  await audioContext.resume();
  analyzer.start();
  audioElement.play();
  gameLoop();
});

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillText("Detected Beats: " + beatMap.length, 10, 20);

  ctx.fillStyle = "red";
  notes.forEach((note) => {
    note.y += 3;
    ctx.fillRect(note.x, note.y, 20, 20);
  });

  notes = notes.filter((note) => note.y < canvas.height);
  requestAnimationFrame(gameLoop);
}
