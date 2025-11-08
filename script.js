const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let notes = [];
let beatMap = [];
let audioContext, sourceNode, analyzer;

// create play button
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas);

// create audio element (make sure you have song.mp3 in your repo)
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

playBtn.addEventListener("click", async () => {
  playBtn.disabled = true;
  playBtn.textContent = "Loading...";

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioContext.createMediaElementSource(audioElement);
  sourceNode.connect(audioContext.destination);

  await audioContext.resume(); // unlock audio on user click

  // wait until the song can play
  audioElement.addEventListener("canplay", () => {
    console.log("Audio ready, starting analyzer...");

    analyzer = Meyda.createMeydaAnalyzer({
      audioContext: audioContext,
      source: sourceNode,
      bufferSize: 512,
      featureExtractors: ["spectralFlux"],
      callback: (features) => {
        try {
          if (features.spectralFlux > 0.02) {
            beatMap.push(audioContext.currentTime);
            notes.push({ x: Math.random() * (canvas.width - 30), y: 0 });
          }
        } catch (e) {
          console.warn("Meyda skipped a frame:", e);
        }
      },
    });

    analyzer.start();
    audioElement.play();
    gameLoop();

    playBtn.textContent = "Playing...";
  });

  audioElement.load();
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
