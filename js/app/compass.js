let headingDeg = 0;
let compassActive = false;
let onHeadingChange = null;
let lastEmitMs = 0;
const EMIT_MS = 50;

function readHeadingFromEvent(event) {
  if (typeof event.webkitCompassHeading === "number") {
    return event.webkitCompassHeading;
  }
  if (event.absolute && typeof event.alpha === "number") {
    return (360 - event.alpha) % 360;
  }
  if (typeof event.alpha === "number") {
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

function startCompass() {
  if (compassActive) return;
  window.addEventListener("deviceorientation", onDeviceOrientation, true);
  window.addEventListener("deviceorientationabsolute", onDeviceOrientation, true);
  compassActive = true;
}

function stopCompass() {
  if (!compassActive) return;
  window.removeEventListener("deviceorientation", onDeviceOrientation, true);
  window.removeEventListener(
    "deviceorientationabsolute",
    onDeviceOrientation,
    true,
  );
  compassActive = false;
}

function getHeadingDeg() {
  return headingDeg;
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
};
