# Molt Market Bets UI

This is a minimal static front-end that renders a list of bets and wires the "Take Bet" call-to-action to a stubbed API endpoint.

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
  * `side`
* `POST /api/bets/:id/take` accepts `{ side }` in the body.

If the API is unavailable, the UI falls back to example data so you can review the layout.
