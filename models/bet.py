from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Bet:
    bet_id: str
    amount: float
    currency: str
    status: str = "open"
    wager_tx_id: Optional[str] = None
    payout_tx_id: Optional[str] = None
    refund_tx_id: Optional[str] = None
    metadata: dict[str, str] = field(default_factory=dict)

    def record_wager_tx(self, tx_id: str) -> None:
        if self.wager_tx_id:
            raise ValueError("Wager transaction already recorded.")
        self.wager_tx_id = tx_id
        self.status = "locked"

    def record_payout_tx(self, tx_id: str) -> None:
        if self.payout_tx_id:
            raise ValueError("Payout transaction already recorded.")
        self.payout_tx_id = tx_id
        self.status = "settled"

    def record_refund_tx(self, tx_id: str) -> None:
        if self.refund_tx_id:
            raise ValueError("Refund transaction already recorded.")
        self.refund_tx_id = tx_id
        self.status = "refunded"

    def validate_settlement(self, action: str, tx_id: str) -> None:
        if action not in {"payout", "refund"}:
            raise ValueError("Settlement action must be 'payout' or 'refund'.")
        if not self.wager_tx_id:
            raise ValueError("Cannot settle without a recorded wager transaction.")
        expected = self.payout_tx_id if action == "payout" else self.refund_tx_id
        if expected != tx_id:
            raise ValueError("Settlement transaction ID does not match stored value.")
