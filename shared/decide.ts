import type {
  Participant,
  RankedOption,
  Restaurant,
  TimeSlot,
} from "./types.ts";

/**
 * Cross time availability with cuisine preferences and the restaurant list.
 *
 * Only participants who are free at a given time count toward that time's
 * cuisine match, since someone who cannot attend cannot veto the cuisine.
 * An empty `cuisinePrefs` means "no preference": it is neutral, matching
 * nothing rather than everything.
 *
 * Returns every valid (time, restaurant) pair, best first:
 *   freeCount desc, then matchedCount desc, then restaurant name.
 * The caller decides whether to present or auto-confirm.
 */
export function rankOptions(
  timeSlots: TimeSlot[],
  restaurants: Restaurant[],
  participants: Participant[],
): RankedOption[] {
  const options: RankedOption[] = [];

  for (const timeSlot of timeSlots) {
    const free = participants.filter((p) =>
      p.availableSlotIds.includes(timeSlot.id),
    );

    for (const restaurant of restaurants) {
      if (
        restaurant.openSlotIds?.length &&
        !restaurant.openSlotIds.includes(timeSlot.id)
      ) {
        continue;
      }
      const matched = free.filter((p) =>
        p.cuisinePrefs.some((c) => restaurant.cuisines.includes(c)),
      );
      options.push({
        timeSlot,
        restaurant,
        freeCount: free.length,
        matchedCount: matched.length,
        attendees: free.map((p) => p.name),
      });
    }
  }

  options.sort(
    (a, b) =>
      b.freeCount - a.freeCount ||
      b.matchedCount - a.matchedCount ||
      a.restaurant.name.localeCompare(b.restaurant.name),
  );
  return options;
}
