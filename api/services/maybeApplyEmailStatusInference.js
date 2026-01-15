/**
 * Temporary compatibility shim.
 * Some versions of routes/ingestEmail.js require this module.
 *
 * We return a no-op result to keep the API booting cleanly.
 * Later we can wire this to the real status inference function
 * without changing ingestEmail.js again.
 */
async function maybeApplyEmailStatusInference() {
  return {
    ok: true,
    applied: false,
    reason: "shim_noop",
  };
}

module.exports = {
  maybeApplyEmailStatusInference,
};
