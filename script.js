// --- Canvas & game setup ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const lanes = ["a","s","k","l"];
const laneWidth = canvas.width / lanes.length;
const hitY = canvas.height - 60;
const hitWindow = 40;
let notes = [];
let score = 0;

// --- AI Visualization ---
const aiCanvas = document.createElement("canvas");
aiCanvas.width = 600;
aiCanvas.height = 100;
aiCanvas.style.background = "#111";
aiCanvas.style.marginTop = "20px";
document.body.insertBefore(aiCanvas, canvas);
const aiCtx = aiCanvas.getContext("2d");
let aiHistory = [];

// --- RMS Setup ---
const rmsCanvas = document.getElementById("rmsCanvas");
const rmsCtx = rmsCanvas.getContext("2d");
let rmsHistory = [];
const rmsHistoryLength = 1024;

// --- Audio Setup ---
const songUpload = document.getElementById("songUpload");
const audioElement = new Audio();
audioElement.crossOrigin = "anonymous";
let audioContext, sourceNode, analyzer;

// --- Load DrumKitRNN model ---
let drumModel;
(async () => {
  drumModel = new mm.DrumKitRNN('./drum_kit_rnn.mag'); // make sure path is correct
  await drumModel.initialize();
  console.log("DrumKitRNN loaded");
})();

// --- File Upload ---
songUpload.addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  audioElement.src = URL.createObjectURL(file);
  resetGame();
});

// --- Play Button ---
const playBtn = document.createElement("button");
playBtn.textContent = "▶️ Play Song";
document.body.insertBefore(playBtn, canvas.nextSibling);

playBtn.addEventListener("click", async ()=>{
  resetGame();
  playBtn.textContent = "Loading...";
  playBtn.disabled = true;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(audioContext.destination);

    // --- Small seed sequence so model generates notes ---
    const seedSequence = {
      notes: [{ pitch: 36, startStep: 0, endStep: 1 }], // Kick drum
      totalQuantizedSteps: 4,
      quantizationInfo: { stepsPerQuarter: 4 }
    };

    let lastGenerationTime = 0;
    const generationInterval = 0.3; // generate notes every 0.3s

    // --- Meyda Analyzer ---
    analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize: 1024,
      featureExtractors: ["rms"],
      callback: async (features) => {
        if(!features || !drumModel) return;
        const rms = features.rms;
        rmsHistory.push(rms);
        if(rmsHistory.length > rmsHistoryLength) rmsHistory.shift();

        const now = audioContext.currentTime;
        let noteSpawned = false;

        // --- Throttle generation ---
        if(rms > 0.01 && now - lastGenerationTime > generationInterval){ 
          lastGenerationTime = now;

          const drumSeq = await drumModel.generate({
            seedDrumSequence: seedSequence,
            steps: 16 // generate a small sequence
          });

          if(drumSeq.notes.length > 0){
            const first = drumSeq.notes[0];
            const laneIndex = first.pitch % lanes.length;
            notes.push({ lane: laneIndex, y: 0, hit: false });
            noteSpawned = true;
          }
        }

        // --- AI Visualization ---
        aiHistory.push(noteSpawned ? 1 : 0);
        if(aiHistory.length > aiCanvas.width) aiHistory.shift();
        drawAIVisualization();
      }
    });

    analyzer.start();
    await audioElement.play();
    playBtn.textContent = "Playing...";
    gameLoop();

  } catch(err){
    console.error(err);
    playBtn.textContent = "▶️ Try Again";
    playBtn.disabled = false;
  }
});

// --- Key input ---
const keys = {};
window.addEventListener("keydown", e=>keys[e.key.toLowerCase()]=true);
window.addEventListener("keyup", e=>keys[e.key.toLowerCase()]=false);

// --- Main game loop ---
function gameLoop(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // lanes
  lanes.forEach((key,i)=>{
    ctx.fillStyle = keys[key] ? "#0f0" : "#333";
    ctx.fillRect(i*laneWidth,0,laneWidth-2,canvas.height);
  });

  // hit line
  ctx.fillStyle = "yellow";
  ctx.fillRect(0, hitY, canvas.width, 5);

  // draw notes
  notes.forEach(n=>{
    n.y += 5;
    ctx.fillStyle = "red";
    ctx.fillRect(n.lane*laneWidth +5, n.y, laneWidth-10,30);

    const keyPressed = keys[lanes[n.lane]];
    if(Math.abs(n.y - hitY) < hitWindow && keyPressed && !n.hit){
      score += 100;
      scoreEl.textContent = "Score: " + score;
      n.hit = true;
    }
  });

  notes = notes.filter(n => !n.hit && n.y < canvas.height);

  requestAnimationFrame(gameLoop);
}

// --- AI Visualization ---
function drawAIVisualization(){
  aiCtx.clearRect(0,0,aiCanvas.width,aiCanvas.height);
  aiHistory.forEach((val,i)=>{
    const h = val*aiCanvas.height;
    aiCtx.fillStyle = "#08f";
    aiCtx.fillRect(i, aiCanvas.height - h, 1, h);
    if(val>0){
      aiCtx.fillStyle = "#0f8";
      aiCtx.fillRect(i,0,1,aiCanvas.height);
    }
  });
}

// --- Reset ---
function resetGame(){
  if(analyzer) analyzer.stop();
  if(audioContext) audioContext.close();
  notes=[];
  score=0;
  rmsHistory=[];
  aiHistory=[];
  scoreEl.textContent="Score: 0";
  playBtn.disabled=false;
  playBtn.textContent="▶️ Play Song";
  audioElement.pause();
  audioElement.currentTime=0;
}
