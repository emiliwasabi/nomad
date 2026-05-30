const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT || 8787);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              statusCode: res.statusCode || 500,
              data: JSON.parse(raw),
            });
          } catch (error) {
            reject(new Error("Invalid JSON from upstream"));
          }
        });
      })
      .on("error", reject);
  });
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

  try {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "POST" && req.url === "/api/geocode") {
      return await handleGeocode(req, res);
    }
    if (req.method === "POST" && req.url === "/api/route") {
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
  console.log(`Guidance backend listening on http://localhost:${PORT}`);
});
