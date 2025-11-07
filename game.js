let notes = [];
let hitLineY = 500;
let speed = 4;
let song;
let score = 0;
let total = 0;
let accuracyHistory = [];

function setup() {
  createCanvas(800, 600);
  song = document.getElementById("song");
  song.volume = 0.5;
  spawnNotes();
}

function draw() {
  background(0);
  drawHitLine();
  drawNotes();
  drawScore();
}

function spawnNotes() {
  for (let i = 0; i < 50; i++) {
    let t = i * 60;
    notes.push({
      x: 200 + (i % 4) * 100,
      y: -t,
      pressed: false,
      dir: ["left", "down", "up", "right"][i % 4],
    });
  }
}

function drawNotes() {
  for (let note of notes) {
    note.y += speed;
    fill(255);
    ellipse(note.x, note.y, 40, 40);

    if (note.y > hitLineY - 20 && note.y < hitLineY + 20 && !note.pressed) {
      if (keyIsDown(37) && note.dir === "left") hit(note);
      if (keyIsDown(38) && note.dir === "up") hit(note);
      if (keyIsDown(39) && note.dir === "right") hit(note);
      if (keyIsDown(40) && note.dir === "down") hit(note);
    }
  }
}

function drawHitLine() {
  stroke(0, 255, 0);
  line(0, hitLineY, width, hitLineY);
}

function hit(note) {
  note.pressed = true;
  score++;
  total++;
  accuracyHistory.push(1);
}

function drawScore() {
  fill(255);
  textSize(24);
  text(`Score: ${score}`, 20, 40);
}
