import type {
  PlaceResult,
  PublicParticipant,
  PublicSession,
  RankedOption,
  Restaurant,
} from "../shared/types.ts";
import type { Identity } from "./state.ts";

export class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new ApiError(message);
  }
  return data as T;
}

const auth = (identity: Identity): Record<string, string> => ({
  "x-participant-id": identity.participantId,
  "x-participant-token": identity.token,
});

export type SessionData = {
  session: PublicSession;
  results: RankedOption[];
};

export const api = {
  createSession(input: {
    name: string;
    hostName: string;
    location?: string;
  }) {
    return request<{
      sessionId: string;
      participantId: string;
      token: string;
    }>("/sessions", { method: "POST", body: JSON.stringify(input) });
  },

  getSession(sid: string) {
    return request<SessionData>(`/sessions/${sid}`);
  },

  join(sid: string, name: string) {
    return request<{ participantId: string; token: string }>(
      `/sessions/${sid}/participants`,
      { method: "POST", body: JSON.stringify({ name }) },
    );
  },

  saveMe(
    sid: string,
    identity: Identity,
    patch: { freeTimes?: string[]; cuisinePrefs?: string[] },
  ) {
    return request<{ participant: PublicParticipant }>(
      `/sessions/${sid}/me`,
      {
        method: "PATCH",
        headers: auth(identity),
        body: JSON.stringify(patch),
      },
    );
  },

  addRestaurant(
    sid: string,
    identity: Identity,
    input: {
      name: string;
      cuisines: string[];
      address?: string;
      mapUrl?: string;
      halal?: boolean;
      vege?: boolean;
    },
  ) {
    return request<{ restaurant: Restaurant }>(
      `/sessions/${sid}/restaurants`,
      {
        method: "POST",
        headers: auth(identity),
        body: JSON.stringify(input),
      },
    );
  },

  editRestaurant(
    sid: string,
    identity: Identity,
    restaurantId: string,
    input: {
      name: string;
      cuisines: string[];
      address?: string;
      mapUrl?: string;
      halal?: boolean;
      vege?: boolean;
    },
  ) {
    return request<{ restaurant: Restaurant }>(
      `/sessions/${sid}/restaurants/${restaurantId}`,
      {
        method: "PATCH",
        headers: auth(identity),
        body: JSON.stringify(input),
      },
    );
  },

  decide(
    sid: string,
    identity: Identity,
    input: { restaurantId: string; time: string },
  ) {
    return request<{ decision: unknown }>(`/sessions/${sid}/decision`, {
      method: "POST",
      headers: auth(identity),
      body: JSON.stringify(input),
    });
  },

  getCandidates(sid: string, identity: Identity) {
    return request<{
      location: string;
      groups: { tag: string; places: PlaceResult[] }[];
      cached: boolean;
    }>(`/sessions/${sid}/places`, { headers: auth(identity) });
  },

  setLocation(sid: string, identity: Identity, location: string) {
    return request<{ location: string }>(`/sessions/${sid}`, {
      method: "PATCH",
      headers: auth(identity),
      body: JSON.stringify({ location }),
    });
  },
};
