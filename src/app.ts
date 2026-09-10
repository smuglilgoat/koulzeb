import { CUISINES, cuisineIcon } from "../shared/cuisines.ts";
import { TIME_SLOTS } from "../shared/times.ts";
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
    parts.push(`<span class="badge rating">★ ${r.rating.toFixed(1)}</span>`);
  }
  if (r.price) parts.push(`<span class="badge">${esc(r.price)}</span>`);
  if (r.halal) parts.push(`<span class="badge halal">Halal</span>`);
  if (r.vege) parts.push(`<span class="badge vege">Vege</span>`);
  return parts.join("");
}

function cuisineTags(cuisines: string[]): string {
  return cuisines
    .map((c) => `<span class="cuisine">${cuisineIcon(c)} ${esc(c)}</span>`)
    .join("");
}

/* ------------------------------- home (create) ----------------------------- */

function renderHome(): void {
  root.innerHTML = `
  <section class="hero">
    <h1>Dinner out, decided together.</h1>
    <p class="muted">Share one link. Everyone adds the times they're free and the cuisines they like, plus restaurants. KoulZeb finds the overlap.</p>
  </section>

  <section class="card">
    <h2>Plan a dinner</h2>
    <form data-form="create">
      <label>Dinner name
        <input name="sessionName" required maxlength="80" placeholder="Friday team dinner" />
      </label>
      <label>Your name
        <input name="hostName" required maxlength="40" value="${esc(getSavedName())}" placeholder="Amine" />
      </label>
      <button type="submit" class="primary">Create session</button>
    </form>
  </section>

  <section class="card">
    <h2>Have an invite?</h2>
    <form data-form="open">
      <label>Paste the invite link or session id
        <input name="invite" placeholder="https://.../#/s/abc123" />
      </label>
      <button type="submit" class="ghost">Open</button>
    </form>
  </section>`;
}

/* ------------------------------ session view ------------------------------ */

function renderSession(sid: string): void {
  const identity = getIdentity(sid);

  if (!data) {
    root.innerHTML = `<section class="card"><p class="muted">Loading…</p><div id="status" class="status"></div></section>`;
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

  const myTimes = mine.length
    ? mine
        .map(
          (t) => `<li class="time-row">
            <span>${esc(t)}</span>
            <button type="button" class="ghost icon" data-action="remove-free-time"
              data-time="${esc(t)}" aria-label="Remove time">&times;</button>
          </li>`,
        )
        .join("")
    : `<li class="muted small">No times yet — add when you're free.</li>`;

  const suggestionChips = suggested.length
    ? `<div class="suggestions">
        <span class="muted small">Others are free:</span>
        ${suggested
          .map(
            (t) => `<button type="button" class="chip" data-action="add-suggested"
              data-time="${esc(t)}">+ ${esc(t)}</button>`,
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
        .map(
          (r) => `<li class="restaurant">
            <div class="row between">
              <strong>${esc(r.name)}</strong>
              <span class="badges">${badges(r)}</span>
            </div>
            <div class="cuisines">${cuisineTags(r.cuisines)}${r.address ? `<span class="muted small">${esc(r.address)}</span>` : ""}</div>
          </li>`,
        )
        .join("")
    : `<li class="muted">No restaurants yet — add the first one.</li>`;

  const resultCards = results
    .slice(0, 12)
    .map((option, index) => {
      const isDecided =
        decided &&
        option.restaurant.id === decided.restaurantId &&
        option.time === decided.time;
      return `<li class="option ${isDecided ? "is-decided" : ""}">
      <div class="option-rank">#${index + 1}</div>
      <div class="option-body">
        <div class="row between">
          <strong>${esc(option.restaurant.name)}</strong>
          <span class="badges">${badges(option.restaurant)}</span>
        </div>
        <div class="muted small">${esc(option.time)} · ${option.freeCount} free · ${option.matchedCount} cuisine match${option.matchedCount === 1 ? "" : "es"}</div>
        <div class="muted small">${option.attendees.map(esc).join(", ") || "nobody free"}</div>
      </div>
      ${
        me?.id === session.hostId && !decided
          ? `<button class="primary small" data-action="confirm"
              data-restaurant-id="${option.restaurant.id}"
              data-time="${esc(option.time)}">Confirm</button>`
          : ""
      }
    </li>`;
    })
    .join("");

  root.innerHTML = `
  <section class="card">
    <div class="row between">
      <div>
        <h1 class="tight">${esc(session.name)}</h1>
        <p class="muted small">${session.participants.length} guest${session.participants.length === 1 ? "" : "s"}${me ? ` · you are ${esc(me.name)}${me.id === session.hostId ? " (host)" : ""}` : ""}</p>
      </div>
      <button class="ghost" data-action="share">Share invite</button>
    </div>
    <p class="invite muted small">${esc(inviteUrl)}</p>
    <div id="status" class="status"></div>
  </section>

  ${
    decided && decidedOption
      ? `<section class="banner">🎉 Decided: <strong>${esc(decidedOption.restaurant.name)}</strong> at ${esc(decidedOption.time)} — ${esc(decidedOption.attendees.join(", ") || "nobody")}</section>`
      : ""
  }

  ${
    !identity
      ? `<section class="card">
          <h2>Join this dinner</h2>
          <form data-form="join">
            <label>Your name
              <input name="guestName" required maxlength="40" value="${esc(getSavedName())}" />
            </label>
            <button type="submit" class="primary">Join</button>
          </form>
        </section>`
      : ""
  }

  ${
    me
      ? `<section class="card">
          <h2>Your choices</h2>
          <form data-form="me">
            <fieldset>
              <legend>When are you free?</legend>
              <ul class="plain times">${myTimes}</ul>
              <div class="add-time">
                <select id="new-time">
                  ${TIME_SLOTS.map((t) => `<option value="${t}"${t === "19:00" ? " selected" : ""}>${t}</option>`).join("")}
                </select>
                <button type="button" class="ghost" data-action="add-free-time">Add time</button>
              </div>
              ${suggestionChips}
            </fieldset>
            <fieldset>
              <legend>Cuisines you like</legend>
              <div class="pills">${cuisines}</div>
            </fieldset>
            <button type="submit" class="primary">Save my choices</button>
          </form>
        </section>`
      : ""
  }

  <section class="card">
    <h2>Restaurants</h2>
    <ul class="plain">${restaurants}</ul>
    ${
      me
        ? `<form data-form="restaurant" class="stack">
            <label>Add a restaurant
              <input name="restaurantName" required maxlength="80" placeholder="Chez Ali" />
            </label>
            <label>Cuisines
              <select name="restaurantCuisines" multiple size="6">
                ${CUISINES.map((c) => `<option value="${esc(c.name)}">${c.icon} ${esc(c.name)}</option>`).join("")}
              </select>
            </label>
            <label>Address (optional)
              <input name="restaurantAddress" maxlength="160" />
            </label>
            <div class="checks">
              <label class="pill"><input type="checkbox" name="halal" /> <span>Halal</span></label>
              <label class="pill"><input type="checkbox" name="vege" /> <span>Vege</span></label>
            </div>
            <button type="submit" class="ghost">Add restaurant</button>
          </form>`
        : ""
    }
  </section>

  <section class="card">
    <h2>Ranked options</h2>
    <p class="muted small">Best overlap of free people and liked cuisines${decided ? "" : " — the host confirms the final pick"}.</p>
    <ol class="options">${resultCards || '<li class="muted">No options yet — add restaurants and times.</li>'}</ol>
  </section>`;
}

/* --------------------------------- loading -------------------------------- */

async function loadSession(sid: string): Promise<void> {
  try {
    data = await api.getSession(sid);
    renderSession(sid);
  } catch (error) {
    root.innerHTML = `<section class="card"><h2>Session unavailable</h2><p class="muted">${esc(error instanceof Error ? error.message : "Unknown error")}</p><a href="#/" class="ghost">← Back home</a></section>`;
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
    renderHome();
    return;
  }
  data = null;
  draft = null;
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
  if (action === "share") {
    const sid = currentSid() ?? "";
    const url = `${location.origin}${location.pathname}#/s/${sid}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "KoulZeb dinner invite", url });
      } else {
        await navigator.clipboard.writeText(url);
        status("Invite link copied");
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
      else status("That doesn't look like a valid invite");
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
      status("Choices saved");
      return;
    }

    if (kind === "restaurant") {
      const select = form.querySelector<HTMLSelectElement>(
        'select[name="restaurantCuisines"]',
      );
      const cuisines = select
        ? [...select.selectedOptions].map((o) => o.value)
        : [];
      await api.addRestaurant(sid, identity, {
        name: String(values.get("restaurantName") ?? ""),
        cuisines,
        address: String(values.get("restaurantAddress") ?? "") || undefined,
        halal: values.get("halal") === "on",
        vege: values.get("vege") === "on",
      });
      form.reset();
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
