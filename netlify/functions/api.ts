import { normalizeTime, rankOptions } from "../../shared/decide.ts";
import type {
  Participant,
  PublicParticipant,
  PublicSession,
  Restaurant,
  Session,
  SessionMeta,
} from "../../shared/types.ts";
import * as db from "./lib/store.ts";

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

/** Parse, validate and de-duplicate a list of freely chosen times. */
function parseFreeTimes(raw: unknown): string[] | null {
  const items = strArray(raw, 40, 40);
  if (!items) return null;
  const times: string[] = [];
  for (const item of items) {
    const ms = Date.parse(item);
    if (Number.isNaN(ms)) return null;
    times.push(new Date(Math.floor(ms / 60000) * 60000).toISOString());
  }
  return [...new Set(times)].sort();
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
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const [, resource, sid, action] = parts;

  try {
    if (resource !== "sessions") return bad("Not found", 404);

    // POST /api/sessions
    if (!sid && req.method === "POST") {
      const body = await readJson(req);
      const name = body && str(body.name, 80);
      const hostName = body && str(body.hostName, 40);
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
    if (action === "restaurants" && req.method === "POST") {
      if (!me) return bad("You are not a participant in this session", 403);
      const body = await readJson(req);
      const name = body && str(body.name, 80);
      const cuisines = body && strArray(body.cuisines, 10, 40);
      if (!name || !cuisines) {
        return bad("A restaurant name and cuisines are required");
      }
      const address = body && str(body.address, 160);
      const restaurant: Restaurant = {
        id: crypto.randomUUID(),
        name,
        cuisines,
        addedBy: me.id,
        ...(address ? { address } : {}),
        ...(body?.halal === true ? { halal: true } : {}),
        ...(body?.vege === true ? { vege: true } : {}),
      };
      await db.addRestaurant(sid, restaurant);
      me.suggestedRestaurantIds.push(restaurant.id);
      await db.addParticipant(sid, me);
      return json({ restaurant }, 201);
    }

    // POST /api/sessions/:id/decision  (host only)
    if (action === "decision" && req.method === "POST") {
      if (!me) return bad("You are not a participant in this session", 403);
      if (me.id !== meta.hostId) return bad("Only the host can decide", 403);
      const body = await readJson(req);
      const restaurantId = body && str(body.restaurantId, 64);
      const time = body && str(body.time, 40);
      const restaurants = await db.listRestaurants(sid);
      if (!restaurantId || !restaurants.some((r) => r.id === restaurantId)) {
        return bad("Unknown restaurant");
      }
      const participants = await db.listParticipants(sid);
      const times = new Set(
        participants.flatMap((p) => p.freeTimes),
      );
      if (!time || !times.has(normalizeTime(time))) {
        return bad("Unknown time");
      }
      meta.decision = {
        restaurantId,
        time: normalizeTime(time),
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
