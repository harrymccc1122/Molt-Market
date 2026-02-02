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
    currency TEXT NOT NULL DEFAULT 'USD',
    sideTakenBy TEXT,
    status TEXT NOT NULL,
    winner TEXT,
    resolutionSummary TEXT,
    creatorLocked REAL NOT NULL DEFAULT 0,
    takerLocked REAL NOT NULL DEFAULT 0,
    payoutTxId TEXT,
    settledAt TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_accounts (
    agentId TEXT PRIMARY KEY,
    balance REAL NOT NULL,
    currency TEXT NOT NULL,
    payoutDestination TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS fund_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agentId TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    chargeId TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS payout_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agentId TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    payoutId TEXT NOT NULL,
    betId INTEGER NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

const ensureColumn = (table, column, type) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
};

ensureColumn('bets', 'resolutionSummary', 'TEXT');
ensureColumn('bets', 'currency', "TEXT NOT NULL DEFAULT 'USD'");
ensureColumn('bets', 'creatorLocked', 'REAL NOT NULL DEFAULT 0');
ensureColumn('bets', 'takerLocked', 'REAL NOT NULL DEFAULT 0');
ensureColumn('bets', 'payoutTxId', 'TEXT');
ensureColumn('bets', 'settledAt', 'TEXT');

const betColumns = [
  'id',
  'creatorAgent',
  'event',
  'wagerAmount',
  'odds',
  'endsAt',
  'currency',
  'sideTakenBy',
  'status',
  'winner',
  'resolutionSummary',
  'creatorLocked',
  'takerLocked',
  'payoutTxId',
  'settledAt'
];

const nowIso = () => new Date().toISOString();

const generateTxId = (prefix, seed) => {
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${seed}_${Date.now()}_${random}`;
};

const getOrCreateAccount = (agentId, payoutDestination = null) => {
  const existing = db.prepare('SELECT * FROM agent_accounts WHERE agentId = ?').get(agentId);
  if (existing) {
    if (payoutDestination && existing.payoutDestination !== payoutDestination) {
      db.prepare('UPDATE agent_accounts SET payoutDestination = ?, updatedAt = ? WHERE agentId = ?')
        .run(payoutDestination, nowIso(), agentId);
      return db.prepare('SELECT * FROM agent_accounts WHERE agentId = ?').get(agentId);
    }
    return existing;
  }

  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO agent_accounts (agentId, balance, currency, payoutDestination, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(agentId, 0, 'USD', payoutDestination, timestamp, timestamp);
  return db.prepare('SELECT * FROM agent_accounts WHERE agentId = ?').get(agentId);
};

const updateBalance = (agentId, delta) => {
  db.prepare('UPDATE agent_accounts SET balance = balance + ?, updatedAt = ? WHERE agentId = ?')
    .run(delta, nowIso(), agentId);
  return db.prepare('SELECT * FROM agent_accounts WHERE agentId = ?').get(agentId);
};

const settleBetFunds = db.transaction((bet, winner, summary) => {
  if (![bet.creatorAgent, bet.sideTakenBy].includes(winner)) {
    throw new Error('Winner must be one of the bet participants');
  }

  const creatorLocked = bet.creatorLocked || bet.wagerAmount || 0;
  const takerLocked = bet.takerLocked || bet.wagerAmount || 0;
  const payoutAmount = creatorLocked + takerLocked;
  const payoutId = generateTxId('payout', bet.id);
  const settledAt = nowIso();

  getOrCreateAccount(winner);
  updateBalance(winner, payoutAmount);

  db.prepare(`
    INSERT INTO payout_events (agentId, amount, currency, payoutId, betId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(winner, payoutAmount, bet.currency, payoutId, bet.id, settledAt);

  db.prepare(`
    UPDATE bets
    SET winner = ?, status = ?, resolutionSummary = ?, payoutTxId = ?, settledAt = ?, creatorLocked = 0, takerLocked = 0
    WHERE id = ?
  `).run(winner, 'settled', summary, payoutId, settledAt, bet.id);

  return db.prepare('SELECT * FROM bets WHERE id = ?').get(bet.id);
});

const pickBet = (row) => {
  if (!row) return null;
  return betColumns.reduce((acc, key) => {
    acc[key] = row[key];
    return acc;
  }, {});
};

const pickAccount = (row) => {
  if (!row) return null;
  return {
    agentId: row.agentId,
    balance: row.balance,
    currency: row.currency,
    payoutDestination: row.payoutDestination,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

const createBetTx = db.transaction((payload) => {
  const insert = db.prepare(`
    INSERT INTO bets (
      creatorAgent, event, wagerAmount, odds, endsAt, currency, sideTakenBy,
      status, winner, resolutionSummary, creatorLocked, takerLocked, payoutTxId, settledAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  updateBalance(payload.creatorAgent, -payload.wagerAmount);

  const result = insert.run(
    payload.creatorAgent,
    payload.event,
    payload.wagerAmount,
    payload.odds,
    payload.endsAt,
    payload.currency,
    null,
    'open',
    null,
    null,
    payload.wagerAmount,
    0,
    null,
    null
  );

  return db.prepare('SELECT * FROM bets WHERE id = ?').get(result.lastInsertRowid);
});

const takeBetTx = db.transaction((betId, sideTakenBy, wagerAmount) => {
  updateBalance(sideTakenBy, -wagerAmount);
  db.prepare('UPDATE bets SET sideTakenBy = ?, status = ?, takerLocked = ? WHERE id = ?')
    .run(sideTakenBy, 'active', wagerAmount, betId);
  return db.prepare('SELECT * FROM bets WHERE id = ?').get(betId);
});

app.post('/api/agents/connect', (req, res) => {
  const { agentId, payoutDestination } = req.body;
  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' });
  }

  const account = getOrCreateAccount(agentId, payoutDestination || null);
  return res.json(pickAccount(account));
});

app.get('/api/agents/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM agent_accounts WHERE agentId = ?').get(req.params.id);
  if (!account) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  return res.json(pickAccount(account));
});

app.post('/api/agents/:id/fund', (req, res) => {
  const { amount, currency } = req.body;
  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const account = getOrCreateAccount(req.params.id);
  if (currency && currency !== account.currency) {
    return res.status(409).json({ error: 'currency does not match agent account' });
  }

  const chargeId = generateTxId('charge', req.params.id);
  db.prepare(`
    INSERT INTO fund_events (agentId, amount, currency, chargeId, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, parsedAmount, account.currency, chargeId, nowIso());

  const updated = updateBalance(req.params.id, parsedAmount);
  return res.status(201).json({
    ...pickAccount(updated),
    chargeId
  });
});

app.post('/api/bets', (req, res) => {
  const { creatorAgent, event, wagerAmount, odds, endsAt, currency } = req.body;
  if (!creatorAgent || !event || wagerAmount == null || odds == null || !endsAt) {
    return res.status(400).json({
      error: 'creatorAgent, event, wagerAmount, odds, and endsAt are required'
    });
  }

  const wagerValue = Number(wagerAmount);
  if (Number.isNaN(wagerValue) || wagerValue <= 0) {
    return res.status(400).json({ error: 'wagerAmount must be a positive number' });
  }
  const account = getOrCreateAccount(creatorAgent);
  const betCurrency = currency || account.currency || 'USD';
  if (account.currency !== betCurrency) {
    return res.status(409).json({ error: 'currency does not match agent account' });
  }
  if (account.balance < wagerValue) {
    return res.status(409).json({ error: 'insufficient funds to post bet' });
  }

  const row = createBetTx({
    creatorAgent,
    event,
    wagerAmount: wagerValue,
    odds,
    endsAt,
    currency: betCurrency
  });
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

  const takerAccount = getOrCreateAccount(sideTakenBy);
  if (takerAccount.currency !== bet.currency) {
    return res.status(409).json({ error: 'currency does not match agent account' });
  }
  if (takerAccount.balance < bet.wagerAmount) {
    return res.status(409).json({ error: 'insufficient funds to take bet' });
  }

  const updated = takeBetTx(req.params.id, sideTakenBy, bet.wagerAmount);
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

  try {
    const updated = settleBetFunds(bet, winner, 'Manual settlement.');
    return res.json(pickBet(updated));
  } catch (error) {
    return res.status(409).json({ error: error.message });
  }
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
  try {
    const updated = settleBetFunds(bet, winner, summary);
    return res.json(pickBet(updated));
  } catch (error) {
    return res.status(409).json({ error: error.message });
  }
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
    try {
      const updated = settleBetFunds(bet, winner, summary);
      return pickBet(updated);
    } catch (error) {
      return pickBet(bet);
    }
  });

  return res.json({ resolved });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bet service listening on ${port}`);
});
