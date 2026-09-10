import { test } from "node:test";
import assert from "node:assert/strict";
import { rankOptions } from "../shared/decide.ts";
import type { Participant, Restaurant, TimeSlot } from "../shared/types.ts";

const slot = (id: string): TimeSlot => ({ id, start: `2026-09-1${id}T19:00:00Z` });
const person = (
  id: string,
  available: string[],
  cuisines: string[],
): Participant => ({
  id,
  name: id,
  token: "t",
  joinedAt: 0,
  availableSlotIds: available,
  cuisinePrefs: cuisines,
  suggestedRestaurantIds: [],
});
const place = (id: string, cuisines: string[], openSlotIds?: string[]): Restaurant => ({
  id,
  name: id,
  cuisines,
  addedBy: "host",
  ...(openSlotIds ? { openSlotIds } : {}),
});

test("empty inputs yield no options", () => {
  assert.deepEqual(rankOptions([], [], []), []);
});

test("matches a restaurant to a free participant who likes its cuisine", () => {
  const options = rankOptions(
    [slot("1")],
    [place("sushi", ["Japanese"])],
    [person("a", ["1"], ["Japanese"])],
  );
  assert.equal(options.length, 1);
  assert.equal(options[0].freeCount, 1);
  assert.equal(options[0].matchedCount, 1);
  assert.deepEqual(options[0].attendees, ["a"]);
});

test("only counts free participants toward a time's cuisine match", () => {
  const options = rankOptions(
    [slot("1")],
    [place("sushi", ["Japanese"])],
    [person("a", ["1"], ["Japanese"]), person("b", [], ["Japanese"])],
  );
  assert.equal(options[0].freeCount, 1);
  assert.equal(options[0].matchedCount, 1);
});

test("empty cuisine preferences are neutral, not a match", () => {
  const options = rankOptions(
    [slot("1")],
    [place("sushi", ["Japanese"])],
    [person("a", ["1"], [])],
  );
  assert.equal(options[0].freeCount, 1);
  assert.equal(options[0].matchedCount, 0);
});

test("opening-hours constraint excludes a restaurant from that slot", () => {
  const options = rankOptions(
    [slot("1"), slot("2")],
    [place("brunch", ["French"], ["2"])],
    [person("a", ["1", "2"], ["French"])],
  );
  assert.equal(options.length, 1);
  assert.equal(options[0].timeSlot.id, "2");
});

test("ranks the time with more free people first", () => {
  const options = rankOptions(
    [slot("1"), slot("2")],
    [place("sushi", ["Japanese"])],
    [
      person("a", ["1"], ["Japanese"]),
      person("b", ["1", "2"], ["Japanese"]),
    ],
  );
  assert.deepEqual(
    options.map((o) => [o.timeSlot.id, o.freeCount, o.matchedCount]),
    [
      ["1", 2, 2],
      ["2", 1, 1],
    ],
  );
});

test("breaks ties on name for a stable order", () => {
  const options = rankOptions(
    [slot("1")],
    [place("zeta", ["Thai"]), place("alpha", ["Thai"])],
    [person("a", ["1"], ["Thai"])],
  );
  assert.deepEqual(
    options.map((o) => o.restaurant.name),
    ["alpha", "zeta"],
  );
});

test("no free participants still returns ranked pairs", () => {
  const options = rankOptions(
    [slot("1")],
    [place("sushi", ["Japanese"])],
    [person("a", [], ["Japanese"])],
  );
  assert.equal(options.length, 1);
  assert.equal(options[0].freeCount, 0);
  assert.equal(options[0].matchedCount, 0);
});
