function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

function normalizeAngleDeg(angle) {
  let value = angle % 360;
  if (value < -180) value += 360;
  if (value > 180) value -= 360;
  return value;
}

function distanceMeters(a, b) {
  const earthRadius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return earthRadius * c;
}

function bearingToDestination(from, to) {
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function cardinalFromBearing(bearing) {
  if (bearing >= 45 && bearing < 135) return "est";
  if (bearing >= 135 && bearing < 225) return "sud";
  if (bearing >= 225 && bearing < 315) return "ouest";
  return "nord";
}

function isMovingTowardDestination(previousPos, currentPos, destination, toleranceDeg) {
  const moveBearing = bearingToDestination(previousPos, currentPos);
  const targetBearing = bearingToDestination(currentPos, destination);
  const delta = Math.abs(normalizeAngleDeg(moveBearing - targetBearing));
  return delta <= toleranceDeg;
}

window.GuidanceMath = {
  toRad,
  normalizeAngleDeg,
  distanceMeters,
  bearingToDestination,
  cardinalFromBearing,
  isMovingTowardDestination,
};
