<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Rhythm Demo</title>
  <style>
    body {
      text-align: center;
      background: #111;
      color: white;
      font-family: sans-serif;
    }
    canvas {
      background: #222;
      border-radius: 12px;
      margin-top: 20px;
    }
    button, input {
      margin-top: 20px;
      padding: 10px 20px;
      font-size: 18px;
      border: none;
      border-radius: 8px;
      background: #0f8;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <h1>AI Rhythm Demo 🎵</h1>
  <canvas id="gameCanvas" width="600" height="400"></canvas>
  <div id="score">Score: 0</div>
  <input type="file" id="songUpload" accept="audio/*">

  <!-- Meyda library -->
  <script src="https://unpkg.com/meyda/dist/web/meyda.min.js"></script>
  <script>
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const songUpload = document.getElementById("songUpload");

    const lanes = ["a", "s", "k", "l"];
    const laneWidth = canvas.width / lanes.length;
    const hitY = canvas.height - 60;
    const hitWindow = 40;
    let notes = [];
    let score = 0;

    const playBtn = document.createElement("button");
    playBtn.textContent = "▶️ Play Song";
    document.body.insertBefore(playBtn, canvas.nextSibling);

    const audioElement = new Audio("song.mp3");
    audioElement.crossOrigin = "anonymous";

    let audioContext, sourceNode, analyzer;
    let bpm = 120;
    let rmsHistory = [];
    const historyLength = 1024 * 30;

    const keys = {};

    // --- File upload listener ---
    songUpload.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      audioElement.src = URL.createObjectURL(file);

      if (analyzer) analyzer.stop();
      if (audioContext) audioContext.close();

      notes = [];
      score = 0;
      bpm = 120;
      rmsHistory = [];
      scoreEl.textContent = "Score: 0";
      playBtn.disabled = false;
      playBtn.textContent = "▶️ Play Song";
    });

    // --- Play button logic ---
    playBtn.addEventListener("click", async () => {
      playBtn.disabled = true;
      playBtn.textContent = "Loading...";

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();

        sourceNode = audioContext.createMediaElementSource(audioElement);
        sourceNode.connect(audioContext.destination);

        let lastBeat = 0;

        analyzer = Meyda.createMeydaAnalyzer({
          audioContext,
          source: sourceNode,
          bufferSize: 1024,
          featureExtractors: ["rms"],
          callback: (features) => {
            if (!features) return;

            rmsHistory.push(features.rms);
            if (rmsHistory.length > historyLength) rmsHistory.shift();

            if (rmsHistory.length === historyLength) {
              const threshold = 0.08;
              const peaks = rmsHistory.filter(v => v > threshold).length;
              const seconds = (historyLength * 1024) / audioContext.sampleRate;
              bpm = Math.round((peaks / seconds) * 60);
            }

            const now = audioContext.currentTime;
            const beatInterval = 60 / bpm;

            if (features.rms > 0.05 && now - lastBeat > beatInterval * 0.9) {
              lastBeat = now;
              const laneIndex = Math.floor(Math.random() * lanes.length);
              const type = Math.random() < 0.2 ? "hold" : "normal";
              const length = type === "hold" ? 80 : 30;

              notes.push({ lane: laneIndex, y: 0, type, length, holding: false, hit: false });
            }
          },
        });

        analyzer.start();
        await audioElement.play();
        playBtn.textContent = "Playing...";
        playBtn.style.opacity = "0.5";

        gameLoop();
      } catch (err) {
        console.error("Error:", err);
        playBtn.disabled = false;
        playBtn.textContent = "▶️ Try Again";
      }
    });

    // --- Key input ---
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (!keys[key]) keys[key] = true;
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      keys[key] = false;
    });

    // --- Main game loop ---
    function gameLoop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw lanes
      lanes.forEach((key, i) => {
        ctx.fillStyle = keys[key] ? "#0f0" : "#333";
        ctx.fillRect(i * laneWidth, 0, laneWidth - 2, canvas.height);
      });

      // draw hit line
      ctx.fillStyle = "yellow";
      ctx.fillRect(0, hitY, canvas.width, 5);

      // draw notes & scoring
      notes.forEach((n) => {
        n.y += 5;
        ctx.fillStyle = n.type === "hold" ? "orange" : "red";
        ctx.fillRect(n.lane * laneWidth + 5, n.y, laneWidth - 10, n.length);

        const keyPressed = keys[lanes[n.lane]];

        // normal note hit
        if (n.type === "normal" && Math.abs(n.y - hitY) < hitWindow && keyPressed && !n.hit) {
          score += 100;
          scoreEl.textContent = "Score: " + score;
          n.hit = true;
        }

        // hold note
        if (n.type === "hold") {
          // start scoring if key pressed in hit window
          if (keyPressed && !n.hit && Math.abs(n.y - hitY) < hitWindow) {
            n.holding = true;
            n.hit = true; // mark as hit immediately
          }

          // continuous scoring while holding
          if (n.holding) {
            score += 1;
            scoreEl.textContent = "Score: " + score;
          }
        }
      });

      // remove notes
      notes = notes.filter((n) => {
        // Normal notes: remove if hit or off screen
        if (n.type === "normal" && (n.hit || n.y > canvas.height)) return false;

        // Hold notes: remove if hit and passed the hit line
        if (n.type === "hold" && n.hit && n.y > hitY + n.length) return false;

        return true;
      });

      requestAnimationFrame(gameLoop);
    }
  </script>
</body>
</html>
