import { getStore } from "@netlify/blobs";
import { CUISINE_NAMES } from "../../../shared/cuisines.ts";
import type { PlaceResult } from "../../../shared/types.ts";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/**
 * Field masks by billing SKU. Essentials/Pro fields keep us in the cheaper
 * Text Search Pro SKU (5,000 free calls/month). rating/priceLevel are
 * Enterprise fields (1,000 free), so they are opt-in.
 */
const PRO_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "places.types",
];
const ENTERPRISE_FIELDS = [
  "places.rating",
  "places.priceLevel",
  "places.userRatingCount",
];

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Google allows up to 30)

const TYPES: Record<string, string> = {
  hamburger_restaurant: "Burger",
  ramen_restaurant: "Ramen",
  sushi_restaurant: "Sushi",
  noodle_shop: "Noodles",
  ice_cream_shop: "Ice Cream",
  dessert_shop: "Dessert",
  coffee_shop: "Cafe",
  sandwich_shop: "",
};

type PlacesApiPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  rating?: number;
  priceLevel?: string;
};

export type PlacesSearch =
  | { ok: true; places: PlaceResult[]; cached: boolean }
  | { ok: false; status: number; error: string };

function store() {
  return getStore({ name: "koulzeb", consistency: "strong" });
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function priceLabel(level: string): string | undefined {
  return (
    {
      PRICE_LEVEL_INEXPENSIVE: "€",
      PRICE_LEVEL_MODERATE: "€€",
      PRICE_LEVEL_EXPENSIVE: "€€€",
      PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
    }[level] ?? undefined
  );
}

/** Map Google place types onto our canonical cuisine tags. */
function toCuisines(types: string[], primary?: string): string[] {
  const found = new Set<string>();
  for (const type of types) {
    const mapped = TYPES[type];
    if (mapped) found.add(mapped);
    else if (mapped === "") continue;
    const base = type.replace(/_restaurant$/, "").replace(/_/g, " ");
    const match = CUISINE_NAMES.find((c) => c.toLowerCase() === base);
    if (match) found.add(match);
  }
  if (found.size === 0 && primary) found.add(primary);
  return [...found].slice(0, 4);
}

function toPlace(place: PlacesApiPlace): PlaceResult {
  return {
    placeId: place.id ?? "",
    name: place.displayName?.text ?? "Unknown place",
    cuisines: toCuisines(place.types ?? [], place.primaryTypeDisplayName?.text),
    ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
    ...(place.googleMapsUri ? { mapUrl: place.googleMapsUri } : {}),
    ...(typeof place.rating === "number" ? { rating: place.rating } : {}),
    ...(priceLabel(place.priceLevel ?? "") ? { price: priceLabel(place.priceLevel!) } : {}),
  };
}

/**
 * Search Google Places, with a 7-day cache and a hard monthly call cap so the
 * free tier can't be exceeded. Returns a typed error when unconfigured/capped.
 */
export async function search(query: string): Promise<PlacesSearch> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "Places search is not configured (missing GOOGLE_PLACES_API_KEY)",
    };
  }

  const s = store();
  const normalized = query.trim().toLowerCase();
  const cacheKey = `places-cache:${hash(normalized)}`;

  const cached = (await s.get(cacheKey, { type: "json" })) as {
    at: number;
    places: PlaceResult[];
  } | null;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ok: true, places: cached.places, cached: true };
  }

  const limit = Number(process.env.PLACES_MONTHLY_LIMIT ?? 5000);
  const usageKey = `places-usage:${new Date().toISOString().slice(0, 7)}`;
  const used = ((await s.get(usageKey, { type: "json" })) as number | null) ?? 0;
  if (used >= limit) {
    return {
      ok: false,
      status: 429,
      error: `Monthly Places search limit reached (${limit}). Try again next month.`,
    };
  }

  const includeRating = process.env.PLACES_INCLUDE_RATING === "true";
  const fieldMask = [
    ...PRO_FIELDS,
    ...(includeRating ? ENTERPRISE_FIELDS : []),
  ].join(",");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify({ textQuery: query.trim(), pageSize: 10, languageCode: "en" }),
  });

  if (!response.ok) {
    // Never log the key; the body may contain Google's error details.
    console.error("Places API error", response.status, await response.text());
    return { ok: false, status: 502, error: "Places search failed" };
  }

  await s.setJSON(usageKey, used + 1);
  const data = (await response.json()) as { places?: PlacesApiPlace[] };
  const places = (data.places ?? [])
    .map(toPlace)
    .filter((p) => p.placeId && p.name !== "Unknown place");

  await s.setJSON(cacheKey, { at: Date.now(), places });
  return { ok: true, places, cached: false };
}
