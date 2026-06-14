const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT || 8787);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `http://localhost:${PORT}/auth/calendar/callback`;
const SESSIONS_FILE =
  process.env.CALENDAR_SESSIONS_FILE ||
  path.join(__dirname, ".calendar-sessions.json");

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const calendarSessions = new Map();

function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    Object.entries(data).forEach(([deviceId, session]) => {
      calendarSessions.set(deviceId, session);
    });
  } catch (error) {
    console.warn("[Calendar] Could not load sessions:", error.message);
  }
}

function saveSessions() {
  try {
    const data = Object.fromEntries(calendarSessions.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn("[Calendar] Could not save sessions:", error.message);
  }
}

loadSessions();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(html);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode || 500,
            data: raw ? JSON.parse(raw) : {},
          });
        } catch {
          reject(new Error("Invalid JSON from upstream"));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function fetchJson(url) {
  return httpsRequest(url, { method: "GET" });
}

function getQuery(url) {
  return new URL(url, `http://localhost:${PORT}`);
}

function calendarConfigured() {
  return Boolean(
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI,
  );
}

async function exchangeAuthCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  }).toString();

  return httpsRequest(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body,
  );
}

async function refreshAccessToken(session) {
  if (
    session.access_token &&
    session.expires_at &&
    Date.now() < session.expires_at - 60_000
  ) {
    return session.access_token;
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: session.refresh_token,
    grant_type: "refresh_token",
  }).toString();

  const upstream = await httpsRequest(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body,
  );

  if (upstream.statusCode >= 400 || !upstream.data.access_token) {
    throw new Error("Token refresh failed");
  }

  session.access_token = upstream.data.access_token;
  session.expires_at = Date.now() + Number(upstream.data.expires_in || 3600) * 1000;
  saveSessions();
  return session.access_token;
}

async function calendarApiGet(accessToken, apiPath) {
  const url = `https://www.googleapis.com/calendar/v3${apiPath}`;
  return httpsRequest(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

function formatEventTime(value) {
  if (!value) return "??:??";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "??:??";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hasPhysicalLocation(event) {
  const location = event?.location?.trim();
  return Boolean(location && location.toLowerCase() !== "lieu non renseigne");
}

async function fetchNextEventWithLocation(accessToken) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 7);

  const calendarsResp = await calendarApiGet(
    accessToken,
    "/users/me/calendarList?showHidden=false&minAccessRole=reader",
  );
  if (calendarsResp.statusCode >= 400) {
    throw new Error("Calendar list failed");
  }

  const calendars = (calendarsResp.data.items || []).filter(
    (calendar) => calendar.selected !== false,
  );

  const eventResponses = await Promise.all(
    calendars.map((calendar) =>
      calendarApiGet(
        accessToken,
        `/calendars/${encodeURIComponent(calendar.id)}/events?` +
          new URLSearchParams({
            timeMin: now.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "20",
          }).toString(),
      ),
    ),
  );

  const events = eventResponses
    .flatMap((response) => response.data.items || [])
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => {
      const aStart = new Date(a.start?.dateTime || a.start?.date).getTime();
      const bStart = new Date(b.start?.dateTime || b.start?.date).getTime();
      return aStart - bStart;
    });

  const next = events.find(hasPhysicalLocation);
  if (!next) return null;

  const startRaw = next.start?.dateTime || next.start?.date;
  const timeLabel = formatEventTime(startRaw);
  const location = next.location.trim();

  return {
    id: next.id,
    summary: next.summary || "Evenement",
    timeLabel,
    location,
    displayLine: `${timeLabel} — ${next.summary || "Evenement"}`,
  };
}

function handleCalendarStart(req, res) {
  if (!calendarConfigured()) {
    return sendJson(res, 500, {
      error: "Calendar OAuth not configured on server.",
    });
  }

  const query = getQuery(req.url);
  const deviceId = query.searchParams.get("device_id");
  if (!deviceId) {
    return sendJson(res, 400, { error: "device_id is required" });
  }

  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: CALENDAR_SCOPE,
      access_type: "offline",
      prompt: "consent",
      state: deviceId,
    }).toString();

  res.writeHead(302, { Location: authUrl });
  res.end();
}

async function handleCalendarCallback(req, res) {
  const query = getQuery(req.url);
  const error = query.searchParams.get("error");
  const deviceId = query.searchParams.get("state");
  const code = query.searchParams.get("code");

  if (error || !deviceId || !code) {
    return sendHtml(
      res,
      400,
      "<h1>Connexion refusee</h1><p>Retournez dans Nomad / Bluefy.</p>",
    );
  }

  try {
    const upstream = await exchangeAuthCode(code);
    if (upstream.statusCode >= 400 || !upstream.data.refresh_token) {
      throw new Error("OAuth exchange failed");
    }

    calendarSessions.set(deviceId, {
      refresh_token: upstream.data.refresh_token,
      access_token: upstream.data.access_token || null,
      expires_at: upstream.data.expires_in
        ? Date.now() + upstream.data.expires_in * 1000
        : null,
      linked_at: Date.now(),
    });
    saveSessions();

    return sendHtml(
      res,
      200,
      `<!doctype html>
      <html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Calendar lie</title></head>
      <body style="font-family:system-ui;padding:2rem;text-align:center">
        <h1>Google Calendar lie</h1>
        <p>Retournez dans <strong>Bluefy</strong> et appuyez sur<br><strong>Verifier connexion Calendar</strong>.</p>
      </body></html>`,
    );
  } catch (callbackError) {
    return sendHtml(
      res,
      500,
      `<h1>Erreur</h1><p>${callbackError.message}</p>`,
    );
  }
}

function handleCalendarStatus(req, res) {
  const query = getQuery(req.url);
  const deviceId = query.searchParams.get("device_id");
  if (!deviceId) {
    return sendJson(res, 400, { error: "device_id is required" });
  }

  return sendJson(res, 200, {
    connected: calendarSessions.has(deviceId),
  });
}

async function handleCalendarNextEvent(req, res) {
  const query = getQuery(req.url);
  const deviceId = query.searchParams.get("device_id");
  if (!deviceId) {
    return sendJson(res, 400, { error: "device_id is required" });
  }

  const session = calendarSessions.get(deviceId);
  if (!session?.refresh_token) {
    return sendJson(res, 401, { error: "Calendar not linked" });
  }

  try {
    const accessToken = await refreshAccessToken(session);
    const event = await fetchNextEventWithLocation(accessToken);
    return sendJson(res, 200, { event });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleGeocode(req, res) {
  if (!GOOGLE_MAPS_API_KEY) {
    return sendJson(res, 500, {
      error: "GOOGLE_MAPS_API_KEY missing on server.",
    });
  }

  const body = await parseBody(req);
  const address = String(body.address || "").trim();
  if (!address) {
    return sendJson(res, 400, { error: "address is required" });
  }

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(address)}` +
    `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;

  const upstream = await fetchJson(url);
  if (upstream.statusCode >= 400) {
    return sendJson(res, upstream.statusCode, {
      error: "Upstream geocode request failed",
      details: upstream.data,
    });
  }

  const first = upstream.data.results?.[0];
  if (upstream.data.status !== "OK" || !first?.geometry?.location) {
    return sendJson(res, 400, {
      error: "Address not found",
      status: upstream.data.status,
      details: upstream.data.error_message || null,
    });
  }

  return sendJson(res, 200, {
    latitude: first.geometry.location.lat,
    longitude: first.geometry.location.lng,
    formattedAddress: first.formatted_address || address,
  });
}

async function handleRoute(req, res) {
  if (!GOOGLE_MAPS_API_KEY) {
    return sendJson(res, 500, {
      error: "GOOGLE_MAPS_API_KEY missing on server.",
    });
  }

  const body = await parseBody(req);
  const origin = body.origin || {};
  const destination = body.destination || {};
  const oLat = Number(origin.latitude);
  const oLng = Number(origin.longitude);
  const dLat = Number(destination.latitude);
  const dLng = Number(destination.longitude);
  if (![oLat, oLng, dLat, dLng].every(Number.isFinite)) {
    return sendJson(res, 400, {
      error: "origin/destination lat/lng are required",
    });
  }

  const url =
    "https://maps.googleapis.com/maps/api/directions/json" +
    `?origin=${encodeURIComponent(`${oLat},${oLng}`)}` +
    `&destination=${encodeURIComponent(`${dLat},${dLng}`)}` +
    "&mode=walking" +
    `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;

  const upstream = await fetchJson(url);
  if (upstream.statusCode >= 400) {
    return sendJson(res, upstream.statusCode, {
      error: "Upstream route request failed",
      details: upstream.data,
    });
  }

  if (upstream.data.status !== "OK") {
    return sendJson(res, 400, {
      error: "Route not found",
      status: upstream.data.status,
      details: upstream.data.error_message || null,
    });
  }

  const steps = upstream.data.routes?.[0]?.legs?.[0]?.steps || [];
  const waypoints = steps.map((step) => ({
    latitude: step.end_location.lat,
    longitude: step.end_location.lng,
  }));

  return sendJson(res, 200, { waypoints });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return sendJson(res, 404, { error: "Not found" });
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  const pathname = getQuery(req.url).pathname;

  try {
    if (req.method === "GET" && pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        calendar: calendarConfigured(),
      });
    }
    if (req.method === "GET" && pathname === "/auth/calendar/start") {
      return handleCalendarStart(req, res);
    }
    if (req.method === "GET" && pathname === "/auth/calendar/callback") {
      return await handleCalendarCallback(req, res);
    }
    if (req.method === "GET" && pathname === "/auth/calendar/status") {
      return handleCalendarStatus(req, res);
    }
    if (req.method === "GET" && pathname === "/api/calendar/next-event") {
      return await handleCalendarNextEvent(req, res);
    }
    if (req.method === "POST" && pathname === "/api/geocode") {
      return await handleGeocode(req, res);
    }
    if (req.method === "POST" && pathname === "/api/route") {
      return await handleRoute(req, res);
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message || "Unknown server error",
    });
  }
});

server.listen(PORT, () => {
  console.log(`Nomad backend listening on http://localhost:${PORT}`);
  if (!calendarConfigured()) {
    console.log(
      "[Calendar] Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI for Bluefy support.",
    );
  }
});
