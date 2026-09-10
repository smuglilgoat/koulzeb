import { test } from "node:test";
import assert from "node:assert/strict";
import { rankOptions } from "../shared/decide.ts";
import { isTimeSlot, TIME_SLOTS } from "../shared/times.ts";
import type { Participant, Restaurant } from "../shared/types.ts";

const T1 = "19:00";
const T2 = "20:00";

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

test("TIME_SLOTS is every half hour, in order", () => {
  assert.equal(TIME_SLOTS.length, 48);
  assert.equal(TIME_SLOTS[0], "00:00");
  assert.equal(TIME_SLOTS[1], "00:30");
  assert.equal(TIME_SLOTS[47], "23:30");
});

test("isTimeSlot accepts half hours and rejects others", () => {
  assert.ok(isTimeSlot("19:00"));
  assert.ok(isTimeSlot("19:30"));
  assert.ok(!isTimeSlot("19:15"));
  assert.ok(!isTimeSlot("25:00"));
  assert.ok(!isTimeSlot("7:00"));
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
