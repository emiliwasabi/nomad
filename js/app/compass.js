let headingDeg = 0;
let compassActive = false;

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

window.PlayerCompass = {
  start: startCompass,
  stop: stopCompass,
  getHeadingDeg,
};
