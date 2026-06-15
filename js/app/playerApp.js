const ui = {
  playButton: null,
  pauseButton: null,
  trackTitle: null,
  trackArtist: null,
  libraryInput: null,
  libraryList: null,
  connectCalendarButton: null,
  eventStatus: null,
  navStatus: null,
  alignmentStatus: null,
  bleStatus: null,
  bleButton: null,
};

let isPlaying = false;
let calendarConnected = false;

function bindUi() {
  ui.playButton = document.getElementById("play_button");
  ui.pauseButton = document.getElementById("pause_button");
  ui.trackTitle = document.getElementById("track_title");
  ui.trackArtist = document.getElementById("track_artist");
  ui.libraryInput = document.getElementById("library_input");
  ui.libraryList = document.getElementById("library_list");
  ui.connectCalendarButton = document.getElementById("connect_calendar_button");
  ui.eventStatus = document.getElementById("event_status");
  ui.navStatus = document.getElementById("nav_status");
  ui.alignmentStatus = document.getElementById("alignment_status");
  ui.bleStatus = document.getElementById("ble_status");
  ui.bleButton = document.getElementById("ble_connect_button");
}

function setStatus(eventLine, navLine, alignLine) {
  if (eventLine) ui.eventStatus.textContent = eventLine;
  if (navLine) ui.navStatus.textContent = navLine;
  if (alignLine) ui.alignmentStatus.textContent = alignLine;
}

function refreshPlayControls() {
  const hasTracks = window.PlayerMusicLibrary.getTrackCount() > 0;
  ui.playButton.disabled = !hasTracks || isPlaying;
  ui.pauseButton.disabled = !isPlaying;
}

function updateBleUi(connected) {
  if (!ui.bleStatus || !ui.bleButton) return;

  ui.bleStatus.classList.remove("connected", "disconnected");
  if (connected) {
    ui.bleStatus.textContent = "Bouton: connecte — pret";
    ui.bleStatus.classList.add("connected");
    ui.bleButton.textContent = "Deconnecter le bouton";
  } else {
    ui.bleStatus.textContent = "Bouton: deconnecte — appuyez pour connecter";
    ui.bleStatus.classList.add("disconnected");
    ui.bleButton.textContent = "Connecter le bouton";
  }
}

async function handleBleButtonClick() {
  if (window.NomadBLE.isConnected()) {
    window.NomadBLE.disconnect();
    updateBleUi(false);
    return;
  }

  updateBleUi(false);
  ui.bleStatus.textContent = "Bouton: connexion en cours...";

  const ok = await window.NomadBLE.connect();
  updateBleUi(ok);
  if (ok) {
    await window.PlayerCompass.start();
  }
  if (!ok) {
    ui.bleStatus.textContent = "Bouton: echec — reessayez";
    ui.bleStatus.classList.add("disconnected");
  }
}

async function connectCalendarViaBackend() {
  const backend = window.PlayerCalendarBackend;
  if (!backend.getBackendUrl()) {
    setStatus(
      "Bluefy bloque Google. Configurez CALENDAR_BACKEND_URL et deployez server/server.js.",
      null,
      null,
    );
    return;
  }

  if (await backend.checkStatus()) {
    calendarConnected = true;
    ui.connectCalendarButton.textContent = "Google Calendar connecte";
    setStatus("Prochain evenement: pret", null, null);
    return;
  }

  const link = backend.getAuthLink();
  const copied = await backend.copyAuthLink();
  setStatus(
    copied
      ? "Lien copie. Ouvrez Safari, collez le lien, connectez Google, puis revenez ici et appuyez a nouveau."
      : `Ouvrez ce lien dans Safari:\n${link}`,
    null,
    null,
  );
}

async function connectCalendar() {
  if (window.PlayerCalendarBackend?.isRequired?.()) {
    return connectCalendarViaBackend();
  }

  if (!window.GCAL_CONFIG?.CLIENT_ID || !window.GCAL_CONFIG?.API_KEY) {
    setStatus(
      "Config manquante (config.local.js). Verifiez le deploiement GitHub Pages.",
      null,
      null,
    );
    return;
  }
  if (window.PlayerCalendarAuth.isAuthenticated?.()) {
    calendarConnected = true;
    ui.connectCalendarButton.textContent = "Google Calendar connecte";
    setStatus("Prochain evenement: pret", null, null);
    return;
  }
  if (!window.PlayerCalendarAuth.isReady()) {
    setStatus("Google Calendar: initialisation...", null, null);
    return;
  }
  try {
    if (window.PlayerCalendarAuth.usesRedirectOAuth?.()) {
      setStatus("Redirection vers Google...", null, null);
    }
    await window.PlayerCalendarAuth.requestAccess();
    calendarConnected = true;
    ui.connectCalendarButton.textContent = "Google Calendar connecte";
    setStatus("Prochain evenement: pret", null, null);
  } catch (error) {
    setStatus(`Calendar: ${error.message}`, null, null);
  }
}

function onCalendarAuthenticated() {
  calendarConnected = true;
  ui.connectCalendarButton.textContent = "Google Calendar connecte";
  if (sessionStorage.getItem("nomad_calendar_auth_pending")) {
    sessionStorage.removeItem("nomad_calendar_auth_pending");
    setStatus("Prochain evenement: pret", null, null);
  }
}

async function resolveDestinationFromCalendar() {
  if (!calendarConnected) {
    await connectCalendar();
  }
  if (!calendarConnected) return null;

  const event =
    await window.PlayerCalendarNextEvent.fetchNextEventWithLocation();
  if (!event) {
    setStatus(
      "Aucun evenement avec lieu trouve",
      "Navigation: musique centree",
      null,
    );
    return null;
  }

  setStatus(
    `${event.displayLine}\nLieu: ${event.location}`,
    "Navigation: calcul de l'itineraire...",
    null,
  );

  const geo = await window.resolveAddressWithGoogleMaps(event.location);
  return {
    latitude: geo.latitude,
    longitude: geo.longitude,
    label: event.summary,
    address: event.location,
    eventTime: event.timeLabel,
  };
}

async function togglePlayback() {
  if (isPlaying) {
    stopPlaybackSession();
    return;
  }
  await startPlaybackSession();
}

async function startPlaybackSession() {
  if (window.PlayerMusicLibrary.getTrackCount() === 0) return;

  const compass = await window.PlayerCompass.start();

  const track = window.PlayerMusicLibrary.pickRandomTrack();
  const source = window.PlayerMusicLibrary.getTrackSource(track);
  if (!source) return;

  showSelectedTrack(track);
  window.PlayerMusicLibrary.renderLibraryList(ui.libraryList);

  window.initSpatialAudio();
  window.setSpatialAudioSource(source);
  await window.startSpatialMusic();

  isPlaying = true;
  refreshPlayControls();

  try {
    const destination = await resolveDestinationFromCalendar();
    if (destination) {
      await window.PlayerNavigationEngine.start(destination);
      const alignLine = compass.ok
        ? "Alignement: en cours..."
        : "Boussole: autorisez le capteur (appuyez Play a l'ecran)";
      setStatus(
        `${destination.eventTime} — ${destination.label}\nLieu: ${destination.address}`,
        `Navigation: vers ${destination.label}`,
        alignLine,
      );
    } else {
      window.PlayerSpatialNav.start();
    }
  } catch (error) {
    setStatus(null, `Navigation: ${error.message}`, "Musique centree");
    window.PlayerSpatialNav.start();
  }
}

function stopPlaybackSession() {
  window.stopDirectionalTone();
  window.PlayerNavigationEngine.stop();
  isPlaying = false;
  refreshPlayControls();
  const track = window.PlayerMusicLibrary.getSelectedTrack();
  ui.trackArtist.textContent = track?.artist || "Collection Nomad";
  setStatus(null, "Navigation: inactive", "Alignement: —");
}

function showSelectedTrack(track) {
  if (!track) return;
  ui.trackTitle.textContent = track.name;
  ui.trackArtist.textContent = track.artist || "Collection Nomad";
  refreshPlayControls();
}

function initBundledMusic() {
  const catalog = window.NOMAD_BUNDLED_MUSIC;
  if (!catalog?.length) return;

  window.PlayerMusicLibrary.loadBundledCatalog(catalog);
  window.PlayerMusicLibrary.renderLibraryList(ui.libraryList);
  refreshPlayControls();
}

function onLibraryInputChange(event) {
  window.PlayerMusicLibrary.addFiles(event.target.files);
  window.PlayerMusicLibrary.renderLibraryList(ui.libraryList);
  if (window.PlayerMusicLibrary.getTrackCount() === 1) {
    showSelectedTrack(window.PlayerMusicLibrary.selectTrack(0));
  }
}

function initPlayerApp() {
  bindUi();

  ui.libraryInput.addEventListener("change", onLibraryInputChange);
  ui.connectCalendarButton.addEventListener("click", connectCalendar);
  ui.playButton.addEventListener("click", startPlaybackSession);
  ui.pauseButton.addEventListener("click", stopPlaybackSession);

  window.addEventListener("player-track-selected", (event) => {
    if (!isPlaying) showSelectedTrack(event.detail);
    window.PlayerMusicLibrary.renderLibraryList(ui.libraryList);
  });

  initBundledMusic();

  window.addEventListener("player-nav-update", (event) => {
    const { navLine, alignLine } = event.detail;
    setStatus(null, navLine, alignLine);
  });

  window.addEventListener("player-nav-error", (event) => {
    setStatus(null, `Navigation: ${event.detail}`, null);
  });

  window.addEventListener("player-calendar-ready", () => {
    ui.connectCalendarButton.disabled = false;
    if (window.PlayerCalendarAuth.isAuthenticated?.()) {
      onCalendarAuthenticated();
      return;
    }
    if (window.PlayerCalendarAuth.isReady()) {
      setStatus("Prochain evenement: connectez Google Calendar", null, null);
    }
  });

  window.addEventListener("player-calendar-authenticated", onCalendarAuthenticated);

  window.setTimeout(async () => {
    if (window.PlayerCalendarBackend?.isRequired?.()) {
      if (await window.PlayerCalendarBackend.checkStatus()) {
        onCalendarAuthenticated();
        return;
      }
      setStatus(
        "Bluefy: appuyez sur Connecter Calendar, ouvrez le lien dans Safari, puis reverifiez.",
        null,
        null,
      );
      return;
    }
    if (!window.PlayerCalendarAuth.isReady()) {
      setStatus(
        window.PlayerCalendarAuth.getInitErrorMessage?.() ||
          "Google Calendar: echec d'initialisation.",
        null,
        null,
      );
    }
  }, 8000);

  const bleButton = ui.bleButton;
  if (bleButton) {
    window.NomadBLE.onButtonPress = () => {
      togglePlayback();
    };
    if (!window.NomadBLE.isSupported()) {
      const hint = window.NomadBLE.getUnsupportedHint();
      bleButton.title = hint || "";
      bleButton.addEventListener("click", () => {
        if (ui.bleStatus) ui.bleStatus.textContent = hint;
      });
    } else {
      bleButton.addEventListener("click", handleBleButtonClick);
      window.addEventListener("nomad-ble-state", (event) => {
        updateBleUi(event.detail.connected);
      });
      updateBleUi(window.NomadBLE.isConnected());
    }
  }

  refreshPlayControls();
  setStatus("Prochain evenement: connectez Google Calendar", null, null);
}

window.PlayerApp = {
  togglePlayback,
  isPlaying: () => isPlaying,
};

document.addEventListener("DOMContentLoaded", initPlayerApp);
