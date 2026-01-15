// Calendar time extraction from known providers
// Scope: Google Calendar + Outlook (cheap, deterministic)

function safeDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

function extractFromGoogleCalendar(url) {
  // Example:
  // https://calendar.google.com/calendar/u/0/r/eventedit?dates=20250115T210000Z/20250115T220000Z
  try {
    const u = new URL(url);
    const dates = u.searchParams.get("dates");
    if (!dates) return null;
    const [start] = dates.split("/");
    return safeDate(start.replace(/(\d{8}T\d{6})Z?/, "$1Z"));
  } catch {
    return null;
  }
}

function extractFromOutlook(url) {
  // Common param: startdt=2025-01-15T21:00:00Z
  try {
    const u = new URL(url);
    const start = u.searchParams.get("startdt") || u.searchParams.get("start");
    return safeDate(start);
  } catch {
    return null;
  }
}

function extractInterviewTime(url) {
  if (!url) return null;
  const host = (() => {
    try { return new URL(url).hostname; } catch { return ""; }
  })();

  if (host.includes("calendar.google.com")) {
    return extractFromGoogleCalendar(url);
    }

  if (host.includes("outlook.office.com")) {
    return extractFromOutlook(url);
  }

  if (host.includes("zoom.us")) {
    return extractFromZoom(url);
  }

  if (host.includes("teams.microsoft.com")) {
    return extractFromTeams(url);
  }

// Google Meet intentionally returns null unless calendar-backed
return null;

}

function extractFromZoom(url) {
  // Zoom sometimes encodes start time as `startTime=2025-01-15T21:00:00Z`
  try {
    const u = new URL(url);
    const start = u.searchParams.get("startTime");
    return start ? safeDate(start) : null;
  } catch {
    return null;
  }
}

function extractFromGoogleMeet(url) {
  // Meet links do NOT encode time reliably
  // Time only exists if embedded via calendar (handled in 25.8)
  return null;
}

function extractFromTeams(url) {
  // Teams meeting links sometimes include `meetingTime=`
  try {
    const u = new URL(url);
    const start = u.searchParams.get("meetingTime");
    return start ? safeDate(start) : null;
  } catch {
    return null;
  }
}
module.exports = { extractInterviewTime };
