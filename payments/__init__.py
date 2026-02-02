from __future__ import annotations

from models.bet import Bet
from payments.provider import CustodialPaymentProvider


def initWager(bet: Bet, provider: CustodialPaymentProvider) -> str:
    if bet.status != "open":
        raise ValueError("Bet is not open for wagers.")
    tx_id = provider.create_charge(bet.amount, bet.currency, bet.bet_id)
    bet.record_wager_tx(tx_id)
    return tx_id


def releasePayout(bet: Bet, provider: CustodialPaymentProvider, destination: str) -> str:
    if bet.status != "locked":
        raise ValueError("Bet is not eligible for payout.")
    tx_id = provider.send_payout(bet.amount, bet.currency, destination)
    bet.record_payout_tx(tx_id)
    bet.validate_settlement("payout", tx_id)
    return tx_id


def refundWager(bet: Bet, provider: CustodialPaymentProvider) -> str:
    if bet.status != "locked":
        raise ValueError("Bet is not eligible for refund.")
    if not bet.wager_tx_id:
        raise ValueError("Missing wager transaction ID for refund.")
    tx_id = provider.refund_charge(bet.wager_tx_id)
    bet.record_refund_tx(tx_id)
    bet.validate_settlement("refund", tx_id)
    return tx_id


__all__ = ["initWager", "releasePayout", "refundWager", "CustodialPaymentProvider"]
