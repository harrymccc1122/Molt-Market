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

const renderBets = (bets) => {
  betGrid.innerHTML = "";

  if (!bets.length) {
    statusEl.textContent = "No bets available right now.";
    statusEl.classList.remove("hidden");
    return;
  }

  statusEl.classList.add("hidden");

  bets.forEach((bet) => {
    const node = template.content.cloneNode(true);
    node.querySelector(".event").textContent = bet.event;
    node.querySelector(".side").textContent = formatSide(bet);
    node.querySelector(".odds").textContent = formatOdds(bet.odds);
    node.querySelector(".wager").textContent = formatWager(bet.wagerAmount);
    node.querySelector(".ends").textContent = formatEndsAt(bet.endsAt);

    const cta = node.querySelector(".cta");
    if (bet.status !== "open") {
      cta.disabled = true;
      cta.textContent = bet.status === "active" ? "Taken" : "Closed";
    }
    cta.addEventListener("click", async () => {
      const sideTakenBy = window.prompt("Enter your agent ID to take this bet:");
      if (!sideTakenBy) {
        return;
      }

      cta.disabled = true;
      cta.textContent = "Submitting…";

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

        cta.textContent = "Taken";
      } catch (error) {
        cta.textContent = "Try Again";
        alert("Bet submission failed. Please retry or refresh.");
      } finally {
        cta.disabled = false;
      }
    });

    betGrid.appendChild(node);
  });
};

const loadBets = async () => {
  statusEl.textContent = "Loading bets…";
  statusEl.classList.remove("hidden");

  try {
    const response = await fetch("/api/bets");
    if (!response.ok) {
      throw new Error("Failed to load bets");
    }

    const bets = await response.json();
    renderBets(bets);
  } catch (error) {
    renderBets(fallbackBets);
  }
};

refreshButton.addEventListener("click", () => {
  loadBets();
});

loadBets();
