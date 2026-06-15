const GM = () => window.GuidanceMath;

let navState = {
  active: false,
  trackerId: null,
  destination: null,
  routeWaypoints: [],
  lastPosition: null,
  intervalMs: 2500,
  lastRelativeDeg: null,
  headingUpdateCount: 0,
  lastGpsMs: 0,
};

function computeRelativeBearing(position, headingDeg) {
  if (!navState.destination || !GM()) return null;

  const bearing = GM().bearingToDestination(position, navState.destination);
  return GM().normalizeAngleDeg(bearing - headingDeg);
}

function buildStatus(position) {
  if (!navState.destination || !position || !GM()) {
    return { navLine: "Navigation: inactive", alignLine: "Alignement: —" };
  }

  const distance = Math.round(
    GM().distanceMeters(position, navState.destination),
  );
  const relative = computeRelativeBearing(
    position,
    window.PlayerCompass.getHeadingDeg(),
  );

  return {
    navLine: `Navigation: ${distance} m vers ${navState.destination.label || "destination"}`,
    alignLine: `Alignement: ${window.PlayerSpatialNav.getAlignmentLabel(relative)}`,
    relativeDeg: relative,
  };
}

async function maybeFetchRoute(position) {
  if (!navState.destination || navState.routeWaypoints.length) return;
  navState.routeWaypoints = await window.PlayerRouteService.fetchRouteWaypoints(
    position,
    navState.destination,
  );
}

function applyBearingUpdate(position, heading) {
  const relative = computeRelativeBearing(position, heading);
  if (relative === null) return;

  navState.lastRelativeDeg = relative;
  window.PlayerSpatialNav.updateRelativeBearing(relative);

  window.dispatchEvent(
    new CustomEvent("player-nav-update", {
      detail: buildStatus(position),
    }),
  );
}

function onHeadingUpdate(heading) {
  if (!navState.active || !navState.destination || !navState.lastPosition) return;
  navState.headingUpdateCount += 1;
  applyBearingUpdate(navState.lastPosition, heading);
}

function onLocationUpdate(position) {
  navState.lastPosition = position;
  navState.lastGpsMs = Date.now();
  if (!navState.active || !navState.destination) return;

  maybeFetchRoute(position);

  const heading =
    window.PlayerCompass.getHeadingDeg() ??
    (Number.isFinite(position.heading) ? position.heading : 0);
  applyBearingUpdate(position, heading);
}

async function startNavigation(destination) {
  stopNavigation();

  navState.destination = destination;
  navState.active = true;

  await window.PlayerCompass.start();
  window.PlayerCompass.setOnHeadingChange(onHeadingUpdate);
  window.PlayerSpatialNav.start();

  navState.trackerId = window.startLocationTracking({
    intervalMs: navState.intervalMs,
    onUpdate: onLocationUpdate,
    onError: (error) => {
      window.dispatchEvent(
        new CustomEvent("player-nav-error", { detail: error.message }),
      );
    },
  });
}

function stopNavigation() {
  navState.active = false;
  navState.destination = null;
  navState.routeWaypoints = [];

  if (navState.trackerId) {
    window.stopLocationTracking(navState.trackerId);
    navState.trackerId = null;
  }

  window.PlayerCompass.setOnHeadingChange(null);
  window.PlayerCompass.stop();
  window.PlayerSpatialNav.stop();
}

function isActive() {
  return navState.active;
}

window.PlayerNavigationEngine = {
  start: startNavigation,
  stop: stopNavigation,
  isActive,
  buildStatus,
  getLastPosition: () => navState.lastPosition,
  getDebugState: () => ({
    active: navState.active,
    lastRelativeDeg: navState.lastRelativeDeg,
    headingUpdateCount: navState.headingUpdateCount,
    lastGpsMs: navState.lastGpsMs,
    hasDestination: Boolean(navState.destination),
    hasPosition: Boolean(navState.lastPosition),
  }),
};
