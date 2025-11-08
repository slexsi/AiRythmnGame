const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let notes = [];
let audioContext, sourceNode, analyzer;

// button setup
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);

// make sure song.mp3 is in the same folder
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

playBtn.addEventListener("click", async () => {
  playBtn.disabled = true;
  playBtn.textContent = "Loading...";

  try {
    // audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    // connect source
    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    // Meyda analyzer
    analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize: 1024,
      featureExtractors: ["rms"], // simpler feature, works everywhere
      callback: (features) => {
        if (features && features.rms > 0.05) {
          notes.push({ x: Math.random() * (canvas.width - 30), y: 0 });
          console.log("Beat:", features.rms.toFixed(3));
        }
      },
    });

    analyzer.start();

    // play audio right after click
    await audioElement.play();
    console.log("Audio started.");
    playBtn.textContent = "Playing...";
    gameLoop();
  } catch (err) {
    console.error("Error:", err);
    playBtn.disabled = false;
    playBtn.textContent = "▶️ Try Again";
  }
});

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "red";
  notes.forEach((n) => {
    n.y += 5;
    ctx.fillRect(n.x, n.y, 30, 30);
  });
  requestAnimationFrame(gameLoop);
}
