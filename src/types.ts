/**
 * All money values in this engine are integers in PAISE (1 rupee = 100 paise).
 * We never use floating point rupees for money math — that's how "off by one
 * paisa" bugs sneak into a booking counter. Floats only ever appear briefly,
 * mid-calculation, before being rounded back to an integer paisa amount.
 */

export type TierId = string;

export interface SeatTier {
  id: TierId;
  name: string; // e.g. "Silver", "Gold", "Recliner"
  basePricePaise: number; // price per seat in this tier
  totalSeats: number;
  bookedSeats: number; // seats already sold before this booking
}

export interface Show {
  id: string;
  title: string;
  tiers: SeatTier[];
}

/** One line of what the customer is asking to book: N seats in a given tier. */
export interface TicketRequestLine {
  tierId: TierId;
  quantity: number;
}

/**
 * Offers are OPTIONAL and independent of each other. Whichever are present
 * get applied; whichever are omitted simply contribute zero discount.
 */
export interface OfferConfig {
  /** Flat, one-time discount for the whole booking (e.g. festival offer). */
  festivalFlatDiscountPaise?: number;
  /** Percentage off for members, e.g. 10 means 10%. */
  memberDiscountPercent?: number;
  /** Upper bound on how much the percentage-off offer can discount. */
  memberDiscountCapPaise?: number;
}

export interface FeeConfig {
  /** Charged once per ticket, regardless of tier. */
  convenienceFeePerTicketPaise: number;
  /** GST rate applied to (discounted subtotal + convenience fees). */
  gstPercent: number;
}

export interface BillLine {
  label: string;
  amountPaise: number; // negative for discounts, positive otherwise
}

export interface BookingBreakup {
  lines: BillLine[];
  subtotalPaise: number; // sum of tier base amounts, before anything else
  totalDiscountPaise: number; // festival + member discount combined
  convenienceFeePaise: number;
  taxableAmountPaise: number; // (subtotal - discount) + convenience fee
  gstAmountPaise: number;
  grandTotalPaise: number; // taxableAmount + gst — what the customer pays
}
