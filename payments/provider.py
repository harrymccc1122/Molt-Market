from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4


@dataclass
class CustodialPaymentProvider:
    name: str = "MockCustodialProvider"

    def create_charge(self, amount: float, currency: str, reference: str) -> str:
        return f"chg_{reference}_{uuid4().hex[:12]}"

    def send_payout(self, amount: float, currency: str, destination: str) -> str:
        return f"payout_{destination}_{uuid4().hex[:12]}"

    def refund_charge(self, charge_id: str) -> str:
        return f"refund_{charge_id}_{uuid4().hex[:12]}"
