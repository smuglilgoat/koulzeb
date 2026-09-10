import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTime, rankOptions } from "../shared/decide.ts";
import type { Participant, Restaurant } from "../shared/types.ts";

const T1 = "2026-09-11T19:00:00.000Z";
const T2 = "2026-09-12T19:00:00.000Z";

const person = (
  id: string,
  freeTimes: string[],
  cuisinePrefs: string[],
): Participant => ({
  id,
  name: id,
  token: "t",
  joinedAt: 0,
  freeTimes,
  cuisinePrefs,
  suggestedRestaurantIds: [],
});

const place = (id: string, cuisines: string[]): Restaurant => ({
  id,
  name: id,
  cuisines,
  addedBy: "host",
});

test("normalizeTime rounds down to the minute", () => {
  assert.equal(
    normalizeTime("2026-09-11T19:00:42.123Z"),
    "2026-09-11T19:00:00.000Z",
  );
});

test("no free times anywhere yields no options", () => {
  assert.deepEqual(
    rankOptions([place("sushi", ["Japanese"])], [person("a", [], ["Japanese"])]),
    [],
  );
});

test("matches a restaurant to a free participant who likes its cuisine", () => {
  const options = rankOptions(
    [place("sushi", ["Japanese"])],
    [person("a", [T1], ["Japanese"])],
  );
  assert.equal(options.length, 1);
  assert.equal(options[0].time, T1);
  assert.equal(options[0].freeCount, 1);
  assert.equal(options[0].matchedCount, 1);
  assert.deepEqual(options[0].attendees, ["a"]);
});

test("only counts free participants toward a time's cuisine match", () => {
  const options = rankOptions(
    [place("sushi", ["Japanese"])],
    [person("a", [T1], ["Japanese"]), person("b", [], ["Japanese"])],
  );
  assert.equal(options[0].freeCount, 1);
  assert.equal(options[0].matchedCount, 1);
});

test("empty cuisine preferences are neutral, not a match", () => {
  const options = rankOptions(
    [place("sushi", ["Japanese"])],
    [person("a", [T1], [])],
  );
  assert.equal(options[0].freeCount, 1);
  assert.equal(options[0].matchedCount, 0);
});

test("ranks the time with more free people first", () => {
  const options = rankOptions(
    [place("sushi", ["Japanese"])],
    [
      person("a", [T1], ["Japanese"]),
      person("b", [T1, T2], ["Japanese"]),
    ],
  );
  assert.deepEqual(
    options.map((o) => [o.time, o.freeCount, o.matchedCount]),
    [
      [T1, 2, 2],
      [T2, 1, 1],
    ],
  );
});

test("breaks ties on name for a stable order", () => {
  const options = rankOptions(
    [place("zeta", ["Thai"]), place("alpha", ["Thai"])],
    [person("a", [T1], ["Thai"])],
  );
  assert.deepEqual(
    options.map((o) => o.restaurant.name),
    ["alpha", "zeta"],
  );
});
