/**
 * End-to-end smoke test for the KoulZeb API.
 * Requires a running server (default `netlify dev` on :8888).
 *   node scripts/smoke.mjs        (or: npm run smoke)
 */
const BASE = process.env.BASE ?? "http://localhost:8888";

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let passed = 0;
function check(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  passed++;
  console.log(`ok - ${message}`);
}

const slot = (iso) => new Date(iso).toISOString();

const created = await call("POST", "/api/sessions", {
  name: "Smoke dinner",
  hostName: "Host",
  timeSlots: [slot("2026-09-11T19:00:00Z"), slot("2026-09-12T19:00:00Z")],
});
check(created.status === 201, "create session returns 201");
const { sessionId, participantId: hostId, token: hostToken } = created.data;
check(!!sessionId && !!hostId && !!hostToken, "create returns session and host credentials");

const joined = await call("POST", `/api/sessions/${sessionId}/participants`, {
  name: "Guest",
});
check(joined.status === 201, "guest joins");
const { participantId: guestId, token: guestToken } = joined.data;

const badAuth = await call(
  "PATCH",
  `/api/sessions/${sessionId}/me`,
  { cuisinePrefs: ["Thai"] },
  { "x-participant-id": hostId, "x-participant-token": "wrong" },
);
check(badAuth.status === 403, "rejects a bad participant token");

const hostSaved = await call(
  "PATCH",
  `/api/sessions/${sessionId}/me`,
  { availableSlotIds: ["t1"], cuisinePrefs: ["Italian"] },
  { "x-participant-id": hostId, "x-participant-token": hostToken },
);
check(hostSaved.status === 200, "host saves choices");

const guestSaved = await call(
  "PATCH",
  `/api/sessions/${sessionId}/me`,
  { availableSlotIds: ["t1", "t2"], cuisinePrefs: ["Japanese"] },
  { "x-participant-id": guestId, "x-participant-token": guestToken },
);
check(guestSaved.status === 200, "guest saves choices");

const r1 = await call(
  "POST",
  `/api/sessions/${sessionId}/restaurants`,
  { name: "Sushi Place", cuisines: ["Japanese"] },
  { "x-participant-id": hostId, "x-participant-token": hostToken },
);
check(r1.status === 201, "host adds a restaurant");

const r2 = await call(
  "POST",
  `/api/sessions/${sessionId}/restaurants`,
  { name: "Pasta Place", cuisines: ["Italian"] },
  { "x-participant-id": guestId, "x-participant-token": guestToken },
);
check(r2.status === 201, "guest adds a restaurant");

const fetched = await call("GET", `/api/sessions/${sessionId}`);
check(fetched.status === 200, "fetch session");
check(
  fetched.data.session.participants.length === 2,
  "session lists both participants",
);
check(
  !JSON.stringify(fetched.data.session).includes('"token"'),
  "participant tokens are never exposed",
);
const top = fetched.data.results[0];
check(
  top.freeCount === 2 && top.matchedCount === 1,
  "top option crosses both free people with one cuisine match",
);
check(
  fetched.data.results.every((o) => o.timeSlot.id === "t1" || o.timeSlot.id === "t2"),
  "results cover both proposed times",
);

const guestDecide = await call(
  "POST",
  `/api/sessions/${sessionId}/decision`,
  { restaurantId: r1.data.restaurant.id, timeSlotId: "t1" },
  { "x-participant-id": guestId, "x-participant-token": guestToken },
);
check(guestDecide.status === 403, "non-host cannot decide");

const hostDecide = await call(
  "POST",
  `/api/sessions/${sessionId}/decision`,
  { restaurantId: r1.data.restaurant.id, timeSlotId: "t1" },
  { "x-participant-id": hostId, "x-participant-token": hostToken },
);
check(hostDecide.status === 200, "host decides");

const final = await call("GET", `/api/sessions/${sessionId}`);
check(final.data.session.status === "decided", "session is marked decided");
check(
  final.data.session.decision?.restaurantId === r1.data.restaurant.id,
  "decision persists the chosen restaurant",
);

console.log(`\nAll ${passed} checks passed.`);
