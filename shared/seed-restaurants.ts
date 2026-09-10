import type { Restaurant } from "./types.ts";

/**
 * Starter list copied into every new session so the group has somewhere to
 * begin. Cuisines use the canonical tags from `cuisines.ts` so they intersect
 * with participants' preferences. `halal`/`vege` are best-effort indicators —
 * verify before relying on them.
 */
export type SeedRestaurant = {
  id: string;
  name: string;
  cuisines: string[];
  rating?: number;
  price?: string;
  halal?: boolean;
  vege?: boolean;
};

export const SEED_RESTAURANTS: SeedRestaurant[] = [
  { id: "bises-nouilles", name: "Bises Nouilles", cuisines: ["Ramen", "Noodles"], rating: 4.7, price: "10–20 €" },
  { id: "saz-durum-lahmacun", name: "SAZ Durum & Lahmacun", cuisines: ["Turkish", "Middle Eastern"], rating: 4.7, price: "10–20 €", halal: true },
  { id: "foujita", name: "Foujita", cuisines: ["Japanese", "Ramen"], rating: 4.2, price: "20–30 €" },
  { id: "slak", name: "Slak", cuisines: ["Turkish"], rating: 4.3, price: "1–20 €", halal: true },
  { id: "la-table-de-yemma", name: "La Table de Yemma", cuisines: ["African", "Middle Eastern"], rating: 4.5, price: "10–20 €", halal: true },
  { id: "ukiyo-ramen-pigalle", name: "UKIYO RAMEN PIGALLE", cuisines: ["Ramen", "Japanese"], rating: 4.8, price: "20–30 €" },
  { id: "txuan", name: "T’Xuan", cuisines: ["Dessert"], rating: 4.5, price: "10–20 €" },
  { id: "lai-lai-ken", name: "Laï-Laï Ken", cuisines: ["Japanese"], rating: 4.6, price: "10–20 €" },
  { id: "junk-legendre", name: "Junk Legendre", cuisines: ["Burger"], rating: 4.5, price: "10–20 €" },
  { id: "aki-boulangerie", name: "Aki Boulangerie", cuisines: ["Bakery", "Japanese"], rating: 4.5, price: "1–10 €" },
  { id: "muqam", name: "Muqam", cuisines: ["Uyghur", "Noodles"], rating: 4.5, price: "20–30 €", halal: true },
  { id: "distrito-frances-saint-martin", name: "Distrito Francés Saint Martin", cuisines: ["Mexican"], rating: 4.6, price: "10–20 €" },
  { id: "kuma-marais", name: "KUMA - Marais", cuisines: ["Japanese", "Ramen"], rating: 4.8, price: "10–20 €" },
  { id: "mangez-et-cassez-vous", name: "Mangez et cassez-vous", cuisines: ["Burger"], rating: 4.6, price: "1–10 €" },
  { id: "kuma-cadet", name: "KUMA - Cadet", cuisines: ["Japanese", "Ramen"], rating: 4.8, price: "10–20 €" },
  { id: "jjan", name: "JJAN! 짠", cuisines: ["Korean"], rating: 4.3, price: "20–30 €" },
  { id: "neko-ramen", name: "Neko Ramen", cuisines: ["Ramen"], rating: 4.4, price: "10–20 €" },
  { id: "takesan-donabe-ramen-opera", name: "Takesan Donabe Ramen Opéra", cuisines: ["Ramen"], rating: 4.7, price: "10–20 €" },
  { id: "restaurant-chez-aicha", name: "Restaurant Chez Aicha", cuisines: ["African", "Middle Eastern"], rating: 4.5, price: "10–20 €", halal: true },
  { id: "chez-haki-noodles-dumpling", name: "CHEZ HAKI Noodles & Dumpling", cuisines: ["Noodles", "Chinese"], rating: 4.7, price: "10–20 €" },
  { id: "chez-ancien-boulogne", name: "Chez L'ancien Boulogne", cuisines: ["French"], rating: 4.2, price: "10–20 €" },
  { id: "big-black-cook", name: "Big Black Cook", cuisines: ["Caribbean"], rating: 4.8, price: "10–20 €" },
  { id: "bollynan-montorgueil", name: "Bollynan streetfood indienne - Montorgueil", cuisines: ["Indian"], rating: 4.7, price: "10–20 €", vege: true },
  { id: "maker", name: "Maker", cuisines: ["Mediterranean"], rating: 4.4, price: "10–20 €" },
  { id: "mian", name: "Mian (面)", cuisines: ["Chinese", "Noodles"], rating: 4.9, price: "10–20 €" },
  { id: "montmartre-cafe", name: "Montmartre café - Café Montmartre Paris 9", cuisines: ["Cafe"], rating: 4.7, price: "10–20 €" },
  { id: "momo-house", name: "MoMo House", cuisines: ["Noodles", "Chinese"], rating: 4.6, price: "10–20 €" },
  { id: "aki-restaurant", name: "Aki Restaurant", cuisines: ["Japanese"], rating: 4.4, price: "10–20 €" },
  { id: "comme-un-bouillon", name: "Comme un Bouillon", cuisines: ["French"], rating: 4.4, price: "10–20 €" },
  { id: "baos", name: "Bao's", cuisines: ["Chinese"], rating: 4.2, price: "1–10 €" },
  { id: "naniwa-ya", name: "Naniwa-Ya", cuisines: ["Japanese", "Ramen"], rating: 4.4, price: "10–20 €" },
  { id: "kodawari-ramen-yokocho", name: "Kodawari Ramen (Yokochō)", cuisines: ["Ramen", "Japanese"], rating: 4.5, price: "20–30 €" },
  { id: "kodawari-ramen-tsukiji", name: "Kodawari Ramen (Tsukiji)", cuisines: ["Ramen", "Japanese"], rating: 4.4, price: "20–30 €" },
  { id: "sushi-et-moi", name: "Sushi et Moi (formule à volonté)", cuisines: ["Sushi", "Japanese"], rating: 4.0, price: "10–20 €" },
  { id: "glace-room", name: "Glace Room & family café", cuisines: ["Ice Cream", "Dessert", "Cafe"], rating: 4.7 },
  { id: "dong-ne-chicken", name: "Dong Né Chicken", cuisines: ["Korean"], rating: 4.5, price: "10–20 €" },
];

export const DEFAULT_RESTAURANTS: Restaurant[] = SEED_RESTAURANTS.map((r) => ({
  id: r.id,
  name: r.name,
  cuisines: r.cuisines,
  addedBy: "default",
  ...(r.rating !== undefined ? { rating: r.rating } : {}),
  ...(r.price !== undefined ? { price: r.price } : {}),
  ...(r.halal ? { halal: true } : {}),
  ...(r.vege ? { vege: true } : {}),
}));
