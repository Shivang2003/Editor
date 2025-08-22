// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// File where data is stored
const DATA_FILE = path.join(__dirname, "delta-data.json");

// Load existing data or create empty structure
let db = { deltas: [], requiredMentions: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (err) {
    console.error("❌ Failed to parse delta-data.json, starting fresh:", err);
  }
}

// ---------------------- DELTAS ----------------------

// Save delta (just store whatever is sent)
// Save delta (replace previous delta)
app.post("/api/save-delta", (req, res) => {
  const data = req.body; // the new delta object

  // Replace db.deltas with only the new delta
  db.deltas = [data];

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    res.json(data); // return the new delta
  } catch (err) {
    console.error("❌ Error saving delta:", err);
    res.status(500).json({ error: "Failed to save delta" });
  }
});



// Get all deltas
app.get("/api/get-deltas", (req, res) => {
  res.json(db.deltas || []);
});

// ---------------------- REQUIRED MENTIONS ----------------------

// Save requiredMentions (store as-is)
app.post("/api/save-required-mentions", (req, res) => {
  const data = req.body; // no validation
  db.requiredMentions = data;

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    res.json(data); // return the stored data
  } catch (err) {
    console.error("❌ Error saving requiredMentions:", err);
    res.status(500).json({ error: "Failed to save requiredMentions" });
  }
});

// Get requiredMentions
app.get("/api/get-required-mentions", (req, res) => {
  res.json(db.requiredMentions || {});
});

// ---------------------- START SERVER ----------------------
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
