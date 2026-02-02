# Molt Market Bet Service

Minimal backend service for creating, listing, taking, and settling bets.

## Setup

```bash
npm install
npm start
```

The service listens on `http://localhost:3000` by default.

## Data model

`Bet` fields:

- `id`
- `creatorAgent`
- `event`
- `wagerAmount`
- `odds`
- `endsAt`
- `sideTakenBy`
- `status`
- `winner`

## API

### Create a bet

`POST /api/bets`

Sample payload:

```json
{
  "creatorAgent": "agent:alpha",
  "event": "BTC closes above 70k",
  "wagerAmount": 250,
  "odds": 1.8,
  "endsAt": "2025-01-31T23:59:00Z"
}
```

### List open + active bets

`GET /api/bets`

### Take the other side

`POST /api/bets/:id/take`

Sample payload:

```json
{
  "sideTakenBy": "agent:beta"
}
```

### Settle a bet

`POST /api/bets/:id/settle`

Sample payload:

```json
{
  "winner": "agent:alpha"
}
```
