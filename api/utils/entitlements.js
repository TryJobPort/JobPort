const db = require("../db");
const { FREE_MAX_APPLICATIONS } = require("../config");

function getUsage(userId) {
  const apps =
    db.prepare(`SELECT COUNT(1) AS c FROM applications WHERE user_id = ?`)
      .get(userId)?.c || 0;

  return { applications: Number(apps) };
}

function canCreateApplication(userId) {
  const { applications } = getUsage(userId);
  return applications < FREE_MAX_APPLICATIONS;
}

module.exports = {
  getUsage,
  canCreateApplication,
};
