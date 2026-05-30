let mapsApiLoadPromise = null;

function getGuidanceBackendBaseUrl() {
  if (window.GCAL_CONFIG?.GUIDANCE_BACKEND_URL) {
    return window.GCAL_CONFIG.GUIDANCE_BACKEND_URL;
  }
  return `http://${window.location.hostname}:8787`;
}

async function resolveAddressWithBackend(address) {
  const baseUrl = getGuidanceBackendBaseUrl();
  const response = await fetch(`${baseUrl}/api/geocode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!response.ok) {
    throw new Error("Backend geocode failed");
  }
  return response.json();
}

function loadGoogleMapsJsApi(apiKey) {
  if (window.google?.maps?.Geocoder) return Promise.resolve();
  if (mapsApiLoadPromise) return mapsApiLoadPromise;

  mapsApiLoadPromise = new Promise((resolve, reject) => {
    const callbackName = "__onGoogleMapsLoaded";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geocoding,routes&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error("Impossible de charger Google Maps JavaScript API."));
    document.head.appendChild(script);
  });

  return mapsApiLoadPromise;
}

async function resolveAddressWithGoogleMaps(address) {
  const trimmed = address?.trim();
  if (!trimmed) throw new Error("Adresse vide.");

  try {
    return await resolveAddressWithBackend(trimmed);
  } catch {
    // fallback: navigateur -> Google Maps JS API
  }

  const apiKey = window.GCAL_CONFIG?.API_KEY || "";
  if (!apiKey) throw new Error("API_KEY manquante dans config.local.js.");

  await loadGoogleMapsJsApi(apiKey);

  const geocoder = new google.maps.Geocoder();
  const result = await geocoder.geocode({ address: trimmed });
  const first = result.results?.[0];
  if (!first?.geometry?.location) {
    throw new Error(
      `Adresse introuvable (${result.status || "ZERO_RESULTS"}).`,
    );
  }

  const location = first.geometry.location;
  return {
    latitude:
      typeof location.lat === "function" ? location.lat() : location.lat,
    longitude:
      typeof location.lng === "function" ? location.lng() : location.lng,
    formattedAddress: first.formatted_address || trimmed,
  };
}

window.resolveAddressWithGoogleMaps = resolveAddressWithGoogleMaps;
window.loadGoogleMapsJsApi = loadGoogleMapsJsApi;
