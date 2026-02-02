const statusEl = document.getElementById("status");
const betGrid = document.getElementById("bet-grid");
const template = document.getElementById("bet-card-template");
const refreshButton = document.getElementById("refresh");

const fallbackBets = [
  {
    id: "bet-001",
    event: "NYC Marathon - Winner",
    side: "Take: Team Central",
    wagerAmount: "$150",
    odds: "+180",
    endsAt: "2025-03-04 09:00 EST",
  },
  {
    id: "bet-002",
    event: "Champions League Final",
    side: "Take: Home Win",
    wagerAmount: "$220",
    odds: "-110",
    endsAt: "2025-06-01 15:45 EST",
  },
  {
    id: "bet-003",
    event: "Molt Market Weekly Volume",
    side: "Take: Over 1.2M",
    wagerAmount: "$75",
    odds: "+250",
    endsAt: "2025-02-18 12:00 EST",
  },
];

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
    node.querySelector(".side").textContent = bet.side;
    node.querySelector(".odds").textContent = bet.odds;
    node.querySelector(".wager").textContent = bet.wagerAmount;
    node.querySelector(".ends").textContent = formatEndsAt(bet.endsAt);

    const cta = node.querySelector(".cta");
    cta.addEventListener("click", async () => {
      cta.disabled = true;
      cta.textContent = "Submitting…";

      try {
        const response = await fetch(`/api/bets/${bet.id}/take`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ side: bet.side }),
        });

        if (!response.ok) {
          throw new Error("Request failed");
        }

        cta.textContent = "Taken";
      } catch (error) {
        cta.textContent = "Try Again";
        alert("Bet submission failed. This is a stub endpoint for now.");
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
