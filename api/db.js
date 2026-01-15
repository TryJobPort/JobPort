// api/db.js
const path = require("path");
const Database = require("better-sqlite3");

// Stores db file inside /api
const dbPath = path.join(__dirname, "jobport.sqlite");
const db = new Database(dbPath);

// Good defaults
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
