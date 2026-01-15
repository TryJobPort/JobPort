// utils/extractInterviewSignal.js
// Conservative interview signal extraction from normalized email content

module.exports = function extractInterviewSignal(email) {
  const subject = email.normalized_subject || "";
  const text = email.text_body || "";
  const combined = `${subject}\n${text}`;

  // Meeting links (first match wins)
  const zoom = combined.match(/https:\/\/[^\s]*zoom\.us\/j\/[^\s]+/i)?.[0] || null;
  const meet = combined.match(/https:\/\/meet\.google\.com\/[^\s]+/i)?.[0] || null;
  const teams = combined.match(/https:\/\/teams\.microsoft\.com\/[^\s]+/i)?.[0] || null;

  const meetingLink = zoom || meet || teams;

  // Very conservative datetime signal (expand later)
  // Examples it catches:
  // "Tuesday, March 12 at 2:30 PM"
  // "Thu Dec 19 3:00 PM"
  const timeMatch =
    combined.match(
      /\b(?:mon|tues|wednes|thurs|fri|satur|sun)?day,?\s+\w+\s+\d{1,2}.*?\d{1,2}:\d{2}\s*(am|pm)?/i
    ) ||
    combined.match(
      /\b\w+\s+\d{1,2},?\s+\d{4}.*?\d{1,2}:\d{2}\s*(am|pm)?/i
    );

  const interviewAt = timeMatch ? timeMatch[0] : null;

  return {
    hasInterview: Boolean(meetingLink || interviewAt),
    interviewAt,          // raw string for now (we normalize later)
    meetingLink,          // zoom / meet / teams
  };
};
