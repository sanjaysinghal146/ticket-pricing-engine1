# Reasoning — Design Decisions Behind the Pricing Engine

This document explains *why* the engine is built the way it is, not just
what it does. The problem statement deliberately leaves several real-world
money rules ambiguous ("the messy real-world money rules are the point") —
this is a record of the specific choices made to resolve that ambiguity,
and why.

## 1. Why money is represented in integer paise, never floating-point rupees

Floating-point arithmetic cannot represent most rupee-and-paise amounts
exactly (`0.1 + 0.2 !== 0.3` in every mainstream language). A booking
counter that has to reconcile a printed bill to the exact paisa cannot
tolerate that drift, especially once percentage discounts and GST are
layered on. Every price, fee, discount, and tax amount in this engine is
therefore an integer number of paise from the moment it enters the system.
Rupees only exist as a display format, applied at the very last step
(`formatRupees`). This is a standard practice in billing/payments systems
for exactly this reason.

## 2. Why sold-out validation happens before any pricing math

`priceBooking` checks seat availability for every requested tier *before*
computing a single rupee of subtotal. Two reasons:

- **Correctness**: pricing a seat that doesn't exist is meaningless — the
  booking should fail fast with a clear reason (`SoldOutError`,
  `TierNotFoundError`), not silently produce a bill for seats that were
  never available.
- **Trust**: the problem statement's core ask is a counter the staff can
  *trust*. An engine that prices first and checks availability later
  invites a class of bugs where a customer sees a total for seats they
  can never actually get.

## 3. Why the offer stacking order is: flat discount first, then capped percentage on the remainder

The problem statement gives two offers — a flat festival discount and a
capped percentage member discount — but doesn't say how they combine if
both apply to the same booking. Three orderings were considered:

1. Both computed independently on the original subtotal, then summed.
2. Percentage first, then flat discount on the remainder.
3. **Flat discount first, then percentage on what's left, capped.**

Option 3 was chosen because it mirrors how most real-world billing systems
(and most cinema chains' own POS systems) apply stacked offers — a flat
coupon reduces the bill first, and a loyalty/member percentage then
applies to the discounted balance, not the original price. This also
naturally prevents the combined discount from ever exceeding what a
customer actually owes, since each step floors at the current running
balance. The percentage discount is computed with `Math.round()` at the
moment it's produced (see point 5) and then capped at its configured
maximum before being subtracted.

This is a **documented assumption**, not a universal truth — a different
cinema chain might apply offers differently. The important part is that
the code states the rule once, in one place (`pricingEngine.ts`, step 2–3),
rather than leaving it as an implicit side effect of calculation order.

## 4. Why the convenience fee is excluded from discounts but included in the GST base

The convenience fee is a service charge for the *booking transaction*, not
part of the ticket price — so it's added after discounts are applied, and
discounts never touch it. GST, however, is charged on
`discountedSubtotal + convenienceFee`, because the fee is itself a taxable
service charge under typical GST treatment of booking/service fees. This
mirrors how most ticketing platforms itemize their bills: the discount
line only ever reduces the ticket cost, while tax applies to the full
taxable value of the transaction.

## 5. Why rounding happens exactly once, at the point each fractional value is produced

`roundPaise()` (a thin wrapper over `Math.round`) is called in exactly two
places: computing the percentage member discount, and computing the GST
amount. These are the only two places in the whole calculation where a
paise amount can become fractional (multiplying an integer by a
percentage). Everything else — base ticket price × quantity, the flat
discount, the convenience fee — is already an integer paise value with no
rounding needed. By rounding immediately and never carrying a fractional
value forward, the engine guarantees the reconciliation invariant tested
in `tests/pricingEngine.test.ts`: the sum of every printed line item
always equals the grand total, with zero drift, across every quantity and
GST rate tested.

## 6. Why the engine, the API, and the UI are three separate layers

`pricingEngine.ts` has no knowledge of HTTP, Express, or the DOM — it's a
pure function (`Show`, tickets, offers, fees) → `BookingBreakup`. This was
deliberate:

- It can be unit-tested directly (as it is, nine tests) without spinning
  up a server or a browser.
- The same logic backs three different surfaces — the CLI demo, the REST
  API, and (indirectly) the web UI — with zero duplication.
- If this engine needs to move into a different context later (a batch
  reconciliation job, a different frontend, a mobile app's backend), it
  can be imported as-is.

## 7. What was deliberately left out of scope, and why

- **Concurrent seat locking.** `bookedSeats` is a plain in-memory number,
  incremented on confirm. Two customers racing for the last seat at the
  same instant could both succeed in this implementation. A production
  system would need an atomic database increment or a row lock — that's
  an inventory-concurrency problem, not a pricing problem, and solving it
  well would have meant building a persistence layer instead of the
  pricing logic the round asked for.
- **Per-tier fee/tax overrides.** `FeeConfig` (convenience fee, GST) is
  one config per booking, not per tier, since the problem statement
  describes fees and tax as counter-wide rules, not tier-specific ones.
  The type is structured so this would be a small, additive change if
  needed later (see the README's "Extending it" section).
- **Persistent storage.** Show and tier data live in
  `src/data/sampleShow.ts` and reset on server restart. The problem asks
  for correct *pricing*, not a booking database — swapping in a real
  store doesn't change any pricing logic, only where `Show` data comes
  from.

## 8. Why vanilla JS/HTML/CSS for the frontend instead of a framework

For a timed build round, a framework's build step (bundler config, JSX
compilation, routing setup) is pure overhead relative to what a booking
counter UI actually needs: a list of tiers, some steppers, two checkboxes,
and a receipt. Plain HTML/CSS/JS opens instantly, has zero build
dependencies, and keeps the entire frontend logic readable in one
~200-line file (`public/app.js`) — easier for a reviewer to audit in the
time available than tracing through a component tree.
