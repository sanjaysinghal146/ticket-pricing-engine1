import { fridayNightShow } from './data/sampleShow';
import { priceBooking, renderBreakup } from './pricingEngine';
import { SoldOutError, TierNotFoundError, InvalidRequestError } from './errors';

function demo(title: string, fn: () => void) {
  console.log(`\n=== ${title} ===`);
  try {
    fn();
  } catch (err) {
    if (
      err instanceof SoldOutError ||
      err instanceof TierNotFoundError ||
      err instanceof InvalidRequestError
    ) {
      console.log(`  ✖ ${err.name}: ${err.message}`);
    } else {
      throw err;
    }
  }
}

demo('2 Gold, 1 Recliner — festival + capped member discount', () => {
  const breakup = priceBooking(
    fridayNightShow,
    [
      { tierId: 'gold', quantity: 2 },
      { tierId: 'recliner', quantity: 1 },
    ],
    {
      festivalFlatDiscountPaise: 10000, // ₹100 flat off
      memberDiscountPercent: 10, // 10% off remaining balance
      memberDiscountCapPaise: 8000, // capped at ₹80
    },
    { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
  );
  console.log(renderBreakup(breakup));
});

demo('Plain booking, no offers', () => {
  const breakup = priceBooking(
    fridayNightShow,
    [{ tierId: 'silver', quantity: 4 }],
    {},
    { convenienceFeePerTicketPaise: 2000, gstPercent: 18 }
  );
  console.log(renderBreakup(breakup));
});

demo('Overbooking a nearly sold-out tier (Recliner has 1 seat left)', () => {
  const breakup = priceBooking(
    fridayNightShow,
    [{ tierId: 'recliner', quantity: 3 }],
    {},
    { convenienceFeePerTicketPaise: 3000, gstPercent: 18 }
  );
  console.log(renderBreakup(breakup));
});
