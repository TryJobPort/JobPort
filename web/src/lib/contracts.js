// web/src/lib/contracts.js

export const APPLICATION_STATUS = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export function getApplicationStatusLabel(status) {
  switch (status) {
    case APPLICATION_STATUS.APPLIED:
      return "Applied";
    case APPLICATION_STATUS.UNDER_REVIEW:
      return "Under Review";
    case APPLICATION_STATUS.INTERVIEW:
      return "Interview";
    case APPLICATION_STATUS.OFFER:
      return "Offer";
    case APPLICATION_STATUS.REJECTED:
      return "Rejected";
    default:
      return "Applied";
  }
}
