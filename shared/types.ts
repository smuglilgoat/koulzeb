export type TimeSlot = {
  id: string;
  /** ISO-8601 timestamp (UTC). Rendered in the viewer's local timezone. */
  start: string;
  label?: string;
};

export type Restaurant = {
  id: string;
  name: string;
  cuisines: string[];
  address?: string;
  notes?: string;
  /** When set, the restaurant is only considered for these time slots. */
  openSlotIds?: string[];
  addedBy: string;
};

export type Participant = {
  id: string;
  name: string;
  /** Secret proving identity. Never sent to other clients in session views. */
  token: string;
  joinedAt: number;
  availableSlotIds: string[];
  cuisinePrefs: string[];
  suggestedRestaurantIds: string[];
};

export type Decision = {
  restaurantId: string;
  timeSlotId: string;
  decidedAt: number;
};

export type SessionMeta = {
  id: string;
  name: string;
  createdAt: number;
  hostId: string;
  status: "collecting" | "decided";
  timeSlots: TimeSlot[];
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
  timeSlot: TimeSlot;
  restaurant: Restaurant;
  /** Number of participants free at this time slot. */
  freeCount: number;
  /** Of those free, how many listed a cuisine this restaurant serves. */
  matchedCount: number;
  attendees: string[];
};
