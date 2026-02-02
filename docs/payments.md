# Payments Integration

## Choice of Integration
We use a **custodial crypto payment provider** (mocked by `CustodialPaymentProvider`) because it is the simplest integration for accepting and paying out wagers. It avoids deploying and auditing a smart contract while still giving a clear place to capture transaction IDs and enforce settlement validation in the app layer.

## Wallet Requirements
- **Custodial wallet** managed by the provider for incoming wager deposits.
- **Outbound payout wallet** (provider-managed hot wallet) to send winnings.
- **Destination address** provided by the winning player for payouts.
- **Refund capability** on the provider side for charge reversals.

## Happy Path Flow
1. **Create wager**
   - `initWager(bet, provider)` requests a custodial charge.
   - The returned charge ID is stored as `bet.wager_tx_id`, and the bet status becomes `locked`.
2. **Resolve outcome**
   - The winner is determined in game logic.
3. **Release payout**
   - `releasePayout(bet, provider, destination)` sends funds to the winner.
   - The payout transaction ID is stored as `bet.payout_tx_id`.
   - The bet validates settlement by ensuring the stored transaction ID matches the settlement transaction ID.
4. **Record settlement**
   - The bet status is updated to `settled`.

## Refund Path (if needed)
- `refundWager(bet, provider)` issues a refund for the original wager.
- The refund transaction ID is stored as `bet.refund_tx_id` and validated on settlement.
