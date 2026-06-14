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

async function fetchUpcomingEvents(limit = 20) {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 7);

  const calendars = await gapi.client.calendar.calendarList.list({
    showHidden: false,
    minAccessRole: "reader",
  });

  const selected = (calendars.result.items || []).filter(
    (calendar) => calendar.selected !== false,
  );

  const getAllEvents = await Promise.all(
    selected.map((calendar) =>
      gapi.client.calendar.events.list({
        calendarId: calendar.id,
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: limit,
      }),
    ),
  );

  const events = getAllEvents
    .flatMap((response) => response.result.items || [])
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => {
      const aStart = new Date(a.start?.dateTime || a.start?.date).getTime();
      const bStart = new Date(b.start?.dateTime || b.start?.date).getTime();
      return aStart - bStart;
    });

  return events;
}

async function fetchNextEventWithLocation() {
  if (window.PlayerCalendarBackend?.isRequired?.()) {
    return window.PlayerCalendarBackend.fetchNextEventWithLocation();
  }

  const events = await fetchUpcomingEvents();
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

window.PlayerCalendarNextEvent = {
  fetchNextEventWithLocation,
};
