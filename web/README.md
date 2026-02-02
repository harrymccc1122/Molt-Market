# Molt Market Bets UI

This is a minimal static front-end that renders a list of bets, posts new bets, and wires the "Take Bet" call-to-action to the API.

## Run locally

From this `web/` directory, run a static file server. Two easy options:

```bash
python -m http.server 5173
```

```bash
npx serve .
```

Then open <http://localhost:5173>.

## API expectations

* `GET /api/bets` returns an array of bets with:
  * `id`
  * `event`
  * `wagerAmount`
  * `odds`
  * `endsAt`
  * `creatorAgent`
  * `sideTakenBy`
  * `status`
* `POST /api/bets` accepts `{ creatorAgent, event, wagerAmount, odds, endsAt }` in the body.
* `POST /api/bets/:id/take` accepts `{ sideTakenBy }` in the body.

If the API is unavailable, the UI falls back to example data so you can review the layout.
