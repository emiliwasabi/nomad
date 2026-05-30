const GM = () => window.GuidanceMath;

let navState = {
  active: false,
  trackerId: null,
  destination: null,
  routeWaypoints: [],
  lastPosition: null,
  intervalMs: 2500,
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

function onLocationUpdate(position) {
  navState.lastPosition = position;
  if (!navState.active || !navState.destination) return;

  maybeFetchRoute(position);

  const heading =
    window.PlayerCompass.getHeadingDeg() ??
    (Number.isFinite(position.heading) ? position.heading : 0);
  const relative = computeRelativeBearing(position, heading);
  if (relative === null) return;

  window.PlayerSpatialNav.updateRelativeBearing(relative);

  window.dispatchEvent(
    new CustomEvent("player-nav-update", {
      detail: buildStatus(position),
    }),
  );
}

async function startNavigation(destination) {
  stopNavigation();

  navState.destination = destination;
  navState.active = true;

  window.PlayerCompass.start();
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
};
