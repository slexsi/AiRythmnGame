<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Meyda Debug</title>
  <script src="https://unpkg.com/meyda/dist/web/meyda.min.js"></script>
</head>
<body>
  <button id="playBtn">▶️ Play Song</button>
  <script>
    const playBtn = document.getElementById("playBtn");
    const audioElement = new Audio("song.mp3");
    audioElement.crossOrigin = "anonymous";

    let audioContext, sourceNode, analyzer;

    playBtn.addEventListener("click", async () => {
      console.log("Play button clicked...");
      playBtn.disabled = true;

      // create/resume AudioContext
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();

      audioElement.load();

      audioElement.addEventListener("canplaythrough", () => {
        console.log("Audio ready");

        try {
          sourceNode = audioContext.createMediaElementSource(audioElement);
          sourceNode.connect(audioContext.destination);

          // Meyda analyzer
          analyzer = Meyda.createMeydaAnalyzer({
            audioContext,
            source: sourceNode,
            bufferSize: 1024,
            featureExtractors: ["spectralFlux"],
            callback: (features) => {
              console.log("spectralFlux:", features?.spectralFlux);
            }
          });

          analyzer.start();
          audioElement.play();

        } catch (err) {
          console.error("Analyzer setup failed:", err);
        }
      });

      audioElement.addEventListener("error", (e) => {
        console.error("Audio failed to load:", e);
      });
    });
  </script>
</body>
</html>
