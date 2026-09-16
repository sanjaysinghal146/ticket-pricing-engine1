# Ticket Pricing Engine

A pricing engine for a multiplex booking counter — built to be trusted, not just
demoed. Handles seat tiers, sold-out inventory, stacked offers, a per-ticket
convenience fee, and GST, and reconciles every bill to the exact paisa.

Works for **any** cinema counter and show — tiers, prices, seat counts,
offers and fees are all configuration, not hardcoded.

## The problem, and the decisions it forces

- **Tiers & sold-out seats.** Silver / Gold / Recliner (or any tiers you
  define) each carry their own price and seat inventory. A booking is
  rejected *before* any money is calculated if it would oversell a tier.
- **Money in paise, always.** Every price, fee and discount is an integer
  number of paise internally. Rupees only appear when formatting for
  display. This is the only way to guarantee the printed breakup sums
  exactly to the grand total — floating-point rupees drift.
- **Offer stacking order (the ambiguous part, made explicit).**
  1. Flat festival discount is subtracted from the subtotal first.
  2. The member percentage discount is then computed on what's *left*
     after the flat discount — not on the original subtotal — and then
     capped at its configured maximum.
  3. Neither discount can push the balance below zero.
- **Convenience fee is not discounted.** It's a per-ticket service charge,
  added after discounts.
- **GST is charged on (discounted subtotal + convenience fee).** The fee is
  itself a taxable service charge, so it's included in the tax base.
- **Rounding happens once, at the moment a fractional value is produced**
  (e.g. a percentage discount or GST amount), using standard round-half-up
  to the nearest paisa. Nothing fractional is ever carried forward.

These choices are opinions a real cinema chain would configure differently;
what matters is that they're applied consistently and documented, not
buried in arithmetic.

## Project layout

```
src/
  types.ts           Domain types (Show, SeatTier, OfferConfig, FeeConfig, BookingBreakup...)
  errors.ts           TierNotFoundError, SoldOutError, InvalidRequestError
  pricingEngine.ts     priceBooking() — the engine itself, plus formatting helpers
  data/sampleShow.ts   Example show/tier data used by the CLI and as a template
  cli.ts               Runnable demo — three scenarios, including a sold-out rejection
tests/
  pricingEngine.test.ts  Jest suite: correctness, stacking, availability, paisa reconciliation
```

## Running it locally (or in Codespaces — see below)

```bash
npm install
npm test        # run the test suite
npm start       # run the CLI demo (three example bookings)
```

## Using the engine in your own code

```ts
import { priceBooking, renderBreakup } from './src/pricingEngine';

const breakup = priceBooking(
  myShow,                                   // a Show: { id, title, tiers: SeatTier[] }
  [{ tierId: 'gold', quantity: 2 }],        // what the customer wants to book
  {                                         // offers — all optional
    festivalFlatDiscountPaise: 10000,
    memberDiscountPercent: 10,
    memberDiscountCapPaise: 8000,
  },
  { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
);

console.log(renderBreakup(breakup));
// breakup.grandTotalPaise is the exact amount to charge, in paise
```

`priceBooking` throws `SoldOutError`, `TierNotFoundError` or
`InvalidRequestError` (all in `src/errors.ts`) for bad requests — catch
these at the counter's API boundary to show the customer a clear message.

## Setting this up in a GitHub Codespace

The repo ships with a `.devcontainer/devcontainer.json`, so Codespaces
configures itself — you don't need to install Node or anything else by hand.

1. **Push this project to a GitHub repo** (skip if it's already on GitHub):
   ```bash
   cd ticket-pricing-engine
   git init
   git add .
   git commit -m "Ticket pricing engine"
   gh repo create ticket-pricing-engine --private --source=. --push
   ```
   (No `gh` CLI? Create an empty repo on github.com, then
   `git remote add origin <your-repo-url> && git push -u origin main`.)

2. **Open a Codespace:**
   - On the repo's GitHub page, click **Code → Codespaces → Create codespace
     on main**.
   - Codespaces builds the container (Node 20, TypeScript preinstalled) and
     runs `npm install` automatically via `postCreateCommand` — wait for
     "Running postCreateCommand..." to finish in the terminal at the bottom.

3. **Once it's ready, in the Codespace terminal:**
   ```bash
   npm test     # confirm all tests pass in the container
   npm start    # see the demo bookings and their breakups
   ```

4. That's it — edit `src/data/sampleShow.ts` to point at your own show and
   tiers, or import `priceBooking` from `src/pricingEngine.ts` into whatever
   counter/API code you build on top of it.

## Extending it

- **New offer types:** add a field to `OfferConfig`, then a new step in
  `priceBooking` between steps 2 and 4 — keep the "apply, then cap, then
  floor at zero" pattern.
- **Per-tier fees or tax rates:** currently fees/GST are global (`FeeConfig`
  is one object per booking); if a tier needs its own rate, thread it
  through `SeatTier` instead and adjust the fee/GST calculation to sum
  per-line.
- **Concurrency / real inventory:** `bookedSeats` here is a plain number for
  clarity. A production counter would need this to be an atomic
  increment against a real database to avoid two customers grabbing the
  last seat at once — that's outside this engine's scope, which is pricing,
  not inventory locking.
