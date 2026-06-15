let headingDeg = 0;
let compassActive = false;
let permissionGranted = false;
let onHeadingChange = null;
let lastEmitMs = 0;
const EMIT_MS = 50;

const debug = {
  eventCount: 0,
  lastEventMs: 0,
  rawWebkit: null,
  rawAlpha: null,
  rawAbsolute: false,
  permissionLabel: "inconnu",
  permissionNeedsPrompt: false,
  lastPermissionReason: null,
  headingDelta: 0,
  lastHeadingSample: null,
};

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
  debug.eventCount += 1;
  debug.lastEventMs = Date.now();
  debug.rawWebkit =
    typeof event.webkitCompassHeading === "number" ? event.webkitCompassHeading : null;
  debug.rawAlpha = typeof event.alpha === "number" ? event.alpha : null;
  debug.rawAbsolute = Boolean(event.absolute);

  const heading = readHeadingFromEvent(event);
  if (heading === null || Number.isNaN(heading)) return;

  if (debug.lastHeadingSample !== null) {
    let delta = Math.abs(heading - debug.lastHeadingSample);
    if (delta > 180) delta = 360 - delta;
    debug.headingDelta = Math.max(debug.headingDelta * 0.9, delta);
  }
  debug.lastHeadingSample = heading;
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
  if (permissionGranted) {
    debug.permissionLabel = "accordee";
    return { granted: true };
  }

  if (
    typeof DeviceOrientationEvent === "undefined" ||
    typeof DeviceOrientationEvent.requestPermission !== "function"
  ) {
    permissionGranted = true;
    debug.permissionLabel = "non requise (desktop)";
    debug.permissionNeedsPrompt = false;
    return { granted: true, legacy: true };
  }

  debug.permissionNeedsPrompt = true;
  try {
    const state = await DeviceOrientationEvent.requestPermission(true);
    permissionGranted = state === "granted";
    debug.permissionLabel = state;
    debug.lastPermissionReason = state;
    return { granted: permissionGranted, denied: state === "denied" };
  } catch (error) {
    debug.permissionLabel = `erreur: ${error.message}`;
    debug.lastPermissionReason = error.message;
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

function getDebugState() {
  return {
    compassActive,
    permissionGranted,
    permissionLabel: debug.permissionLabel,
    permissionNeedsPrompt: debug.permissionNeedsPrompt,
    lastPermissionReason: debug.lastPermissionReason,
    eventCount: debug.eventCount,
    lastEventMs: debug.lastEventMs,
    rawWebkit: debug.rawWebkit,
    rawAlpha: debug.rawAlpha,
    rawAbsolute: debug.rawAbsolute,
    headingDeg,
    headingDelta: debug.headingDelta,
  };
}

window.PlayerCompass = {
  start: startCompass,
  stop: stopCompass,
  getHeadingDeg,
  setOnHeadingChange,
  isActive: isCompassActive,
  getDebugState,
};
