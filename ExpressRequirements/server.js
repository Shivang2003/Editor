// 📦 Express + local JSON DB to store Delta + Required Mentions
const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 5000;
const DATA_FILE = './delta-data.json';

app.use(cors());
app.use(express.json());

// Default structure
let db = {
  delta: { ops: [] },
  requiredMentions: {
    "@": [],
    "#": []
  }
};

// Load existing DB if file exists
if (fs.existsSync(DATA_FILE)) {
  const fileContent = fs.readFileSync(DATA_FILE);
  try {
    db = JSON.parse(fileContent);
  } catch (err) {
    console.error('❌ Error parsing JSON file:', err);
  }
}

/* --------------------- DELTA APIs --------------------- */

// ✅ GET saved Delta
app.get('/api/get-notes', (req, res) => {
  res.json({ delta: db.delta });
});

// ✅ POST new Delta
app.post('/api/save-notes', (req, res) => {
  const { delta } = req.body;

  if (!delta || !Array.isArray(delta.ops)) {
    return res.status(400).json({
      error: 'Invalid delta format. Must be an object with an "ops" array',
    });
  }

  db.delta = delta;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error saving Delta:', err);
    res.status(500).json({ error: 'Failed to save delta' });
  }
});

/* --------------------- REQUIRED MENTIONS APIs --------------------- */

// ✅ GET all required mentions
app.get('/api/get-required-mentions', (req, res) => {
  res.json(db.requiredMentions);
});

// ✅ POST required mentions
app.post('/api/save-required-mentions', (req, res) => {
  const { requiredMentions } = req.body;

  if (
    !requiredMentions ||
    !Array.isArray(requiredMentions['@']) ||
    !Array.isArray(requiredMentions['#'])
  ) {
    return res.status(400).json({
      error: 'Invalid format. Must contain "@" (users) and "#" (tickets) arrays',
    });
  }

  db.requiredMentions = requiredMentions;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error saving requiredMentions:', err);
    res.status(500).json({ error: 'Failed to save requiredMentions' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
