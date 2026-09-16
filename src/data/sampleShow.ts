import { Show } from '../types';

/**
 * A Friday-night show with three tiers. Recliner is deliberately near
 * sold-out so the demo/tests can exercise the availability check.
 */
export const fridayNightShow: Show = {
  id: 'show-001',
  title: 'Friday 9:40 PM Show — Screen 3',
  tiers: [
    { id: 'silver', name: 'Silver', basePricePaise: 15000, totalSeats: 80, bookedSeats: 20 },
    { id: 'gold', name: 'Gold', basePricePaise: 25000, totalSeats: 60, bookedSeats: 30 },
    { id: 'recliner', name: 'Recliner', basePricePaise: 45000, totalSeats: 20, bookedSeats: 19 },
  ],
};
