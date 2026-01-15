const { canCreateApplication } = require("../utils/entitlements");
const { requireUser } = require("../utils/auth");

// inside POST /applications handler
const userId = requireUser(req, res);
if (!userId) return;

if (!canCreateApplication(userId)) {
  return res.status(402).json({
    ok: false,
    code: "FREE_LIMIT_REACHED",
    error:
      "Free plan supports tracking 1 job application. Upgrade to track more.",
  });
}
