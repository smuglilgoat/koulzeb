import { CUISINES, cuisineIcon } from "../shared/cuisines.ts";
import { TIME_SLOTS } from "../shared/times.ts";
import { mapsUrl } from "../shared/maps.ts";
import type { Restaurant } from "../shared/types.ts";
import { ApiError, api, type SessionData } from "./api.ts";
import {
  getIdentity,
  getSavedName,
  setIdentity,
  setSavedName,
} from "./state.ts";

const POLL_MS = 5000;

const root = document.getElementById("app") as HTMLElement;
let pollTimer: number | undefined;
let statusTimer: number | undefined;
let data: SessionData | null = null;
let draft: { freeTimes: string[]; cuisinePrefs: string[] } | null = null;
let editingId: string | null = null;

const AVATARS = ["🐱", "🐶", "🐼", "🦊", "🐸", "🐵", "🦁", "🐷", "🐻", "🐨", "🐯", "🐮"];

/* ---------------------------------- utils --------------------------------- */

function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

function avatarFor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

function route(): { page: "home" } | { page: "session"; sid: string } {
  const hash = location.hash.replace(/^#/, "") || "/";
  const match = hash.match(/^\/s\/([^/]+)$/);
  return match ? { page: "session", sid: match[1] } : { page: "home" };
}

function currentSid(): string | null {
  const r = route();
  return r.page === "session" ? r.sid : null;
}

function status(message: string): void {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    el.textContent = "";
  }, 2500);
}

function busy(on: boolean): void {
  root.classList.toggle("busy", on);
}

function badges(r: Restaurant): string {
  const parts: string[] = [];
  if (r.rating !== undefined) {
    parts.push(`<span class="badge rating">⭐ ${r.rating.toFixed(1)}</span>`);
  }
  if (r.price) parts.push(`<span class="badge">${esc(r.price)}</span>`);
  if (r.halal) parts.push(`<span class="badge halal">🥩 Halal</span>`);
  if (r.vege) parts.push(`<span class="badge vege">🥗 Veggie</span>`);
  return parts.join("");
}

function cuisineTags(cuisines: string[]): string {
  return cuisines
    .map((c) => `<span class="cuisine">${cuisineIcon(c)} ${esc(c)}</span>`)
    .join("");
}

function restaurantFields(r?: Restaurant): string {
  return `
    <label>Place name
      <input name="restaurantName" required maxlength="80" placeholder="Chez Ali" value="${r ? esc(r.name) : ""}" />
    </label>
    <label>What kind of food?
      <select name="restaurantCuisines" multiple size="6">
        ${CUISINES.map(
          (c) =>
            `<option value="${esc(c.name)}"${r?.cuisines.includes(c.name) ? " selected" : ""}>${c.icon} ${esc(c.name)}</option>`,
        ).join("")}
      </select>
    </label>
    <label>Address (if you know it)
      <input name="restaurantAddress" maxlength="160" value="${r?.address ? esc(r.address) : ""}" />
    </label>
    <label>Google Maps link (if you have one)
      <input name="restaurantMapUrl" maxlength="300" placeholder="https://maps.google.com/…" value="${r?.mapUrl ? esc(r.mapUrl) : ""}" />
    </label>
    <div class="checks">
      <label class="pill"><input type="checkbox" name="halal"${r?.halal ? " checked" : ""} /> <span>🥩 Halal</span></label>
      <label class="pill"><input type="checkbox" name="vege"${r?.vege ? " checked" : ""} /> <span>🥗 Veggie</span></label>
    </div>`;
}

/* ------------------------------- home (create) ----------------------------- */

function renderHome(): void {
  root.innerHTML = `
  <section class="hero">
    <div class="mascot">🍽️</div>
    <h1>Let's pick somewhere to eat!</h1>
    <p class="muted">Make a dinner, share one link, and everyone says when they're free and what they're hungry for. KoulZeb picks the best match — no more 47-message group chat. 😅</p>
  </section>

  <section class="card">
    <h2>🍽️ Start a dinner</h2>
    <form data-form="create">
      <label>Name this dinner
        <input name="sessionName" required maxlength="80" placeholder="Friday nom-noms" />
      </label>
      <label>What should we call you?
        <input name="hostName" required maxlength="40" value="${esc(getSavedName())}" placeholder="Amine" />
      </label>
      <button type="submit" class="big">Create it! 🚀</button>
    </form>
  </section>

  <section class="card">
    <h2>🔗 Got an invite?</h2>
    <form data-form="open">
      <label>Paste the link here
        <input name="invite" placeholder="https://.../#/s/abc123" />
      </label>
      <button type="submit" class="big ghost">Let's go! ➡️</button>
    </form>
  </section>`;
}

/* ------------------------------ session view ------------------------------ */

function renderSession(sid: string): void {
  const identity = getIdentity(sid);

  if (!data) {
    root.innerHTML = `<section class="card"><p class="muted">Loading… 🍳</p><div id="status" class="status"></div></section>`;
    return;
  }

  const { session, results } = data;
  const me = identity
    ? session.participants.find((p) => p.id === identity.participantId)
    : undefined;

  if (identity && me && draft === null) {
    draft = {
      freeTimes: [...me.freeTimes],
      cuisinePrefs: [...me.cuisinePrefs],
    };
  }

  const inviteUrl = `${location.origin}${location.pathname}#/s/${sid}`;
  const decided = session.decision;
  const decidedOption = decided
    ? results.find(
        (o) =>
          o.restaurant.id === decided.restaurantId && o.time === decided.time,
      )
    : undefined;

  const mine = [...(draft?.freeTimes ?? [])].sort();
  const others = session.participants.filter(
    (p) => p.id !== identity?.participantId,
  );
  const suggested = [...new Set(others.flatMap((p) => p.freeTimes))]
    .filter((t) => !mine.includes(t))
    .sort();

  const answered = session.participants.filter((p) => p.freeTimes.length > 0);
  const waiting = session.participants.filter((p) => p.freeTimes.length === 0);
  const pct = session.participants.length
    ? Math.round((answered.length / session.participants.length) * 100)
    : 0;
  const everyoneReady =
    session.participants.length > 0 && waiting.length === 0;

  const friends = session.participants
    .map((p) => {
      const done = p.freeTimes.length > 0;
      return `<span class="friend ${done ? "done" : ""}" title="${esc(p.name)}${p.id === session.hostId ? " (host)" : ""}">
        <span class="avatar">${avatarFor(p.id)}</span>
        <span class="friend-name">${esc(p.name)}</span>
        <span class="tick">${done ? "✅" : "⏳"}</span>
      </span>`;
    })
    .join("");

  const nudge = decided
    ? ""
    : everyoneReady
      ? `<p class="nudge good">🎉 Everyone has answered! Roll the dice and pick a place!</p>`
      : `<p class="nudge">⏳ Still waiting on <strong>${waiting.map((p) => esc(p.name)).join(", ")}</strong>… go poke them! 👉</p>`;

  const myTimes = mine.length
    ? mine
        .map(
          (t) => `<li class="time-row">
            <span>🕒 ${esc(t)}</span>
            <button type="button" class="ghost icon" data-action="remove-free-time"
              data-time="${esc(t)}" aria-label="Remove time">✖️</button>
          </li>`,
        )
        .join("")
    : `<li class="muted small">No times yet — tap below to add when you're free! 👇</li>`;

  const suggestionChips = suggested.length
    ? `<div class="suggestions">
        <span class="muted small">Your friends can do these too:</span>
        ${suggested
          .map(
            (t) => `<button type="button" class="chip" data-action="add-suggested"
              data-time="${esc(t)}">➕ ${esc(t)}</button>`,
          )
          .join("")}
      </div>`
    : "";

  const cuisines = CUISINES.map(
    (cuisine) => `<label class="pill">
      <input type="checkbox" name="cuisine" value="${esc(cuisine.name)}" ${
        draft?.cuisinePrefs.includes(cuisine.name) ? "checked" : ""
      } />
      <span>${cuisine.icon} ${esc(cuisine.name)}</span>
    </label>`,
  ).join("");

  const restaurants = session.restaurants.length
    ? session.restaurants
        .map((r) =>
          r.id === editingId
            ? `<li class="restaurant editing">
                <form data-form="restaurant-edit">
                  <input type="hidden" name="restaurantId" value="${r.id}" />
                  ${restaurantFields(r)}
                  <div class="row">
                    <button type="submit" class="big small">Save it! ✅</button>
                    <button type="button" class="big small ghost" data-action="cancel-edit">Never mind</button>
                  </div>
                </form>
              </li>`
            : `<li class="restaurant">
                <div class="row between">
                  <strong>${esc(r.name)}</strong>
                  <span class="badges">${badges(r)}</span>
                </div>
                <div class="cuisines">${cuisineTags(r.cuisines)}${r.address ? `<span class="muted small">📍 ${esc(r.address)}</span>` : ""}</div>
                <div class="links">
                  <a class="map-link" href="${esc(mapsUrl(r))}" target="_blank" rel="noopener">🗺️ Map</a>
                  ${me ? `<button type="button" class="ghost small" data-action="edit-restaurant" data-id="${r.id}">✏️ Edit</button>` : ""}
                </div>
              </li>`,
        )
        .join("")
    : `<li class="muted">No places yet — add the first one! 👇</li>`;

  const resultCards = results
    .slice(0, 12)
    .map((option, index) => {
      const isDecided =
        decided &&
        option.restaurant.id === decided.restaurantId &&
        option.time === decided.time;
      const medal = ["🥇", "🥈", "🥉"][index] ?? "🍽️";
      return `<li class="option ${isDecided ? "is-decided" : ""}">
      <div class="option-rank">${medal}</div>
      <div class="option-body">
        <div class="row between">
          <strong>${esc(option.restaurant.name)}</strong>
          <span class="badges">${badges(option.restaurant)}</span>
        </div>
        <div class="muted small">🕒 ${esc(option.time)} · 👥 ${option.freeCount} free · 😋 ${option.matchedCount} food match${option.matchedCount === 1 ? "" : "es"}</div>
        <div class="muted small">🙋 ${option.attendees.map(esc).join(", ") || "nobody free"}</div>
        <a class="map-link small" href="${esc(mapsUrl(option.restaurant))}" target="_blank" rel="noopener">🗺️ Map</a>
      </div>
      ${
        me?.id === session.hostId && !decided
          ? `<button class="big small" data-action="confirm"
              data-restaurant-id="${option.restaurant.id}"
              data-time="${esc(option.time)}">Pick this! 🎉</button>`
          : ""
      }
    </li>`;
    })
    .join("");

  root.innerHTML = `
  <section class="card">
    <div class="row between">
      <div>
        <h1 class="tight">🍽️ ${esc(session.name)}</h1>
        <p class="muted small">${me ? `You're ${esc(me.name)}${me.id === session.hostId ? " — the boss 👑" : ""}` : "You're just looking 👀"}</p>
      </div>
      <button class="big small" data-action="share">📣 Invite</button>
    </div>
    <div class="friends">${friends}</div>
    <div class="progress" aria-hidden="true"><div class="bar" style="width:${pct}%"></div></div>
    <p class="muted small">${answered.length}/${session.participants.length} friends have picked their times</p>
    ${nudge}
    <p class="invite muted small">🔗 ${esc(inviteUrl)}</p>
    <div id="status" class="status"></div>
  </section>

  ${
    decided && decidedOption
      ? `<section class="banner">🎉🍽️ YAY! We're going to <strong>${esc(decidedOption.restaurant.name)}</strong> at <strong>${esc(decidedOption.time)}</strong>! 🎉<br/><span class="small">With ${esc(decidedOption.attendees.join(", ") || "nobody yet")} — have fun! 😋</span></section>`
      : ""
  }

  ${
    !identity
      ? `<section class="card">
          <h2>👋 Who are you?</h2>
          <form data-form="join">
            <label>Your name
              <input name="guestName" required maxlength="40" value="${esc(getSavedName())}" placeholder="Your name" />
            </label>
            <button type="submit" class="big">Count me in! 🙋</button>
          </form>
        </section>`
      : ""
  }

  ${
    me
      ? `<section class="card">
          <h2>🕒 When can you eat?</h2>
          <form data-form="me">
            <fieldset>
              <legend>Tap the times that work for you 👇</legend>
              <ul class="plain times">${myTimes}</ul>
              <div class="add-time">
                <select id="new-time">
                  ${TIME_SLOTS.map((t) => `<option value="${t}"${t === "19:00" ? " selected" : ""}>${t}</option>`).join("")}
                </select>
                <button type="button" class="big small" data-action="add-free-time">Add it! ⏰</button>
              </div>
              ${suggestionChips}
            </fieldset>
            <fieldset>
              <legend>😋 What are you craving?</legend>
              <div class="pills">${cuisines}</div>
            </fieldset>
            <button type="submit" class="big">Save my picks! ✅</button>
          </form>
        </section>`
      : ""
  }

  <section class="card">
    <h2>🍕 Places to eat</h2>
    <ul class="plain">${restaurants}</ul>
    ${
      me
        ? `<form data-form="restaurant" class="stack">
            <h3 class="form-title">➕ Add a place</h3>
            ${restaurantFields()}
            <button type="submit" class="big ghost">Add it! 🍽️</button>
          </form>`
        : ""
    }
  </section>

  <section class="card">
    <h2>🏆 Best picks!</h2>
    <p class="muted small">We put the best matches first${decided ? "." : ` — ${me?.id === session.hostId ? "you pick the winner! 👑" : "the host picks the winner! 👑"}`}</p>
    <ol class="options">${resultCards || '<li class="muted">No picks yet — add some places and times! 🍽️</li>'}</ol>
  </section>`;
}

/* --------------------------------- loading -------------------------------- */

async function loadSession(sid: string): Promise<void> {
  try {
    data = await api.getSession(sid);
    renderSession(sid);
  } catch (error) {
    root.innerHTML = `<section class="card"><h2>😢 Oops!</h2><p class="muted">${esc(error instanceof Error ? error.message : "Unknown error")}</p><a href="#/" class="big ghost">🏠 Back home</a></section>`;
  }
}

function startPolling(sid: string): void {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => void loadSession(sid), POLL_MS);
}

/* --------------------------------- routing -------------------------------- */

async function render(): Promise<void> {
  window.clearInterval(pollTimer);
  const current = route();
  if (current.page === "home") {
    data = null;
    draft = null;
    editingId = null;
    renderHome();
    return;
  }
  data = null;
  draft = null;
  editingId = null;
  renderSession(current.sid);
  await loadSession(current.sid);
  startPolling(current.sid);
}

/* -------------------------------- handlers -------------------------------- */

function syncCuisines(): void {
  if (!draft) draft = { freeTimes: [], cuisinePrefs: [] };
  draft.cuisinePrefs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="cuisine"]:checked'),
  ].map((i) => i.value);
}

function rerender(): void {
  const sid = currentSid();
  if (sid) renderSession(sid);
}

async function onClick(event: Event): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  );
  if (!button) return;
  const { action } = button.dataset;

  if (action === "add-free-time") {
    const select = document.getElementById("new-time") as HTMLSelectElement | null;
    if (!select?.value) return;
    draft = draft ?? { freeTimes: [], cuisinePrefs: [] };
    draft.freeTimes = [...new Set([...draft.freeTimes, select.value])].sort();
    rerender();
    return;
  }
  if (action === "remove-free-time") {
    if (!draft) return;
    draft.freeTimes = draft.freeTimes.filter((t) => t !== button.dataset.time);
    rerender();
    return;
  }
  if (action === "add-suggested") {
    draft = draft ?? { freeTimes: [], cuisinePrefs: [] };
    draft.freeTimes = [...new Set([...draft.freeTimes, button.dataset.time as string])].sort();
    rerender();
    return;
  }
  if (action === "edit-restaurant") {
    editingId = button.dataset.id ?? null;
    rerender();
    return;
  }
  if (action === "cancel-edit") {
    editingId = null;
    rerender();
    return;
  }
  if (action === "share") {
    const sid = currentSid() ?? "";
    const url = `${location.origin}${location.pathname}#/s/${sid}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "KoulZeb dinner invite", url });
      } else {
        await navigator.clipboard.writeText(url);
        status("Copied! 📋");
      }
    } catch {
      /* user cancelled the share sheet */
    }
    return;
  }
  if (action === "confirm") {
    const sid = currentSid();
    const identity = sid ? getIdentity(sid) : null;
    if (!sid || !identity) return;
    busy(true);
    try {
      await api.decide(sid, identity, {
        restaurantId: button.dataset.restaurantId as string,
        time: button.dataset.time as string,
      });
      await loadSession(sid);
    } catch (error) {
      status(error instanceof Error ? error.message : "Could not confirm");
    } finally {
      busy(false);
    }
  }
}

async function onSubmit(event: Event): Promise<void> {
  const form = event.target as HTMLFormElement;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  const values = new FormData(form);

  try {
    if (kind === "create") {
      const result = await api.createSession({
        name: String(values.get("sessionName") ?? ""),
        hostName: String(values.get("hostName") ?? ""),
      });
      setSavedName(String(values.get("hostName") ?? ""));
      setIdentity(result.sessionId, {
        participantId: result.participantId,
        token: result.token,
        name: String(values.get("hostName") ?? ""),
      });
      location.hash = `#/s/${result.sessionId}`;
      return;
    }

    if (kind === "open") {
      const raw = String(values.get("invite") ?? "").trim();
      const match =
        raw.match(/s\/([A-Za-z0-9-]+)/) ?? raw.match(/^([A-Za-z0-9-]+)$/);
      if (match) location.hash = `#/s/${match[1]}`;
      else status("Hmm, that link looks funny 🤔");
      return;
    }

    const sid = currentSid();
    if (!sid) return;
    const identity = getIdentity(sid);

    if (kind === "join") {
      if (!identity) {
        const name = String(values.get("guestName") ?? "");
        const result = await api.join(sid, name);
        setSavedName(name);
        setIdentity(sid, {
          participantId: result.participantId,
          token: result.token,
          name,
        });
      }
      await loadSession(sid);
      return;
    }

    if (!identity) return;
    busy(true);

    if (kind === "me") {
      syncCuisines();
      await api.saveMe(sid, identity, draft ?? { freeTimes: [], cuisinePrefs: [] });
      status("Yum! Saved ✅");
      return;
    }

    if (kind === "restaurant" || kind === "restaurant-edit") {
      const select = form.querySelector<HTMLSelectElement>(
        'select[name="restaurantCuisines"]',
      );
      const cuisines = select
        ? [...select.selectedOptions].map((o) => o.value)
        : [];
      const input = {
        name: String(values.get("restaurantName") ?? ""),
        cuisines,
        address: String(values.get("restaurantAddress") ?? "") || undefined,
        mapUrl: String(values.get("restaurantMapUrl") ?? "") || undefined,
        halal: values.get("halal") === "on",
        vege: values.get("vege") === "on",
      };
      if (kind === "restaurant-edit") {
        await api.editRestaurant(
          sid,
          identity,
          String(values.get("restaurantId") ?? ""),
          input,
        );
        editingId = null;
      } else {
        await api.addRestaurant(sid, identity, input);
        form.reset();
      }
      await loadSession(sid);
    }
  } catch (error) {
    status(
      error instanceof ApiError || error instanceof Error
        ? error.message
        : "Something went wrong",
    );
  } finally {
    busy(false);
  }
}

/* ---------------------------------- boot ---------------------------------- */

root.addEventListener("click", (e) => void onClick(e));
root.addEventListener("submit", (e) => void onSubmit(e));
root.addEventListener("change", (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('input[name="cuisine"]')) syncCuisines();
});
window.addEventListener("hashchange", () => void render());
void render();
