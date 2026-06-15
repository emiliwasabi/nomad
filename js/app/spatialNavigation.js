let currentX = 0;
let currentZ = 1;
let active = false;
const SMOOTHING = 0.18;
let lastRelativeDeg = null;
let updateCount = 0;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function startSpatialNav() {
  active = true;
  currentX = 0;
  currentZ = 1;
  if (typeof window.setGuidanceAudioMode === "function") {
    window.setGuidanceAudioMode(false);
  }
  if (typeof window.stopOrbitAroundHead === "function") {
    window.stopOrbitAroundHead();
  }
}

function stopSpatialNav() {
  active = false;
  currentX = 0;
  currentZ = 1;
  if (typeof window.setSoundDirection === "function") {
    window.setSoundDirection(0, 0, 1);
  }
}

function updateRelativeBearing(relativeDeg) {
  if (!active || typeof window.setSoundDirection !== "function") return;

  lastRelativeDeg = relativeDeg;
  updateCount += 1;

  const targetRad = toRad(relativeDeg);
  const targetX = Math.sin(targetRad);
  const targetZ = Math.cos(targetRad);

  currentX += (targetX - currentX) * SMOOTHING;
  currentZ += (targetZ - currentZ) * SMOOTHING;

  window.setSoundDirection(currentX, 0, currentZ);
}

function getAlignmentLabel(relativeDeg) {
  const abs = Math.abs(relativeDeg);
  if (abs <= 12) return "centre — cap correct";
  if (relativeDeg > 0 && relativeDeg <= 90) return "decale a droite";
  if (relativeDeg < 0 && relativeDeg >= -90) return "decale a gauche";
  if (relativeDeg > 90) return "destination derriere (droite)";
  return "destination derriere (gauche)";
}

window.PlayerSpatialNav = {
  start: startSpatialNav,
  stop: stopSpatialNav,
  updateRelativeBearing,
  getAlignmentLabel,
  getDebugState: () => ({
    active,
    currentX,
    currentZ,
    lastRelativeDeg,
    updateCount,
  }),
};
