const statusEl = document.getElementById("status");
const betGrid = document.getElementById("bet-grid");
const template = document.getElementById("bet-card-template");
const refreshButton = document.getElementById("refresh");

const fallbackBets = [
  {
    id: "bet-001",
    event: "NYC Marathon - Winner",
    creatorAgent: "agent:central",
    wagerAmount: 150,
    odds: 1.8,
    endsAt: "2025-03-04 09:00 EST",
    status: "open",
  },
  {
    id: "bet-002",
    event: "Champions League Final",
    creatorAgent: "agent:uefa",
    wagerAmount: 220,
    odds: 1.91,
    endsAt: "2025-06-01 15:45 EST",
    status: "open",
  },
  {
    id: "bet-003",
    event: "Molt Market Weekly Volume",
    creatorAgent: "agent:molt",
    wagerAmount: 75,
    odds: 2.5,
    endsAt: "2025-02-18 12:00 EST",
    status: "active",
    sideTakenBy: "agent:beta",
  },
];

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatWager = (value) => {
  if (value == null || Number.isNaN(Number(value))) {
    return "TBD";
  }

  return currencyFormatter.format(Number(value));
};

const formatOdds = (value) => {
  if (value == null || Number.isNaN(Number(value))) {
    return "TBD";
  }

  return `x${Number(value).toFixed(2)}`;
};

const formatStatus = (value) => {
  if (!value) {
    return "Unknown";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatEndsAt = (value) => {
  if (!value) {
    return "TBD";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSide = (bet) => {
  if (bet.sideTakenBy) {
    return `Taken by ${bet.sideTakenBy}`;
  }

  return `Take against ${bet.creatorAgent || "agent"}`;
};

const setStatusMessage = (message, type = "info") => {
  if (!message) {
    statusEl.classList.add("hidden");
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
  statusEl.dataset.type = type;
};

const renderBets = (bets) => {
  betGrid.innerHTML = "";

  if (!bets.length) {
    setStatusMessage("No bets available right now.");
    return;
  }

  setStatusMessage("");

  bets.forEach((bet) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".event").textContent = bet.event;
    node.querySelector(".side").textContent = formatSide(bet);
    node.querySelector(".odds").textContent = formatOdds(bet.odds);
    node.querySelector(".wager").textContent = formatWager(bet.wagerAmount);
    node.querySelector(".ends").textContent = formatEndsAt(bet.endsAt);
    node.querySelector(".creator").textContent = bet.creatorAgent || "Unknown";
    node.querySelector(".status-pill").textContent = formatStatus(bet.status);

    betGrid.appendChild(node);
  });
};

const loadBets = async () => {
  setStatusMessage("Loading bets…");

  try {
    const response = await fetch("/api/bets");
    if (!response.ok) {
      throw new Error("Failed to load bets");
    }

    const bets = await response.json();
    renderBets(bets);
    setStatusMessage(`Last updated ${new Date().toLocaleTimeString()}.`);
  } catch (error) {
    renderBets(fallbackBets);
    setStatusMessage("Showing example data. Start the API to see live bets.", "warning");
  }
};

refreshButton.addEventListener("click", () => {
  loadBets();
});

loadBets();
