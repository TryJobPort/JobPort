const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

function nowIso() {
  return new Date().toISOString();
}

router.post("/signup", (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).includes("@")) {
    return res.status(400).json({ ok: false, error: "Valid email required" });
  }

  let user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);

  if (!user) {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, created_at)
       VALUES (?, ?, ?)`
    ).run(id, email, nowIso());

    user = { id, email };
  }

  const sessionId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO user_sessions (id, user_id, created_at)
     VALUES (?, ?, ?)`
  ).run(sessionId, user.id, nowIso());

  res.cookie("jp_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
  });

  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  const sid = req.cookies?.jp_session;
  if (sid) {
    db.prepare("DELETE FROM user_sessions WHERE id = ?").run(sid);
  }
  res.clearCookie("jp_session");
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!req.user) return res.json({ ok: true, user: null });
  res.json({ 
    ok: true, 
    user: {
      ...req.user, 
      plan: req.user.plan || "free",
    },  
  });
});

module.exports = router;
