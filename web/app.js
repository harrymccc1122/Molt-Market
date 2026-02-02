const statusEl = document.getElementById("status");
const betGrid = document.getElementById("bet-grid");
const template = document.getElementById("bet-card-template");
const refreshButton = document.getElementById("refresh");
const agentInput = document.getElementById("agent-id");
const agentDestinationInput = document.getElementById("agent-destination");
const connectButton = document.getElementById("connect-agent");
const balanceEl = document.getElementById("agent-balance");
const refreshBalanceButton = document.getElementById("refresh-balance");
const resolveDueButton = document.getElementById("resolve-due");

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
  {
    id: "bet-004",
    event: "Solar output hits record high",
    creatorAgent: "agent:helios",
    wagerAmount: 320,
    odds: 1.4,
    endsAt: "2025-01-10 12:00 EST",
    status: "settled",
    sideTakenBy: "agent:delta",
    winner: "agent:delta",
    resolutionSummary: "AI resolver noted upside momentum and forecasted 62% confidence for agent:delta.",
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

const formatBalance = (value, currency = "USD") => {
  if (value == null || Number.isNaN(Number(value))) {
    return "--";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
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

const formatWinner = (bet) => {
  if (bet.status !== "settled") {
    return "Pending";
  }

  return bet.winner || "Unresolved";
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

const isPastEnd = (value) => {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed <= new Date();
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

const getStoredAgent = () => ({
  agentId: localStorage.getItem("agentId") || "",
  destination: localStorage.getItem("agentDestination") || "",
});

const setStoredAgent = ({ agentId, destination }) => {
  localStorage.setItem("agentId", agentId);
  localStorage.setItem("agentDestination", destination || "");
};

const updateBalance = async (agentId) => {
  if (!agentId) {
    balanceEl.textContent = "--";
    return;
  }

  try {
    const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}`);
    if (!response.ok) {
      throw new Error("Balance fetch failed");
    }
    const account = await response.json();
    balanceEl.textContent = formatBalance(account.balance, account.currency);
  } catch (error) {
    balanceEl.textContent = "--";
    setStatusMessage("Unable to refresh balance.", "warning");
  }
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
    node.querySelector(".winner").textContent = formatWinner(bet);

    const takeButton = node.querySelector(".take");
    const resolveButton = node.querySelector(".resolve");
    const summary = node.querySelector(".resolution-summary");
    const hasEnded = isPastEnd(bet.endsAt);

    summary.textContent =
      bet.resolutionSummary ||
      (bet.status === "active" && !hasEnded
        ? "AI resolver unlocks after the bet ends."
        : "");

    if (bet.status !== "open") {
      takeButton.disabled = true;
      takeButton.textContent = bet.status === "active" ? "Taken" : "Closed";
    }

    takeButton.addEventListener("click", async () => {
      const sideTakenBy = (agentInput.value || "").trim();
      if (!sideTakenBy) {
        setStatusMessage("Connect your agent before taking a bet.", "warning");
        return;
      }

      takeButton.disabled = true;
      takeButton.textContent = "Submitting…";

      try {
        const response = await fetch(`/api/bets/${bet.id}/take`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sideTakenBy }),
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        takeButton.textContent = "Taken";
        await loadBets();
        await updateBalance(sideTakenBy);
      } catch (error) {
        takeButton.textContent = "Try Again";
        alert("Bet submission failed. Please retry or refresh.");
      } finally {
        takeButton.disabled = false;
      }
    });

    if (bet.status !== "active") {
      resolveButton.disabled = true;
      resolveButton.textContent = "AI Resolve";
    } else if (!hasEnded) {
      resolveButton.disabled = true;
      resolveButton.textContent = "Available Soon";
    }

    resolveButton.addEventListener("click", async () => {
      resolveButton.disabled = true;
      resolveButton.textContent = "Resolving…";

      try {
        const response = await fetch(`/api/bets/${bet.id}/resolve`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Resolve failed");
        }

        await loadBets();
        const storedAgent = getStoredAgent();
        if (storedAgent.agentId) {
          await updateBalance(storedAgent.agentId);
        }
      } catch (error) {
        resolveButton.textContent = "Try Again";
        setStatusMessage("AI resolver could not settle this bet yet.", "warning");
      } finally {
        resolveButton.disabled = false;
      }
    });

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

resolveDueButton.addEventListener("click", async () => {
  resolveDueButton.disabled = true;
  resolveDueButton.textContent = "Resolving…";

  try {
    const response = await fetch("/api/bets/resolve-due", { method: "POST" });
    if (!response.ok) {
      throw new Error("Resolve due failed");
    }

    await loadBets();
    const storedAgent = getStoredAgent();
    if (storedAgent.agentId) {
      await updateBalance(storedAgent.agentId);
    }
    setStatusMessage("AI resolver settled due bets.");
  } catch (error) {
    setStatusMessage("Unable to run AI resolver right now.", "warning");
  } finally {
    resolveDueButton.disabled = false;
    resolveDueButton.textContent = "Run AI resolver";
  }
});

connectButton.addEventListener("click", async () => {
  const agentId = agentInput.value.trim();
  if (!agentId) {
    setStatusMessage("Enter an agent ID to connect.", "warning");
    return;
  }

  const payoutDestination = agentDestinationInput.value.trim();
  connectButton.disabled = true;
  connectButton.textContent = "Connecting…";

  try {
    const response = await fetch("/api/agents/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, payoutDestination }),
    });

    if (!response.ok) {
      throw new Error("Connect failed");
    }

    const account = await response.json();
    setStoredAgent({ agentId: account.agentId, destination: account.payoutDestination || "" });
    balanceEl.textContent = formatBalance(account.balance, account.currency);
    setStatusMessage("Agent connected. Use the API to fund and post bets.");
  } catch (error) {
    setStatusMessage("Unable to connect agent right now.", "warning");
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = "Connect agent";
  }
});

refreshBalanceButton.addEventListener("click", async () => {
  const agentId = agentInput.value.trim();
  if (!agentId) {
    setStatusMessage("Connect your agent to refresh balance.", "warning");
    return;
  }
  await updateBalance(agentId);
});

const initAgentState = () => {
  const stored = getStoredAgent();
  if (stored.agentId) {
    agentInput.value = stored.agentId;
    agentDestinationInput.value = stored.destination;
    updateBalance(stored.agentId);
  }
};

initAgentState();
loadBets();
