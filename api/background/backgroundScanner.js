// api/background/backgroundScanner.js
const db = require("../db");
const {
  tryAcquireApplicationLease,
  releaseApplicationLease,
} = require("../services/scanLease");
const { scanJobApplication } = require("../services/scanJobApplication");

function createLimiter(maxConcurrent) {
  let active = 0;
  const queue = [];

  const runNext = () => {
    if (active >= maxConcurrent) return;
    const next = queue.shift();
    if (!next) return;

    active++;
    next()
      .catch(() => {})
      .finally(() => {
        active--;
        runNext();
      });
  };

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          const out = await fn();
          resolve(out);
        } catch (e) {
          reject(e);
        }
      });
      runNext();
    });
  };
}

function nowIso() {
  return new Date().toISOString();
}

function selectDueApplicationIds(limit) {
  const now = nowIso();
  return db
    .prepare(
      `
      SELECT id
      FROM applications
      WHERE next_scan_at IS NOT NULL
        AND next_scan_at <= ?
        AND (scan_locked_until IS NULL OR scan_locked_until < ?)
      ORDER BY next_scan_at ASC
      LIMIT ?
    `
    )
    .all(now, now, limit)
    .map((r) => r.id);
}

function startBackgroundScanner({
  tickMs = 60_000,
  batchSize = 5,
  concurrency = 2,
  enabled = false,
} = {}) {
  if (!enabled) {
    console.log("[bg-scan] disabled (set ENABLE_BACKGROUND_SCANS=true)");
    return () => {};
  }

  console.log(
    `[bg-scan] enabled tick=${tickMs}ms batch=${batchSize} concurrency=${concurrency}`
  );

  const inFlight = new Set();
  const limit = createLimiter(concurrency);
  const LEASE_TTL_MS = Number(process.env.SCAN_LEASE_TTL_MS || 120000);

  const tick = async () => {
    try {
      const dueIds = selectDueApplicationIds(batchSize).filter(
        (id) => !inFlight.has(id)
      );

      if (!dueIds.length) return;

      for (const id of dueIds) {
        inFlight.add(id);

        limit(async () => {
          const lease = tryAcquireApplicationLease({
            applicationId: id,
            ttlMs: LEASE_TTL_MS,
          });

          if (!lease.ok) {
            inFlight.delete(id);
            return;
          }

          try {
            const app = db
              .prepare(`SELECT user_id FROM applications WHERE id = ?`)
              .get(id);

            if (!app?.user_id) {
              console.log(`[bg-scan] missing user_id app=${id}`);
              return;
            }

            const result = await scanJobApplication({
              applicationId: id,
              userId: app.user_id,
              source: "background",
            });

            if (result?.alertKind) {
              console.log(
                `[bg-scan] alert=${result.alertKind} app=${id} status=${result.status}`
              );
            } else {
              console.log(`[bg-scan] no-change app=${id} status=${result?.status}`);
            }
          } catch (err) {
            console.log(
              `[bg-scan] error app=${id} ${err?.message || "scan failed"}`
            );
          } finally {
            releaseApplicationLease({ applicationId: id, token: lease.token });
            inFlight.delete(id);
          }
        });
      }
    } catch (err) {
      console.log(`[bg-scan] tick error ${err?.message || "unknown"}`);
    }
  };

  const handle = setInterval(tick, tickMs);
  tick(); // run once at start

  return () => clearInterval(handle);
}

module.exports = { startBackgroundScanner };
