function startLocationTracking(options = {}) {
  const intervalMs = options.intervalMs || 5000;
  const onUpdate = options.onUpdate || ((position) => console.log(position));
  const onError =
    options.onError ||
    ((error) => console.error("Erreur de geolocalisation:", error.message));

  if (!("geolocation" in navigator)) {
    onError(new Error("La geolocalisation n'est pas supportee sur cet appareil."));
    return null;
  }

  const readPosition = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUpdate({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
          timestamp: pos.timestamp,
        });
      },
      (error) => {
        console.error(
          `[LocationTracker] Erreur geolocalisation (${error.code}): ${error.message}`,
        );
        onError(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  readPosition();
  const intervalId = setInterval(readPosition, intervalMs);

  return { intervalId };
}

function stopLocationTracking(timerId) {
  if (!timerId || typeof timerId !== "object" || !Number.isInteger(timerId.intervalId)) return;
  clearInterval(timerId.intervalId);
}

window.startLocationTracking = startLocationTracking;
window.stopLocationTracking = stopLocationTracking;
