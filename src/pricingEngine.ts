import {
  Show,
  TicketRequestLine,
  OfferConfig,
  FeeConfig,
  BillLine,
  BookingBreakup,
  SeatTier,
} from './types';
import { TierNotFoundError, SoldOutError, InvalidRequestError } from './errors';

/**
 * Round a fractional paisa amount to the nearest whole paisa, banker's-round-half-up.
 * This is the ONLY place fractional money is allowed to exist, and it never
 * survives past this function.
 */
function roundPaise(amountPaise: number): number {
  return Math.round(amountPaise);
}

function findTier(show: Show, tierId: string): SeatTier {
  const tier = show.tiers.find((t) => t.id === tierId);
  if (!tier) throw new TierNotFoundError(tierId);
  return tier;
}

function availableSeats(tier: SeatTier): number {
  return Math.max(0, tier.totalSeats - tier.bookedSeats);
}

/**
 * Validates a requested booking against seat availability. Throws
 * SoldOutError (or TierNotFoundError) before any money is ever touched —
 * you cannot price a seat that doesn't exist.
 */
function validateAvailability(show: Show, lines: TicketRequestLine[]): void {
  for (const line of lines) {
    if (line.quantity <= 0) {
      throw new InvalidRequestError(
        `Requested quantity must be positive (tier "${line.tierId}" got ${line.quantity}).`
      );
    }
    const tier = findTier(show, line.tierId);
    const available = availableSeats(tier);
    if (line.quantity > available) {
      throw new SoldOutError(tier.name, line.quantity, available);
    }
  }
}

/**
 * Prices a booking end to end and returns a full line-by-line breakup.
 *
 * Order of operations (documented because real-world "which offer applies to
 * what" is genuinely ambiguous, and a pricing engine has to pick one and be
 * consistent about it):
 *
 *   1. Subtotal = sum over requested tiers of (quantity x tier base price).
 *   2. Flat festival discount is subtracted first, floored at zero.
 *   3. Member percentage discount is then computed on what's LEFT after the
 *      flat discount (not on the original subtotal — offers stack against
 *      the remaining balance, not against each other), then capped.
 *   4. Convenience fee is added per ticket — it is NOT discounted, since
 *      it's a service fee, not part of the ticket price.
 *   5. GST is charged on (discounted subtotal + convenience fee), because
 *      the convenience fee is itself a taxable service charge.
 *   6. Every intermediate money value is rounded to the nearest paisa the
 *      moment it's computed, so the final total is guaranteed to reconcile
 *      exactly with the sum of the printed line items — no drift.
 */
export function priceBooking(
  show: Show,
  requestLines: TicketRequestLine[],
  offers: OfferConfig = {},
  fees: FeeConfig
): BookingBreakup {
  if (requestLines.length === 0) {
    throw new InvalidRequestError('Booking must include at least one ticket.');
  }

  validateAvailability(show, requestLines);

  const lines: BillLine[] = [];
  let subtotalPaise = 0;
  let totalTickets = 0;

  // --- 1. Base ticket lines, one per requested tier ---
  for (const req of requestLines) {
    const tier = findTier(show, req.tierId);
    const amount = tier.basePricePaise * req.quantity;
    subtotalPaise += amount;
    totalTickets += req.quantity;
    lines.push({
      label: `${tier.name} x${req.quantity} @ ${formatRupees(tier.basePricePaise)}`,
      amountPaise: amount,
    });
  }

  // --- 2. Flat festival discount ---
  let runningBalance = subtotalPaise;
  let totalDiscountPaise = 0;

  if (offers.festivalFlatDiscountPaise) {
    const flatDiscount = Math.min(offers.festivalFlatDiscountPaise, runningBalance);
    if (flatDiscount > 0) {
      lines.push({ label: 'Festival discount', amountPaise: -flatDiscount });
      totalDiscountPaise += flatDiscount;
      runningBalance -= flatDiscount;
    }
  }

  // --- 3. Percentage member discount, capped, applied on the remaining balance ---
  if (offers.memberDiscountPercent) {
    const rawDiscount = roundPaise((runningBalance * offers.memberDiscountPercent) / 100);
    const cappedDiscount =
      offers.memberDiscountCapPaise !== undefined
        ? Math.min(rawDiscount, offers.memberDiscountCapPaise)
        : rawDiscount;
    const memberDiscount = Math.min(cappedDiscount, runningBalance);
    if (memberDiscount > 0) {
      lines.push({
        label: `Member discount (${offers.memberDiscountPercent}%${
          offers.memberDiscountCapPaise !== undefined ? ', capped' : ''
        })`,
        amountPaise: -memberDiscount,
      });
      totalDiscountPaise += memberDiscount;
      runningBalance -= memberDiscount;
    }
  }

  const discountedSubtotalPaise = subtotalPaise - totalDiscountPaise;

  // --- 4. Convenience fee, per ticket, not discounted ---
  const convenienceFeePaise = fees.convenienceFeePerTicketPaise * totalTickets;
  if (convenienceFeePaise > 0) {
    lines.push({
      label: `Convenience fee x${totalTickets} @ ${formatRupees(
        fees.convenienceFeePerTicketPaise
      )}`,
      amountPaise: convenienceFeePaise,
    });
  }

  // --- 5. GST on (discounted subtotal + convenience fee) ---
  const taxableAmountPaise = discountedSubtotalPaise + convenienceFeePaise;
  const gstAmountPaise = roundPaise((taxableAmountPaise * fees.gstPercent) / 100);
  lines.push({
    label: `GST (${fees.gstPercent}%)`,
    amountPaise: gstAmountPaise,
  });

  const grandTotalPaise = taxableAmountPaise + gstAmountPaise;

  return {
    lines,
    subtotalPaise,
    totalDiscountPaise,
    convenienceFeePaise,
    taxableAmountPaise,
    gstAmountPaise,
    grandTotalPaise,
  };
}

/** Formats a paisa integer as a rupee string, e.g. 125050 -> "₹1,250.50". */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  const sign = rupees < 0 ? '-' : '';
  const formatted = Math.abs(rupees).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}₹${formatted}`;
}

/** Prints a full, itemized breakup to a string — this is the "receipt". */
export function renderBreakup(breakup: BookingBreakup): string {
  const rows = breakup.lines.map(
    (l) => `  ${l.label.padEnd(45, '.')} ${formatRupees(l.amountPaise)}`
  );
  return [
    ...rows,
    '  ' + '-'.repeat(60),
    `  ${'Grand Total'.padEnd(45, '.')} ${formatRupees(breakup.grandTotalPaise)}`,
  ].join('\n');
}
