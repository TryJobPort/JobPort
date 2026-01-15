const BASE_DELAY_MS = 60 * 1000;       // 1 minute
const MAX_DELAY_MS  = 60 * 60 * 1000;  // 1 hour

module.exports = function computeBackoffMs(failures = 0) {
  if (failures <= 0) return BASE_DELAY_MS;

  const delay = BASE_DELAY_MS * Math.pow(2, failures);
  return Math.min(delay, MAX_DELAY_MS);
};
