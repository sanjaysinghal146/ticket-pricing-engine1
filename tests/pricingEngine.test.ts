import { priceBooking } from '../src/pricingEngine';
import { fridayNightShow } from '../src/data/sampleShow';
import { SoldOutError, TierNotFoundError, InvalidRequestError } from '../src/errors';

describe('priceBooking — plain booking, no offers', () => {
  it('computes subtotal, fee and GST correctly with no offers applied', () => {
    const breakup = priceBooking(
      fridayNightShow,
      [{ tierId: 'silver', quantity: 4 }],
      {},
      { convenienceFeePerTicketPaise: 2000, gstPercent: 18 }
    );

    expect(breakup.subtotalPaise).toBe(60000); // 4 x ₹150
    expect(breakup.totalDiscountPaise).toBe(0);
    expect(breakup.convenienceFeePaise).toBe(8000); // 4 x ₹20
    expect(breakup.taxableAmountPaise).toBe(68000);
    expect(breakup.gstAmountPaise).toBe(12240); // 18% of 680.00
    expect(breakup.grandTotalPaise).toBe(80240); // ₹802.40
  });
});

describe('priceBooking — stacked offers (flat + capped percentage)', () => {
  it('applies the flat discount first, then a capped percentage on the remainder', () => {
    const breakup = priceBooking(
      fridayNightShow,
      [
        { tierId: 'gold', quantity: 2 },
        { tierId: 'recliner', quantity: 1 },
      ],
      {
        festivalFlatDiscountPaise: 10000,
        memberDiscountPercent: 10,
        memberDiscountCapPaise: 8000,
      },
      { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
    );

    expect(breakup.subtotalPaise).toBe(95000); // 2x250 + 1x450
    // 10% of (95000 - 10000) = 8500, but capped at 8000
    expect(breakup.totalDiscountPaise).toBe(18000);
    expect(breakup.convenienceFeePaise).toBe(9000); // 3 tickets x ₹30
    expect(breakup.taxableAmountPaise).toBe(86000);
    expect(breakup.gstAmountPaise).toBe(15480);
    expect(breakup.grandTotalPaise).toBe(101480); // ₹1014.80
  });

  it('never lets a discount push the balance below zero', () => {
    const breakup = priceBooking(
      fridayNightShow,
      [{ tierId: 'silver', quantity: 1 }],
      { festivalFlatDiscountPaise: 999999, memberDiscountPercent: 50 },
      { convenienceFeePerTicketPaise: 1000, gstPercent: 18 }
    );

    expect(breakup.totalDiscountPaise).toBe(15000); // capped at the subtotal itself
    expect(breakup.taxableAmountPaise).toBe(1000); // just the convenience fee remains taxable
  });
});

describe('priceBooking — availability rules', () => {
  it('rejects a booking that exceeds remaining seats in a tier', () => {
    // Recliner: 20 total, 19 booked -> only 1 left
    expect(() =>
      priceBooking(
        fridayNightShow,
        [{ tierId: 'recliner', quantity: 3 }],
        {},
        { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
      )
    ).toThrow(SoldOutError);
  });

  it('allows booking exactly the remaining seats', () => {
    expect(() =>
      priceBooking(
        fridayNightShow,
        [{ tierId: 'recliner', quantity: 1 }],
        {},
        { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
      )
    ).not.toThrow();
  });

  it('throws for an unknown tier id', () => {
    expect(() =>
      priceBooking(
        fridayNightShow,
        [{ tierId: 'platinum', quantity: 1 }],
        {},
        { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
      )
    ).toThrow(TierNotFoundError);
  });

  it('throws for a zero or negative quantity', () => {
    expect(() =>
      priceBooking(
        fridayNightShow,
        [{ tierId: 'silver', quantity: 0 }],
        {},
        { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
      )
    ).toThrow(InvalidRequestError);
  });

  it('throws for an empty booking', () => {
    expect(() =>
      priceBooking(fridayNightShow, [], {}, { convenienceFeePerTicketPaise: 3000, gstPercent: 18 })
    ).toThrow(InvalidRequestError);
  });
});

describe('priceBooking — reconciliation to the exact paisa', () => {
  it('the printed line items always sum exactly to the grand total', () => {
    const scenarios: Array<[number, number]> = [
      [1, 5],
      [3, 12],
      [7, 18],
      [13, 9],
    ];

    for (const [qty, gstPercent] of scenarios) {
      const breakup = priceBooking(
        fridayNightShow,
        [{ tierId: 'gold', quantity: qty }],
        { festivalFlatDiscountPaise: 1234, memberDiscountPercent: 7, memberDiscountCapPaise: 5000 },
        { convenienceFeePerTicketPaise: 1750, gstPercent }
      );

      const sumOfLines = breakup.lines.reduce((acc, l) => acc + l.amountPaise, 0);
      expect(sumOfLines).toBe(breakup.grandTotalPaise);
      expect(Number.isInteger(breakup.grandTotalPaise)).toBe(true);
    }
  });
});
