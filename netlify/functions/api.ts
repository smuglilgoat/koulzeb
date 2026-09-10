import { rankOptions } from "../../shared/decide.ts";
import { isTimeSlot, TIME_SLOTS } from "../../shared/times.ts";
import type {
  Participant,
  PublicParticipant,
  PublicSession,
  Restaurant,
  Session,
  SessionMeta,
} from "../../shared/types.ts";
import * as db from "./lib/store.ts";
import * as places from "./lib/places.ts";

export const config = { path: "/api/*" };

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const bad = (message: string, status = 400) => json({ error: message }, status);

/** Trimmed non-empty string within a length bound, else null. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

/** Array of short strings within a size bound, else null. */
function strArray(
  value: unknown,
  maxItems: number,
  maxLen = 60,
): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  if (!value.every((v) => typeof v === "string" && v.length <= maxLen)) {
    return null;
  }
  return value as string[];
}

async function readJson(
  req: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function publicParticipant(p: Participant): PublicParticipant {
  const { token: _token, ...rest } = p;
  return rest;
}

function publicSession(meta: SessionMeta, session: Session): PublicSession {
  return {
    ...meta,
    participants: session.participants.map(publicParticipant),
    restaurants: session.restaurants,
  };
}

/** Validate and de-duplicate a list of freely chosen 30-minute time slots. */
function parseFreeTimes(raw: unknown): string[] | null {
  const items = strArray(raw, TIME_SLOTS.length, 5);
  if (!items || !items.every(isTimeSlot)) return null;
  return [...new Set(items)].sort();
}

/** Resolve the caller from their id + token headers, if valid. */
async function auth(req: Request, sid: string): Promise<Participant | null> {
  const pid = req.headers.get("x-participant-id");
  const token = req.headers.get("x-participant-token");
  if (!pid || !token) return null;
  const participant = await db.getParticipant(sid, pid);
  return participant && participant.token === token ? participant : null;
}

export default async (req: Request, _context: unknown): Promise<Response> => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const [, resource, sid, action, rid] = parts;

  try {
    if (resource !== "sessions") return bad("Not found", 404);

    // POST /api/sessions
    if (!sid && req.method === "POST") {
      const body = await readJson(req);
      const name = body && str(body.name, 80);
      const hostName = body && str(body.hostName, 40);
      const location = body && str(body.location, 80);
      if (!name || !hostName) {
        return bad("A session name and your name are required");
      }

      const sessionId = crypto.randomUUID();
      const host: Participant = {
        id: crypto.randomUUID(),
        name: hostName,
        token: crypto.randomUUID(),
        joinedAt: Date.now(),
        freeTimes: [],
        cuisinePrefs: [],
        suggestedRestaurantIds: [],
      };
      const meta: SessionMeta = {
        id: sessionId,
        name,
        createdAt: Date.now(),
        hostId: host.id,
        status: "collecting",
        ...(location ? { location } : {}),
      };
      await db.createSession(meta, host);
      return json(
        { sessionId, participantId: host.id, token: host.token },
        201,
      );
    }

    if (!sid) return bad("Not found", 404);
    const meta = await db.getSessionMeta(sid);
    if (!meta) return bad("Session not found", 404);

    // POST /api/sessions/:id/participants
    if (action === "participants" && req.method === "POST") {
      const body = await readJson(req);
      const name = body && str(body.name, 40);
      if (!name) return bad("Your name is required");
      const participant: Participant = {
        id: crypto.randomUUID(),
        name,
        token: crypto.randomUUID(),
        joinedAt: Date.now(),
        freeTimes: [],
        cuisinePrefs: [],
        suggestedRestaurantIds: [],
      };
      await db.addParticipant(sid, participant);
      return json(
        { participantId: participant.id, token: participant.token },
        201,
      );
    }

    // GET /api/sessions/:id
    if (!action && req.method === "GET") {
      const session = await db.getFullSession(sid);
      if (!session) return bad("Session not found", 404);
      const results = rankOptions(session.restaurants, session.participants);
      return json({ session: publicSession(meta, session), results });
    }

    const me = await auth(req, sid);

    // GET /api/sessions/:id/places  -> candidates from the caller's cuisines
    if (action === "places" && req.method === "GET") {
      if (!me) return bad("You are not a participant in this session", 403);
      if (me.cuisinePrefs.length === 0) {
        return json({ location: meta.location ?? "", groups: [], cached: true });
      }
      if (!meta.location) {
        return bad("Set a location for this dinner first", 409);
      }
      const result = await places.candidates(me.cuisinePrefs, meta.location);
      if (!result.ok) return bad(result.error, result.status);
      return json({
        location: meta.location,
        groups: result.groups,
        cached: result.cached,
      });
    }

    // PATCH /api/sessions/:id  -> set the dinner location
    if (!action && req.method === "PATCH") {
      if (!me) return bad("You are not a participant in this session", 403);
      const body = await readJson(req);
      const newLocation = body && str(body.location, 80);
      if (!newLocation) return bad("A location is required");
      meta.location = newLocation;
      await db.saveSessionMeta(meta);
      return json({ location: meta.location });
    }

    // PATCH /api/sessions/:id/me
    if (action === "me" && req.method === "PATCH") {
      if (!me) return bad("You are not a participant in this session", 403);
      const body = await readJson(req);
      if (!body) return bad("Invalid request body");

      if (body.freeTimes !== undefined) {
        const times = parseFreeTimes(body.freeTimes);
        if (!times) return bad("Invalid free times");
        me.freeTimes = times;
      }
      if (body.cuisinePrefs !== undefined) {
        const cuisines = strArray(body.cuisinePrefs, 30, 40);
        if (!cuisines) return bad("Invalid cuisine preferences");
        me.cuisinePrefs = cuisines;
      }
      await db.addParticipant(sid, me);
      return json({ participant: publicParticipant(me) });
    }

    // POST /api/sessions/:id/restaurants
    if (action === "restaurants" && !rid && req.method === "POST") {
      if (!me) return bad("You are not a participant in this session", 403);
      const body = await readJson(req);
      const name = body && str(body.name, 80);
      const cuisines = body && strArray(body.cuisines, 10, 40);
      if (!name || !cuisines) {
        return bad("A restaurant name and cuisines are required");
      }
      const address = body && str(body.address, 160);
      const mapUrl = body && str(body.mapUrl, 300);
      if (mapUrl && !/^https?:\/\//i.test(mapUrl)) {
        return bad("The map link must be an http(s) URL");
      }
      const restaurant: Restaurant = {
        id: crypto.randomUUID(),
        name,
        cuisines,
        addedBy: me.id,
        ...(address ? { address } : {}),
        ...(mapUrl ? { mapUrl } : {}),
        ...(body?.halal === true ? { halal: true } : {}),
        ...(body?.vege === true ? { vege: true } : {}),
      };
      await db.addRestaurant(sid, restaurant);
      me.suggestedRestaurantIds.push(restaurant.id);
      await db.addParticipant(sid, me);
      return json({ restaurant }, 201);
    }

    // PATCH /api/sessions/:id/restaurants/:rid
    if (action === "restaurants" && rid && req.method === "PATCH") {
      if (!me) return bad("You are not a participant in this session", 403);
      const existing = await db.getRestaurant(sid, rid);
      if (!existing) return bad("Restaurant not found", 404);
      const body = await readJson(req);
      const name = body && str(body.name, 80);
      const cuisines = body && strArray(body.cuisines, 10, 40);
      if (!name || !cuisines) {
        return bad("A restaurant name and cuisines are required");
      }
      const address = body && str(body.address, 160);
      const mapUrl = body && str(body.mapUrl, 300);
      if (mapUrl && !/^https?:\/\//i.test(mapUrl)) {
        return bad("The map link must be an http(s) URL");
      }
      const updated: Restaurant = {
        ...existing,
        name,
        cuisines,
        address: address ?? undefined,
        mapUrl: mapUrl ?? undefined,
        halal: body?.halal === true ? true : undefined,
        vege: body?.vege === true ? true : undefined,
      };
      await db.addRestaurant(sid, updated);
      return json({ restaurant: updated });
    }

    // POST /api/sessions/:id/decision  (host only)
    if (action === "decision" && req.method === "POST") {
      if (!me) return bad("You are not a participant in this session", 403);
      if (me.id !== meta.hostId) return bad("Only the host can decide", 403);
      const body = await readJson(req);
      const restaurantId = body && str(body.restaurantId, 64);
      const time = body && str(body.time, 5);
      const restaurants = await db.listRestaurants(sid);
      if (!restaurantId || !restaurants.some((r) => r.id === restaurantId)) {
        return bad("Unknown restaurant");
      }
      const participants = await db.listParticipants(sid);
      const times = new Set(participants.flatMap((p) => p.freeTimes));
      if (!time || !isTimeSlot(time) || !times.has(time)) {
        return bad("Unknown time");
      }
      meta.decision = {
        restaurantId,
        time,
        decidedAt: Date.now(),
      };
      meta.status = "decided";
      await db.saveSessionMeta(meta);
      return json({ decision: meta.decision });
    }

    return bad("Not found", 404);
  } catch (error) {
    console.error("KoulZeb API error", error);
    return bad("Something went wrong", 500);
  }
};
