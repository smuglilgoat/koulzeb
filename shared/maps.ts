import type { Restaurant } from "./types.ts";

/**
 * Google Maps link for a restaurant: an explicit link when it is a safe
 * http(s) URL, otherwise a Maps search built from the name and address.
 */
export function mapsUrl(
  restaurant: Pick<Restaurant, "name" | "address" | "mapUrl">,
): string {
  if (restaurant.mapUrl && /^https?:\/\//i.test(restaurant.mapUrl)) {
    return restaurant.mapUrl;
  }
  const query = [restaurant.name, restaurant.address]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
