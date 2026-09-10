import type { Participant, RankedOption, Restaurant } from "./types.ts";

/**
 * Cross freely-chosen availability with cuisine preferences and the restaurant
 * list. Candidate times are the union of every participant's `freeTimes`
 * (30-minute time-of-day slots).
 *
 * Only participants who are free at a given time count toward that time's
 * cuisine match, since someone who cannot attend cannot veto the cuisine.
 * An empty `cuisinePrefs` means "no preference": it is neutral, matching
 * nothing rather than everything.
 *
 * Returns every valid (time, restaurant) pair, best first:
 *   freeCount desc, then matchedCount desc, then time, then restaurant name.
 * The caller decides whether to present or auto-confirm.
 */
export function rankOptions(
  restaurants: Restaurant[],
  participants: Participant[],
): RankedOption[] {
  const times = [
    ...new Set(participants.flatMap((p) => p.freeTimes)),
  ].sort();

  const options: RankedOption[] = [];
  for (const time of times) {
    const free = participants.filter((p) => p.freeTimes.includes(time));
    for (const restaurant of restaurants) {
      const matched = free.filter((p) =>
        p.cuisinePrefs.some((c) => restaurant.cuisines.includes(c)),
      );
      options.push({
        time,
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
      a.time.localeCompare(b.time) ||
      a.restaurant.name.localeCompare(b.restaurant.name),
  );
  return options;
}
