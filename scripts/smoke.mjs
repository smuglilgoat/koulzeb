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

const T1 = "19:00";
const T2 = "20:00";
const auth = (id, token) => ({
  "x-participant-id": id,
  "x-participant-token": token,
});

const created = await call("POST", "/api/sessions", {
  name: "Smoke dinner",
  hostName: "Host",
});
check(created.status === 201, "create session returns 201 (no host-chosen times)");
const { sessionId, participantId: hostId, token: hostToken } = created.data;

const joined = await call("POST", `/api/sessions/${sessionId}/participants`, {
  name: "Guest",
});
check(joined.status === 201, "guest joins");
const { participantId: guestId, token: guestToken } = joined.data;

const badAuth = await call(
  "PATCH",
  `/api/sessions/${sessionId}/me`,
  { cuisinePrefs: ["Thai"] },
  auth(hostId, "wrong"),
);
check(badAuth.status === 403, "rejects a bad participant token");

const badTime = await call(
  "PATCH",
  `/api/sessions/${sessionId}/me`,
  { freeTimes: ["19:15"] },
  auth(hostId, hostToken),
);
check(badTime.status === 400, "rejects a time that is not a 30-minute slot");

const hostSaved = await call(
  "PATCH",
  `/api/sessions/${sessionId}/me`,
  { freeTimes: [T1], cuisinePrefs: ["Italian"] },
  auth(hostId, hostToken),
);
check(hostSaved.status === 200, "host saves freely chosen times and cuisines");

const guestSaved = await call(
  "PATCH",
  `/api/sessions/${sessionId}/me`,
  { freeTimes: [T1, T2], cuisinePrefs: ["Japanese"] },
  auth(guestId, guestToken),
);
check(guestSaved.status === 200, "guest saves freely chosen times and cuisines");

const r1 = await call(
  "POST",
  `/api/sessions/${sessionId}/restaurants`,
  { name: "Sushi Place", cuisines: ["Japanese"], halal: true },
  auth(hostId, hostToken),
);
check(r1.status === 201, "host adds a restaurant");
check(r1.data.restaurant.halal === true, "halal indicator persists");

const r2 = await call(
  "POST",
  `/api/sessions/${sessionId}/restaurants`,
  { name: "Pasta Place", cuisines: ["Italian"], vege: true },
  auth(guestId, guestToken),
);
check(r2.status === 201, "guest adds a restaurant");
check(r2.data.restaurant.vege === true, "vege indicator persists");

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

const optionAt = (name, time) =>
  fetched.data.results.find(
    (o) => o.restaurant.name === name && o.time === time,
  );
const sushi = optionAt("Sushi Place", T1);
const pasta = optionAt("Pasta Place", T1);
check(!!sushi && sushi.freeCount === 2 && sushi.matchedCount === 1,
  "Sushi Place at T1 crosses both free people with the guest's Japanese match");
check(!!pasta && pasta.freeCount === 2 && pasta.matchedCount === 1,
  "Pasta Place at T1 crosses both free people with the host's Italian match");
check(
  fetched.data.results.some((o) => o.time === T2),
  "results include a time only one person is free at",
);

const noAuthPlaces = await call(
  "GET",
  `/api/sessions/${sessionId}/places?q=ramen`,
);
check(noAuthPlaces.status === 403, "places search requires a participant");

const shortPlaces = await call(
  "GET",
  `/api/sessions/${sessionId}/places?q=a`,
  undefined,
  auth(hostId, hostToken),
);
check(shortPlaces.status === 400, "places search rejects a too-short query");

const placesSearch = await call(
  "GET",
  `/api/sessions/${sessionId}/places?q=ramen`,
  undefined,
  auth(hostId, hostToken),
);
check(
  [200, 503].includes(placesSearch.status),
  "places search succeeds or reports itself unconfigured (no API key)",
);

const badMap = await call(
  "PATCH",
  `/api/sessions/${sessionId}/restaurants/${r1.data.restaurant.id}`,
  { name: "Sushi Place", cuisines: ["Japanese"], mapUrl: "javascript:alert(1)" },
  auth(hostId, hostToken),
);
check(badMap.status === 400, "rejects a non-http map link");

const edited = await call(
  "PATCH",
  `/api/sessions/${sessionId}/restaurants/${r1.data.restaurant.id}`,
  {
    name: "Sushi Place 2",
    cuisines: ["Japanese", "Sushi"],
    address: "1 Rue Test",
    mapUrl: "https://maps.app.goo.gl/xyz",
    vege: true,
  },
  auth(hostId, hostToken),
);
check(edited.status === 200, "participant edits a restaurant");
check(
  edited.data.restaurant.name === "Sushi Place 2" &&
    edited.data.restaurant.mapUrl === "https://maps.app.goo.gl/xyz" &&
    edited.data.restaurant.vege === true &&
    edited.data.restaurant.address === "1 Rue Test",
  "edit persists name, cuisines, address, map link and vege",
);
check(
  edited.data.restaurant.halal === undefined,
  "unchecked halal is cleared on edit",
);

const guestDecide = await call(
  "POST",
  `/api/sessions/${sessionId}/decision`,
  { restaurantId: r1.data.restaurant.id, time: T1 },
  auth(guestId, guestToken),
);
check(guestDecide.status === 403, "non-host cannot decide");

const hostDecide = await call(
  "POST",
  `/api/sessions/${sessionId}/decision`,
  { restaurantId: r1.data.restaurant.id, time: T1 },
  auth(hostId, hostToken),
);
check(hostDecide.status === 200, "host decides");

const final = await call("GET", `/api/sessions/${sessionId}`);
check(final.data.session.status === "decided", "session is marked decided");
check(
  final.data.session.decision?.restaurantId === r1.data.restaurant.id &&
    final.data.session.decision?.time === T1,
  "decision persists the chosen restaurant and time",
);

console.log(`\nAll ${passed} checks passed.`);
