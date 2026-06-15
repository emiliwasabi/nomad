let headingDeg = 0;
let compassActive = false;
let permissionGranted = false;
let onHeadingChange = null;
let lastEmitMs = 0;
const EMIT_MS = 50;

function readHeadingFromEvent(event) {
  if (
    typeof event.webkitCompassHeading === "number" &&
    !Number.isNaN(event.webkitCompassHeading)
  ) {
    return event.webkitCompassHeading;
  }
  if (typeof event.alpha === "number" && !Number.isNaN(event.alpha)) {
    return (360 - event.alpha) % 360;
  }
  return null;
}

function onDeviceOrientation(event) {
  const heading = readHeadingFromEvent(event);
  if (heading === null || Number.isNaN(heading)) return;
  headingDeg = heading;

  if (!onHeadingChange) return;
  const now = Date.now();
  if (now - lastEmitMs < EMIT_MS) return;
  lastEmitMs = now;
  onHeadingChange(heading);
}

function attachListeners() {
  window.addEventListener("deviceorientation", onDeviceOrientation, true);
  window.addEventListener("deviceorientationabsolute", onDeviceOrientation, true);
}

function detachListeners() {
  window.removeEventListener("deviceorientation", onDeviceOrientation, true);
  window.removeEventListener(
    "deviceorientationabsolute",
    onDeviceOrientation,
    true,
  );
}

async function ensurePermission() {
  if (permissionGranted) return { granted: true };

  if (
    typeof DeviceOrientationEvent === "undefined" ||
    typeof DeviceOrientationEvent.requestPermission !== "function"
  ) {
    permissionGranted = true;
    return { granted: true, legacy: true };
  }

  try {
    const state = await DeviceOrientationEvent.requestPermission(true);
    permissionGranted = state === "granted";
    return { granted: permissionGranted, denied: state === "denied" };
  } catch (error) {
    return { granted: false, error: error.message };
  }
}

async function startCompass() {
  if (compassActive) return { ok: true };

  const permission = await ensurePermission();
  if (!permission.granted) {
    return {
      ok: false,
      reason: permission.denied
        ? "denied"
        : permission.error || "permission_required",
    };
  }

  attachListeners();
  compassActive = true;
  return { ok: true };
}

function stopCompass() {
  if (!compassActive) return;
  detachListeners();
  compassActive = false;
}

function getHeadingDeg() {
  return headingDeg;
}

function isCompassActive() {
  return compassActive;
}

function setOnHeadingChange(callback) {
  onHeadingChange = typeof callback === "function" ? callback : null;
  lastEmitMs = 0;
}

window.PlayerCompass = {
  start: startCompass,
  stop: stopCompass,
  getHeadingDeg,
  setOnHeadingChange,
  isActive: isCompassActive,
};
