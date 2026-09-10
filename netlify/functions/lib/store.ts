import { getStore } from "@netlify/blobs";
import type {
  Participant,
  Restaurant,
  Session,
  SessionMeta,
} from "../../../shared/types.ts";
import { DEFAULT_RESTAURANTS } from "../../../shared/seed-restaurants.ts";

const sessionKey = (sid: string) => `s:${sid}`;
const participantKey = (sid: string, pid: string) => `p:${sid}:${pid}`;
const restaurantKey = (sid: string, rid: string) => `r:${sid}:${rid}`;

/**
 * Strong consistency so a participant polling right after someone saves their
 * choices sees them immediately.
 */
function store() {
  return getStore({ name: "koulzeb", consistency: "strong" });
}

export async function createSession(
  meta: SessionMeta,
  host: Participant,
): Promise<void> {
  const s = store();
  await s.setJSON(sessionKey(meta.id), meta);
  await s.setJSON(participantKey(meta.id, host.id), host);
  // Seed the starter restaurant list into the new session.
  await Promise.all(
    DEFAULT_RESTAURANTS.map((r) => s.setJSON(restaurantKey(meta.id, r.id), r)),
  );
}

export async function getSessionMeta(sid: string): Promise<SessionMeta | null> {
  return (await store().get(sessionKey(sid), { type: "json" })) as
    | SessionMeta
    | null;
}

export async function saveSessionMeta(meta: SessionMeta): Promise<void> {
  await store().setJSON(sessionKey(meta.id), meta);
}

export async function addParticipant(
  sid: string,
  participant: Participant,
): Promise<void> {
  await store().setJSON(participantKey(sid, participant.id), participant);
}

export async function getParticipant(
  sid: string,
  pid: string,
): Promise<Participant | null> {
  return (await store().get(participantKey(sid, pid), { type: "json" })) as
    | Participant
    | null;
}

export async function listParticipants(sid: string): Promise<Participant[]> {
  const s = store();
  const { blobs } = await s.list({ prefix: `p:${sid}:` });
  const docs = await Promise.all(
    blobs.map((b) => s.get(b.key, { type: "json" })),
  );
  return docs.filter(Boolean) as Participant[];
}

export async function addRestaurant(
  sid: string,
  restaurant: Restaurant,
): Promise<void> {
  await store().setJSON(restaurantKey(sid, restaurant.id), restaurant);
}

export async function listRestaurants(sid: string): Promise<Restaurant[]> {
  const s = store();
  const { blobs } = await s.list({ prefix: `r:${sid}:` });
  const docs = await Promise.all(
    blobs.map((b) => s.get(b.key, { type: "json" })),
  );
  return docs.filter(Boolean) as Restaurant[];
}

export async function getFullSession(sid: string): Promise<Session | null> {
  const meta = await getSessionMeta(sid);
  if (!meta) return null;
  const [participants, restaurants] = await Promise.all([
    listParticipants(sid),
    listRestaurants(sid),
  ]);
  return { ...meta, participants, restaurants };
}
