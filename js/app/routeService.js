function getBackendBaseUrl() {
  if (window.GCAL_CONFIG?.GUIDANCE_BACKEND_URL) {
    return window.GCAL_CONFIG.GUIDANCE_BACKEND_URL;
  }
  return `http://${window.location.hostname}:8787`;
}

async function fetchRouteWaypointsFromBackend(origin, destination) {
  const response = await fetch(`${getBackendBaseUrl()}/api/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination }),
  });
  if (!response.ok) throw new Error("Backend route failed");
  const data = await response.json();
  return data.waypoints || [];
}

async function fetchRouteWaypoints(origin, destination) {
  try {
    const waypoints = await fetchRouteWaypointsFromBackend(origin, destination);
    if (waypoints.length) return waypoints;
  } catch {
    // fallback navigateur
  }

  const apiKey = window.GCAL_CONFIG?.API_KEY || "";
  if (!apiKey || !window.google?.maps?.importLibrary) return [];

  try {
    if (typeof window.loadGoogleMapsJsApi === "function") {
      await window.loadGoogleMapsJsApi(apiKey);
    }
    const { Route } = await google.maps.importLibrary("routes");
    const routeResult = await Route.computeRoutes({
      origin: { lat: origin.latitude, lng: origin.longitude },
      destination: { lat: destination.latitude, lng: destination.longitude },
      travelMode: "WALKING",
    });
    const route = routeResult.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return [];

    const { encoding } = await google.maps.importLibrary("geometry");
    return encoding.decodePath(route.polyline.encodedPolyline).map((point) => ({
      latitude: point.lat(),
      longitude: point.lng(),
    }));
  } catch {
    return [];
  }
}

window.PlayerRouteService = {
  fetchRouteWaypoints,
};
