<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Rhythm Game (A S K L)</title>
  <style>
    body {
      margin: 0;
      background: #111;
      color: white;
      font-family: monospace;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    canvas {
      border: 2px solid white;
      margin-top: 10px;
      background: #000;
    }
    button {
      margin-top: 10px;
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h2>🎵 Rhythm Game (A S K L)</h2>
  <div id="score">Score: 0</div>
  <button id="playBtn">▶️ Play Song</button>
  <canvas id="gameCanvas" width="500" height="600"></canvas>

  <script src="https://unpkg.com/meyda/dist/web/meyda.min.js"></script>
  <script>
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const playBtn = document.getElementById("playBtn");
    const scoreEl = document.getElementById("score");

    const lanes = ["a", "s", "k", "l"];
    const laneWidth = canvas.width / lanes.length;
    let notes = [];
    let score = 0;

    let audioContext, sourceNode, analyzer;
    const audioElement = new Audio("song.mp3");
    audioElement.crossOrigin = "anonymous";

    playBtn.addEventListener("click", async () => {
      playBtn.disabled = true;
      playBtn.textContent = "Loading...";

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();

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
                notes.push({
                  lane: laneIndex,
                  y: 0,
                });
              }
            },
          });

          analyzer.start();
          audioElement.play();
          gameLoop();
          playBtn.textContent = "Playing...";
        } catch (err) {
          console.error("Analyzer setup failed:", err);
        }
      });
    });

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

    function handleHit(key) {
      const laneIndex = lanes.indexOf(key);
      const hitY = canvas.height - 100; // hit line position
      const hitWindow = 40; // acceptable range

      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (
          note.lane === laneIndex &&
          Math.abs(note.y - hitY) < hitWindow
        ) {
          notes.splice(i, 1); // remove note
          score += 100;
          scoreEl.textContent = "Score: " + score;
          return;
        }
      }
    }

    function gameLoop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw lanes
      for (let i = 0; i < lanes.length; i++) {
        ctx.fillStyle = keys[lanes[i]] ? "#0f0" : "#333";
        ctx.fillRect(i * laneWidth, 0, laneWidth - 5, canvas.height);
      }

      // draw hit line
      ctx.fillStyle = "yellow";
      ctx.fillRect(0, canvas.height - 100, canvas.width, 5);

      // draw notes
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

      // remove notes that fall off screen
      notes = notes.filter((n) => n.y < canvas.height);

      requestAnimationFrame(gameLoop);
    }
  </script>
</body>
</html>
