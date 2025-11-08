const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let notes = [];
let beatMap = [];
let audioContext, sourceNode, analyzer;

const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas);

// make sure the file is literally named song.mp3 and in the same folder
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

playBtn.addEventListener("click", async () => {
  playBtn.disabled = true;
  playBtn.textContent = "Loading...";

  try {
    // 1️⃣ create + resume audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    // 2️⃣ connect source
    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    // 3️⃣ start analyzer immediately
    analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize: 1024,
      featureExtractors: ["spectralFlux"],
      callback: (features) => {
        if (
          features &&
          typeof features.spectralFlux === "number" &&
          !isNaN(features.spectralFlux) &&
          features.spectralFlux > 0.02
        ) {
          beatMap.push(audioContext.currentTime);
          notes.push({ x: Math.random() * (canvas.width - 30), y: 0 });
          console.log("Beat detected:", features.spectralFlux.toFixed(3));
        }
      },
    });

    analyzer.start();

    // 4️⃣ wait just a tick then play (this ensures it’s connected)
    setTimeout(() => {
      console.log("Playing audio...");
      audioElement.play().catch(err => console.error("Audio play blocked:", err));
      playBtn.textContent = "Playing...";
    }, 500);

    gameLoop();
  } catch (err) {
    console.error("Error setting up audio:", err);
    playBtn.disabled = false;
    playBtn.textContent = "▶️ Try Again";
  }
});

function gameLoop()
