import { test } from "node:test";
import assert from "node:assert/strict";
import { mapsUrl } from "../shared/maps.ts";

test("builds a Google Maps search from name and address", () => {
  assert.equal(
    mapsUrl({ name: "Bises Nouilles", address: "Paris" }),
    "https://www.google.com/maps/search/?api=1&query=Bises%20Nouilles%2C%20Paris",
  );
});

test("builds a search from the name alone", () => {
  assert.equal(
    mapsUrl({ name: "Slak" }),
    "https://www.google.com/maps/search/?api=1&query=Slak",
  );
});

test("uses an explicit http(s) link when provided", () => {
  assert.equal(
    mapsUrl({ name: "X", mapUrl: "https://maps.app.goo.gl/abc" }),
    "https://maps.app.goo.gl/abc",
  );
});

test("ignores an unsafe link and falls back to a search", () => {
  assert.match(
    mapsUrl({ name: "X", mapUrl: "javascript:alert(1)" }),
    /google\.com\/maps/,
  );
});
