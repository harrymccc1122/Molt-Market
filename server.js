const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'bets.sqlite');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creatorAgent TEXT NOT NULL,
    event TEXT NOT NULL,
    wagerAmount REAL NOT NULL,
    odds REAL NOT NULL,
    endsAt TEXT NOT NULL,
    sideTakenBy TEXT,
    status TEXT NOT NULL,
    winner TEXT
  );
`);

const betColumns = [
  'id',
  'creatorAgent',
  'event',
  'wagerAmount',
  'odds',
  'endsAt',
  'sideTakenBy',
  'status',
  'winner'
];

const pickBet = (row) => {
  if (!row) return null;
  return betColumns.reduce((acc, key) => {
    acc[key] = row[key];
    return acc;
  }, {});
};

app.post('/api/bets', (req, res) => {
  const { creatorAgent, event, wagerAmount, odds, endsAt } = req.body;
  if (!creatorAgent || !event || wagerAmount == null || odds == null || !endsAt) {
    return res.status(400).json({
      error: 'creatorAgent, event, wagerAmount, odds, and endsAt are required'
    });
  }

  const insert = db.prepare(`
    INSERT INTO bets (creatorAgent, event, wagerAmount, odds, endsAt, sideTakenBy, status, winner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(
    creatorAgent,
    event,
    wagerAmount,
    odds,
    endsAt,
    null,
    'open',
    null
  );
  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(pickBet(row));
});

app.get('/api/bets', (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM bets WHERE status IN ('open', 'active') ORDER BY endsAt ASC")
    .all();
  return res.json(rows.map(pickBet));
});

app.post('/api/bets/:id/take', (req, res) => {
  const { sideTakenBy } = req.body;
  if (!sideTakenBy) {
    return res.status(400).json({ error: 'sideTakenBy is required' });
  }

  const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }
  if (bet.status !== 'open' || bet.sideTakenBy) {
    return res.status(409).json({ error: 'Bet cannot be taken' });
  }

  db.prepare('UPDATE bets SET sideTakenBy = ?, status = ? WHERE id = ?')
    .run(sideTakenBy, 'active', req.params.id);

  const updated = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  return res.json(pickBet(updated));
});

app.post('/api/bets/:id/settle', (req, res) => {
  const { winner } = req.body;
  if (!winner) {
    return res.status(400).json({ error: 'winner is required' });
  }

  const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }
  if (bet.status !== 'active') {
    return res.status(409).json({ error: 'Bet cannot be settled' });
  }

  db.prepare('UPDATE bets SET winner = ?, status = ? WHERE id = ?')
    .run(winner, 'settled', req.params.id);

  const updated = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  return res.json(pickBet(updated));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bet service listening on ${port}`);
});
