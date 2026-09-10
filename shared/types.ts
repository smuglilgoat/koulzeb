export type Restaurant = {
  id: string;
  name: string;
  cuisines: string[];
  address?: string;
  /** Explicit Google Maps (or other http(s)) link; falls back to a search. */
  mapUrl?: string;
  notes?: string;
  rating?: number;
  price?: string;
  /** Serves halal food (best-effort indicator). */
  halal?: boolean;
  /** Vegetarian-friendly (best-effort indicator). */
  vege?: boolean;
  addedBy: string;
};

export type Participant = {
  id: string;
  name: string;
  /** Secret proving identity. Never sent to other clients in session views. */
  token: string;
  joinedAt: number;
  /** Times of day ("HH:MM", 30-minute slots) the participant is free. */
  freeTimes: string[];
  cuisinePrefs: string[];
  suggestedRestaurantIds: string[];
};

export type Decision = {
  restaurantId: string;
  /** Time of day of the decided slot ("HH:MM"). */
  time: string;
  decidedAt: number;
};

export type SessionMeta = {
  id: string;
  name: string;
  createdAt: number;
  hostId: string;
  status: "collecting" | "decided";
  decision?: Decision;
};

export type Session = SessionMeta & {
  participants: Participant[];
  restaurants: Restaurant[];
};

/** A participant as exposed to other clients (token redacted). */
export type PublicParticipant = Omit<Participant, "token">;

export type PublicSession = SessionMeta & {
  participants: PublicParticipant[];
  restaurants: Restaurant[];
};

export type RankedOption = {
  /** Time of day ("HH:MM"). */
  time: string;
  restaurant: Restaurant;
  /** Number of participants free at this time. */
  freeCount: number;
  /** Of those free, how many listed a cuisine this restaurant serves. */
  matchedCount: number;
  attendees: string[];
};
