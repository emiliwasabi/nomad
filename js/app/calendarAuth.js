let playerGapiReady = false;
let playerGisReady = false;
let playerTokenClient = null;

const PLAYER_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const PLAYER_DISCOVERY =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function getPlayerConfig() {
  return {
    clientId: window.GCAL_CONFIG?.CLIENT_ID || "",
    apiKey: window.GCAL_CONFIG?.API_KEY || "",
  };
}

function isPlayerCalendarReady() {
  return playerGapiReady && playerGisReady && Boolean(playerTokenClient);
}

window.playerGapiInit = function playerGapiInit() {
  const { clientId, apiKey } = getPlayerConfig();
  if (!clientId || !apiKey) return;

  gapi.load("client", async () => {
    await gapi.client.init({ apiKey, discoveryDocs: [PLAYER_DISCOVERY] });
    playerGapiReady = true;
    window.dispatchEvent(new CustomEvent("player-calendar-ready"));
  });
};

window.playerCalendarAuthInit = function playerCalendarAuthInit() {
  const { clientId } = getPlayerConfig();
  if (!clientId) return;

  playerTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: PLAYER_SCOPES,
    callback: (resp) => {
      if (resp.error) {
        window.dispatchEvent(
          new CustomEvent("player-calendar-auth-error", { detail: resp }),
        );
        return;
      }
      window.dispatchEvent(new CustomEvent("player-calendar-authenticated"));
    },
  });
  playerGisReady = true;
  window.dispatchEvent(new CustomEvent("player-calendar-ready"));
};

function requestPlayerCalendarAccess() {
  return new Promise((resolve, reject) => {
    if (!isPlayerCalendarReady()) {
      reject(new Error("Google Calendar pas pret."));
      return;
    }

    const onAuth = () => {
      cleanup();
      resolve();
    };
    const onError = (event) => {
      cleanup();
      reject(event.detail || new Error("Authentification refusee."));
    };
    const cleanup = () => {
      window.removeEventListener("player-calendar-authenticated", onAuth);
      window.removeEventListener("player-calendar-auth-error", onError);
    };

    window.addEventListener("player-calendar-authenticated", onAuth);
    window.addEventListener("player-calendar-auth-error", onError);
    playerTokenClient.requestAccessToken({ prompt: "" });
  });
}

window.PlayerCalendarAuth = {
  isReady: isPlayerCalendarReady,
  requestAccess: requestPlayerCalendarAccess,
};
