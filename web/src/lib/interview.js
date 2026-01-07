const HIGH_CONFIDENCE_DOMAINS = [
  "calendar.google.com",
  "meet.google.com",
  "zoom.us",
  "teams.microsoft.com",
  "outlook.office.com",
  "calendly.com",
];

function confidenceFromUrl(url) {
  if (!url) return "low";
  try {
    const host = new URL(url).hostname;
    return HIGH_CONFIDENCE_DOMAINS.some((d) => host.includes(d))
      ? "high"
      : "low";
  } catch {
    return "low";
  }
}

export function getInterviewCTAs(app) {
  if (!app?.next_interview_link) return [];

  const confidence = confidenceFromUrl(app.next_interview_link);

  if (confidence === "high") {
    return [
      {
        id: "join-interview",
        label: "Join interview",
        href: app.next_interview_link,
        primary: true,
        confidence: "high",
      },
    ];
  }

  return [
    {
      id: "open-link",
      label: "Open link",
      href: app.next_interview_link,
      primary: false,
      confidence: "low",
    },
  ];
}
