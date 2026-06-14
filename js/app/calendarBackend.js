const DEVICE_KEY = "nomad_device_id";

function isBluefy() {
  return /Bluefy/i.test(navigator.userAgent);
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `dev-${Date.now()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getBackendUrl() {
  if (window.GCAL_CONFIG?.CALENDAR_BACKEND_URL) {
    return window.GCAL_CONFIG.CALENDAR_BACKEND_URL.replace(/\/$/, "");
  }
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return `http://${window.location.hostname}:8787`;
  }
  return "";
}

function isRequired() {
  return isBluefy() || Boolean(window.GCAL_CONFIG?.CALENDAR_BACKEND_URL);
}

function getAuthLink() {
  const base = getBackendUrl();
  if (!base) return "";
  return `${base}/auth/calendar/start?device_id=${encodeURIComponent(getDeviceId())}`;
}

async function checkStatus() {
  const base = getBackendUrl();
  if (!base) return false;

  const response = await fetch(
    `${base}/auth/calendar/status?device_id=${encodeURIComponent(getDeviceId())}`,
  );
  if (!response.ok) return false;
  const data = await response.json();
  return Boolean(data.connected);
}

async function fetchNextEventWithLocation() {
  const base = getBackendUrl();
  if (!base) throw new Error("Serveur Calendar non configure.");

  const response = await fetch(
    `${base}/api/calendar/next-event?device_id=${encodeURIComponent(getDeviceId())}`,
  );
  if (response.status === 401) {
    throw new Error("Calendar non lie. Ouvrez le lien dans Safari d'abord.");
  }
  if (!response.ok) {
    throw new Error("Impossible de lire Google Calendar via le serveur.");
  }

  const data = await response.json();
  return data.event || null;
}

async function copyAuthLink() {
  const link = getAuthLink();
  if (!link) return false;
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}

window.PlayerCalendarBackend = {
  isRequired,
  isBluefy,
  getAuthLink,
  checkStatus,
  fetchNextEventWithLocation,
  copyAuthLink,
  getBackendUrl,
};
