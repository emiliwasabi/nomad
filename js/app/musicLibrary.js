const tracks = [];
let selectedIndex = -1;

function getTrackName(file) {
  return file.name.replace(/\.[^/.]+$/, "");
}

function renderLibraryList(listEl) {
  listEl.innerHTML = "";
  tracks.forEach((track, index) => {
    const item = document.createElement("li");
    item.textContent = track.name;
    if (index === selectedIndex) item.classList.add("active");
    item.addEventListener("click", () => selectTrack(index));
    listEl.appendChild(item);
  });
}

function addFiles(fileList) {
  Array.from(fileList || []).forEach((file) => {
    if (!file.type.startsWith("audio/")) return;
    tracks.push({ file, name: getTrackName(file) });
  });
  return tracks.length;
}

function selectTrack(index) {
  if (index < 0 || index >= tracks.length) return null;
  selectedIndex = index;
  return tracks[index];
}

function getSelectedTrack() {
  if (selectedIndex < 0) return null;
  return tracks[selectedIndex];
}

window.PlayerMusicLibrary = {
  addFiles,
  selectTrack,
  getSelectedTrack,
  renderLibraryList,
  getTrackCount: () => tracks.length,
};
