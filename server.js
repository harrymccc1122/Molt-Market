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
    winner TEXT,
    resolutionSummary TEXT
  );
`);

const ensureColumn = (table, column, type) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
};

ensureColumn('bets', 'resolutionSummary', 'TEXT');

const betColumns = [
  'id',
  'creatorAgent',
  'event',
  'wagerAmount',
  'odds',
  'endsAt',
  'sideTakenBy',
  'status',
  'winner',
  'resolutionSummary'
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
    INSERT INTO bets (creatorAgent, event, wagerAmount, odds, endsAt, sideTakenBy, status, winner, resolutionSummary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(
    creatorAgent,
    event,
    wagerAmount,
    odds,
    endsAt,
    null,
    'open',
    null,
    null
  );
  const row = db.prepare('SELECT * FROM bets WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(pickBet(row));
});

app.get('/api/bets', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT * FROM bets
      ORDER BY
        CASE status
          WHEN 'open' THEN 0
          WHEN 'active' THEN 1
          ELSE 2
        END,
        endsAt ASC
    `)
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

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const resolveBetWithAi = (bet) => {
  const signals = [];
  let sentiment = 0;
  const eventText = bet.event.toLowerCase();

  if (/above|higher|rise|increase|growth|bull/.test(eventText)) {
    sentiment += 0.1;
    signals.push('upside momentum');
  }
  if (/below|lower|drop|decrease|decline|bear/.test(eventText)) {
    sentiment -= 0.1;
    signals.push('downside pressure');
  }

  const stakeSignal = Math.min(0.15, Number(bet.wagerAmount) / 2000);
  if (stakeSignal > 0.02) {
    sentiment += stakeSignal;
    signals.push('high-stake confidence');
  }

  const seed = hashString(
    `${bet.event}|${bet.endsAt}|${bet.wagerAmount}|${bet.odds}|${bet.creatorAgent}`
  );
  const base = (seed % 1000) / 1000;
  const probabilityCreator = Math.min(0.9, Math.max(0.1, 0.5 + sentiment + (base - 0.5) * 0.2));
  const winner = base < probabilityCreator ? bet.creatorAgent : bet.sideTakenBy;
  const confidence = Math.round(probabilityCreator * 100);
  const summary =
    signals.length > 0
      ? `AI resolver noted ${signals.join(', ')} and forecasted ${confidence}% confidence for ${winner}.`
      : `AI resolver forecasted ${confidence}% confidence for ${winner}.`;

  return { winner, summary };
};

app.post('/api/bets/:id/resolve', (req, res) => {
  const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }
  if (bet.status !== 'active') {
    return res.status(409).json({ error: 'Bet must be active before resolution' });
  }
  if (!bet.sideTakenBy) {
    return res.status(409).json({ error: 'Bet must be taken before resolution' });
  }

  const endsAt = new Date(bet.endsAt);
  if (Number.isNaN(endsAt.getTime())) {
    return res.status(400).json({ error: 'Bet has invalid end date' });
  }
  if (endsAt > new Date()) {
    return res.status(409).json({ error: 'Bet cannot be resolved before end time' });
  }

  const { winner, summary } = resolveBetWithAi(bet);
  db.prepare('UPDATE bets SET winner = ?, status = ?, resolutionSummary = ? WHERE id = ?').run(
    winner,
    'settled',
    summary,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
  return res.json(pickBet(updated));
});

app.post('/api/bets/resolve-due', (_req, res) => {
  const nowIso = new Date().toISOString();
  const dueBets = db
    .prepare("SELECT * FROM bets WHERE status = 'active' AND endsAt <= ?")
    .all(nowIso);

  const resolved = dueBets.map((bet) => {
    if (!bet.sideTakenBy) {
      return pickBet(bet);
    }
    const { winner, summary } = resolveBetWithAi(bet);
    db.prepare('UPDATE bets SET winner = ?, status = ?, resolutionSummary = ? WHERE id = ?').run(
      winner,
      'settled',
      summary,
      bet.id
    );
    const updated = db.prepare('SELECT * FROM bets WHERE id = ?').get(bet.id);
    return pickBet(updated);
  });

  return res.json({ resolved });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bet service listening on ${port}`);
});
