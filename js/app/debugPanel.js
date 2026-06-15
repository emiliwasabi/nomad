const state = {
  visible: false,
  lastRenderMs: 0,
};

function isEnabled() {
  return (
    state.visible ||
    new URLSearchParams(window.location.search).has("debug") ||
    localStorage.getItem("nomad_debug") === "1"
  );
}

function line(label, value, warn = false) {
  const cls = warn ? "debug-warn" : "";
  return `<div class="debug-line ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
}

function fmtNum(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(digits);
}

function fmtAge(ms) {
  if (!ms) return "jamais";
  const delta = Date.now() - ms;
  if (delta < 1000) return `${delta} ms`;
  return `${(delta / 1000).toFixed(1)} s`;
}

function collectSnapshot() {
  const compass = window.PlayerCompass?.getDebugState?.() || {};
  const audio = window.getSpatialAudioDebugState?.() || {};
  const spatial = window.PlayerSpatialNav?.getDebugState?.() || {};
  const nav = window.PlayerNavigationEngine?.getDebugState?.() || {};
  const isBluefy = /Bluefy/i.test(navigator.userAgent);

  return { compass, audio, spatial, nav, isBluefy };
}

function diagnose(snapshot) {
  const { compass, audio, spatial, nav } = snapshot;
  const issues = [];

  if (!compass.compassActive) {
    issues.push("Boussole inactive — appuyez Play a l'ecran");
  }
  if (compass.permissionNeedsPrompt && !compass.permissionGranted) {
    issues.push("Permission orientation non accordee");
  }
  if (compass.compassActive && compass.eventCount === 0) {
    issues.push("Aucun evenement orientation recu (Bluefy/iOS ?)");
  }
  if (compass.eventCount > 0 && compass.headingDelta < 2) {
    issues.push("Cap quasi fixe — tournez le telephone et regardez si delta cap monte");
  }
  if (nav.active && nav.headingUpdateCount === 0 && compass.eventCount > 5) {
    issues.push("Boussole OK mais pas de recalcul audio (GPS manquant ?)");
  }
  if (spatial.updateCount > 0 && audio.pannerX === null) {
    issues.push("Panner audio absent — spatialisation impossible");
  }
  if (!audio.audioCtxRunning) {
    issues.push("AudioContext suspendu");
  }

  return issues;
}

function renderPanel() {
  const panel = document.getElementById("debug_panel");
  if (!panel || !isEnabled()) return;

  const snap = collectSnapshot();
  const issues = diagnose(snap);
  const { compass, audio, spatial, nav, isBluefy } = snap;

  panel.innerHTML = `
    <div class="debug-header">
      <strong>Debug spatial</strong>
      <button type="button" id="debug_hide_button" class="btn btn-ghost debug-hide">Masquer</button>
    </div>
    ${issues.length ? `<div class="debug-issues">${issues.map((i) => `<p>⚠ ${i}</p>`).join("")}</div>` : `<p class="debug-ok">Aucune anomalie evidente — tournez le telephone et observez les valeurs.</p>`}
    ${line("Navigateur", isBluefy ? "Bluefy" : navigator.userAgent.slice(0, 40))}
    ${line("Permission orientation", compass.permissionLabel || "—", !compass.permissionGranted)}
    ${line("Boussole active", compass.compassActive ? "oui" : "non", !compass.compassActive)}
    ${line("Events orientation", String(compass.eventCount || 0), compass.eventCount === 0)}
    ${line("Dernier event", fmtAge(compass.lastEventMs))}
    ${line("webkitCompassHeading", fmtNum(compass.rawWebkit))}
    ${line("alpha", fmtNum(compass.rawAlpha))}
    ${line("absolute", compass.rawAbsolute ? "oui" : "non")}
    ${line("Cap calcule", `${fmtNum(compass.headingDeg, 0)}°`)}
    ${line("Delta cap (mouvement)", `${fmtNum(compass.headingDelta, 1)}°`, compass.headingDelta < 2)}
    ${line("Nav active", nav.active ? "oui" : "non")}
    ${line("Bearing relatif", `${fmtNum(nav.lastRelativeDeg, 0)}°`)}
    ${line("Maj audio (bearing)", String(spatial.updateCount || 0))}
    ${line("Panner X / Z", `${fmtNum(audio.pannerX, 2)} / ${fmtNum(audio.pannerZ, 2)}`)}
    ${line("AudioContext", audio.audioCtxState || "—", audio.audioCtxState !== "running")}
    ${line("Maj cap → son", String(nav.headingUpdateCount || 0))}
    ${line("Dernier GPS", fmtAge(nav.lastGpsMs))}
    <div class="debug-actions">
      <button type="button" id="debug_orbit_button" class="btn">Test rotation son (5s)</button>
      <button type="button" id="debug_compass_button" class="btn">Re-demander boussole</button>
    </div>
  `;

  document.getElementById("debug_hide_button")?.addEventListener("click", () => {
    state.visible = false;
    localStorage.removeItem("nomad_debug");
    panel.hidden = true;
  });

  document.getElementById("debug_orbit_button")?.addEventListener("click", async () => {
    window.initSpatialAudio?.();
    window.startOrbitAroundHead?.(0.08, 1.5);
    setTimeout(() => window.stopOrbitAroundHead?.(), 5000);
  });

  document.getElementById("debug_compass_button")?.addEventListener("click", async () => {
    const result = await window.PlayerCompass?.start?.();
    alert(result?.ok ? "Boussole OK" : `Echec: ${result?.reason || "inconnu"}`);
  });
}

function tick() {
  if (isEnabled()) {
    const panel = document.getElementById("debug_panel");
    if (panel) panel.hidden = false;
    const now = Date.now();
    if (now - state.lastRenderMs > 250) {
      state.lastRenderMs = now;
      renderPanel();
    }
  }
  requestAnimationFrame(tick);
}

function initDebugPanel() {
  if (new URLSearchParams(window.location.search).has("debug")) {
    state.visible = true;
    localStorage.setItem("nomad_debug", "1");
  }

  const header = document.querySelector(".header h1");
  let taps = 0;
  let tapTimer = null;
  header?.addEventListener("click", () => {
    taps += 1;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      taps = 0;
    }, 900);
    if (taps >= 3) {
      state.visible = !state.visible;
      if (state.visible) localStorage.setItem("nomad_debug", "1");
      else localStorage.removeItem("nomad_debug");
      const panel = document.getElementById("debug_panel");
      if (panel) panel.hidden = !state.visible;
      if (state.visible) renderPanel();
      taps = 0;
    }
  });

  requestAnimationFrame(tick);
}

document.addEventListener("DOMContentLoaded", initDebugPanel);

window.PlayerDebugPanel = {
  isEnabled,
  renderPanel,
};
