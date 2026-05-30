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
}

function setStatus(eventLine, navLine, alignLine) {
  if (eventLine) ui.eventStatus.textContent = eventLine;
  if (navLine) ui.navStatus.textContent = navLine;
  if (alignLine) ui.alignmentStatus.textContent = alignLine;
}

function refreshPlayControls() {
  const hasTrack = Boolean(window.PlayerMusicLibrary.getSelectedTrack());
  ui.playButton.disabled = !hasTrack || isPlaying;
  ui.pauseButton.disabled = !isPlaying;
}

async function connectCalendar() {
  if (!window.PlayerCalendarAuth.isReady()) {
    setStatus("Google Calendar: initialisation...", null, null);
    return;
  }
  try {
    await window.PlayerCalendarAuth.requestAccess();
    calendarConnected = true;
    ui.connectCalendarButton.textContent = "Google Calendar connecte";
    setStatus("Prochain evenement: pret", null, null);
  } catch (error) {
    setStatus(`Calendar: ${error.message}`, null, null);
  }
}

async function resolveDestinationFromCalendar() {
  if (!calendarConnected) {
    await connectCalendar();
  }
  if (!calendarConnected) return null;

  const event = await window.PlayerCalendarNextEvent.fetchNextEventWithLocation();
  if (!event) {
    setStatus("Aucun evenement avec lieu trouve", "Navigation: musique centree", null);
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

async function startPlaybackSession() {
  const track = window.PlayerMusicLibrary.getSelectedTrack();
  if (!track) return;

  window.initSpatialAudio();
  window.setSpatialAudioFile(track.file);
  await window.startSpatialMusic();

  isPlaying = true;
  refreshPlayControls();
  ui.trackTitle.textContent = track.name;
  ui.trackArtist.textContent = "Lecture en cours";

  try {
    const destination = await resolveDestinationFromCalendar();
    if (destination) {
      await window.PlayerNavigationEngine.start(destination);
      setStatus(
        `${destination.eventTime} — ${destination.label}\nLieu: ${destination.address}`,
        `Navigation: vers ${destination.label}`,
        "Alignement: en cours...",
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
  ui.trackArtist.textContent = "Bibliotheque locale";
  setStatus(null, "Navigation: inactive", "Alignement: —");
}

function onLibraryInputChange(event) {
  window.PlayerMusicLibrary.addFiles(event.target.files);
  window.PlayerMusicLibrary.renderLibraryList(ui.libraryList);
  if (window.PlayerMusicLibrary.getTrackCount() === 1) {
    window.PlayerMusicLibrary.selectTrack(0);
    ui.trackTitle.textContent =
      window.PlayerMusicLibrary.getSelectedTrack().name;
    refreshPlayControls();
  }
}

function initPlayerApp() {
  bindUi();

  ui.libraryInput.addEventListener("change", onLibraryInputChange);
  ui.connectCalendarButton.addEventListener("click", connectCalendar);
  ui.playButton.addEventListener("click", startPlaybackSession);
  ui.pauseButton.addEventListener("click", stopPlaybackSession);

  window.addEventListener("player-nav-update", (event) => {
    const { navLine, alignLine } = event.detail;
    setStatus(null, navLine, alignLine);
  });

  window.addEventListener("player-nav-error", (event) => {
    setStatus(null, `Navigation: ${event.detail}`, null);
  });

  window.addEventListener("player-calendar-ready", () => {
    ui.connectCalendarButton.disabled = false;
  });

  refreshPlayControls();
  setStatus("Prochain evenement: connectez Google Calendar", null, null);
}

document.addEventListener("DOMContentLoaded", initPlayerApp);
