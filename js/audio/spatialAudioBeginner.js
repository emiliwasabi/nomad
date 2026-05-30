let audioCtx = null;
let oscillator = null;
let mediaElement = null;
let mediaSource = null;
let mediaObjectUrl = null;
let gainNode = null;
let panner = null;
let orbitTimer = null;
let orbitAngle = 0;
let isGuidanceAudioMode = false;
let cueTimer = null;
let cueBucket = "front";

function initSpatialAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  console.log("[SpatialAudio] AudioContext pret");
  return audioCtx;
}

function ensureAudioGraph() {
  if (!audioCtx || gainNode || panner) return;

  gainNode = audioCtx.createGain();
  panner = new PannerNode(audioCtx, {
    panningModel: "HRTF",
    distanceModel: "inverse",
    positionX: 1,
    positionY: 0,
    positionZ: 0,
    refDistance: 1,
    maxDistance: 1000,
    rolloffFactor: 1,
  });

  gainNode.connect(panner);
  panner.connect(audioCtx.destination);
}

function refreshOutputLevel() {
  if (!gainNode) return;
  if (mediaElement) {
    gainNode.gain.value = isGuidanceAudioMode ? 0.75 : 0.35;
  } else {
    gainNode.gain.value = isGuidanceAudioMode ? 0.14 : 0.07;
  }
}

function clearGuidanceCue() {
  if (cueTimer) {
    clearInterval(cueTimer);
    cueTimer = null;
  }
}

function playCueTone(durationMs, frequency = 980) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.start();
  osc.stop(now + durationMs / 1000 + 0.02);
}

function startGuidanceCueLoop() {
  clearGuidanceCue();
  cueTimer = setInterval(() => {
    // Avant: double bip court. Arriere: bip long grave.
    if (cueBucket === "front") {
      playCueTone(90, 1050);
      setTimeout(() => playCueTone(90, 1050), 180);
    } else if (cueBucket === "back") {
      playCueTone(420, 620);
    }
  }, 10000);
}

function startDirectionalTone() {
  initSpatialAudio();
  if (!audioCtx || oscillator) return;
  if (mediaElement) {
    startSpatialMusic();
    return;
  }

  ensureAudioGraph();
  oscillator = audioCtx.createOscillator();

  oscillator.type = "sine";
  oscillator.frequency.value = 220;
  refreshOutputLevel();

  oscillator.connect(gainNode);
  oscillator.start();

  console.log("[SpatialAudio] Son demarre");
}

function setSpatialAudioFile(file) {
  if (!file) return;
  initSpatialAudio();
  ensureAudioGraph();
  if (mediaElement) {
    mediaElement.pause();
    mediaElement.currentTime = 0;
  }
  if (mediaSource) mediaSource.disconnect();
  if (mediaObjectUrl) URL.revokeObjectURL(mediaObjectUrl);
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
    oscillator = null;
  }

  mediaObjectUrl = URL.createObjectURL(file);
  mediaElement = new Audio(mediaObjectUrl);
  mediaElement.loop = true;
  mediaElement.crossOrigin = "anonymous";
  mediaSource = audioCtx.createMediaElementSource(mediaElement);
  mediaSource.connect(gainNode);
  refreshOutputLevel();
}

async function startSpatialMusic() {
  if (!mediaElement) return false;
  initSpatialAudio();
  await mediaElement.play();
  console.log("[SpatialAudio] Musique spatiale demarree");
  return true;
}

function setSoundDirection(x, y = 0, z = 0) {
  if (!panner) return;
  panner.positionX.value = x;
  panner.positionY.value = y;
  panner.positionZ.value = z;
  console.log(`[SpatialAudio] Direction x=${x}, y=${y}, z=${z}`);
}

function setGuidanceAudioMode(enabled) {
  isGuidanceAudioMode = Boolean(enabled);
  refreshOutputLevel();
  if (isGuidanceAudioMode) {
    startGuidanceCueLoop();
  } else {
    clearGuidanceCue();
  }
}

function setGuidanceDirectionBucket(bucket) {
  cueBucket = bucket;
}

function startOrbitAroundHead(speed = 0.04, radius = 1.5) {
  if (!panner) return;
  if (orbitTimer) clearInterval(orbitTimer);

  orbitTimer = setInterval(() => {
    orbitAngle += speed;
    const x = Math.cos(orbitAngle) * radius;
    const z = Math.sin(orbitAngle) * radius;
    setSoundDirection(x, 0, z);
  }, 40);

  console.log("[SpatialAudio] Orbit 8D demarre");
}

function stopOrbitAroundHead() {
  if (!orbitTimer) return;
  clearInterval(orbitTimer);
  orbitTimer = null;
  console.log("[SpatialAudio] Orbit 8D arrete");
}

function stopDirectionalTone() {
  stopOrbitAroundHead();
  clearGuidanceCue();
  if (mediaElement) {
    mediaElement.pause();
    mediaElement.currentTime = 0;
  }
  if (oscillator) {
    oscillator.stop();
    oscillator.disconnect();
  }

  oscillator = null;
  setGuidanceAudioMode(false);

  console.log("[SpatialAudio] Son arrete");
}

window.initSpatialAudio = initSpatialAudio;
window.startDirectionalTone = startDirectionalTone;
window.setSpatialAudioFile = setSpatialAudioFile;
window.startSpatialMusic = startSpatialMusic;
window.setSoundDirection = setSoundDirection;
window.setGuidanceAudioMode = setGuidanceAudioMode;
window.setGuidanceDirectionBucket = setGuidanceDirectionBucket;
window.startOrbitAroundHead = startOrbitAroundHead;
window.stopOrbitAroundHead = stopOrbitAroundHead;
window.stopDirectionalTone = stopDirectionalTone;
