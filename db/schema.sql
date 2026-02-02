CREATE TABLE bets (
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
