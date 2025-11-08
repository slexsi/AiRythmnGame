// --- Key input ---
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (!keys[key]) keys[key] = true; // track first press
  handleHit(key);
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  keys[key] = false;

  // release hold notes
  notes.forEach((n) => {
    if (n.lane === lanes.indexOf(key) && n.type === "hold" && n.holding) {
      n.holding = false; // stop holding
      score += Math.round(n.length / 5); // final reward for hold
      scoreEl.textContent = "Score: " + score;
    }
  });
});

// --- Hit detection ---
function handleHit(key) {
  const laneIndex = lanes.indexOf(key);
  if (laneIndex === -1) return;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    if (note.lane === laneIndex) {
      if (note.type === "normal" && Math.abs(note.y - hitY) < hitWindow) {
        // remove normal note
        notes.splice(i, 1);
        score += 100;
        scoreEl.textContent = "Score: " + score;
        break;
      } else if (note.type === "hold" && Math.abs(note.y - hitY) < hitWindow) {
        note.holding = true; // start tracking hold
        note.holdStartY = note.y; // store starting Y for continuous scoring
        break;
      }
    }
  }
}

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

  // draw notes & handle hold scoring
  notes.forEach((n) => {
    n.y += 5; // note speed
    ctx.fillStyle = n.type === "hold" ? "orange" : "red";
    ctx.fillRect(n.lane * laneWidth + 5, n.y, laneWidth - 10, n.length);

    // continuous scoring for hold notes while holding
    if (n.type === "hold" && n.holding) {
      score += 1; // points per frame
      scoreEl.textContent = "Score: " + score;
    }
  });

  // remove notes off screen or completed hold
  notes = notes.filter(n => {
    if (n.type === "normal" && n.y > canvas.height) return false;
    if (n.type === "hold" && !n.holding && n.y > hitY + n.length) return false;
    return true;
  });

  requestAnimationFrame(gameLoop);
}
