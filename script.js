const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let notes = [];
let beatMap = [];
let audioContext, sourceNode, analyzer;

const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas);

// Make sure your file is literally named song.mp3 and in the same folder
const audioElement = new Audio("song.mp3");
audioElement.crossOrigin = "anonymous";

playBtn.addEventListener("click", async () => {
  playBtn.disabled = true;
  playBtn.textContent = "Loading...";

  // Create audio context and unlock it
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();

  // Wait until the song is fully ready
  audioElement.addEventListener("canplaythrough", () => {
    console.log("Audio is ready. Starting analyzer...");

    try {
      sourceNode = audioContext.createMediaElementSource(audioElement);
      sourceNode.connect(audioContext.destination);

      analyzer = Meyda.createMeydaAnalyzer({
        audioContext,
        source: sourceNode,
        bufferSize: 1024,
        featureExtractors: ["spectralFlux"],
        callback: (features) => {
          try {
            if (features && features.spectralFlux && features.spectralFlux > 0.02) {
              beatMap.push(audioContext.currentTime);
              notes.push({ x: Math.random() * (canvas.width - 30), y: 0 });
            }
          } catch (err) {
            console.warn("Skipped a frame:", err);
          }
        },
      });

      analyzer.start();
      audioElement.play();
      gameLoop();
      playBtn.textContent = "Playing...";

    } catch (err) {
      console.error("Error setting up analyzer:", err);
    }
  });

  /
