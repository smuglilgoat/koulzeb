import { CUISINES } from "../shared/cuisines.ts";
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
let draft: { availableSlotIds: string[]; cuisinePrefs: string[] } | null = null;

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

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function route(): { page: "home" } | { page: "session"; sid: string } {
  const hash = location.hash.replace(/^#/, "") || "/";
  const match = hash.match(/^\/s\/([^/]+)$/);
  return match ? { page: "session", sid: match[1] } : { page: "home" };
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

function timeRow(): string {
  return `<div class="time-row">
    <input class="time-input" type="datetime-local" required />
    <button type="button" class="ghost icon" data-action="remove-time" aria-label="Remove time">&times;</button>
  </div>`;
}

/* ------------------------------- home (create) ----------------------------- */

function renderHome(): void {
  root.innerHTML = `
  <section class="hero">
    <h1>Dinner out, decided together.</h1>
    <p class="muted">Propose a few times, share one link, and let everyone weigh in on cuisine and restaurants. KoulZeb finds the overlap.</p>
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
      <fieldset>
        <legend>Candidate times</legend>
        <div id="times">${timeRow()}</div>
        <button type="button" class="ghost" data-action="add-time">+ Add another time</button>
      </fieldset>
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
      availableSlotIds: [...me.availableSlotIds],
      cuisinePrefs: [...me.cuisinePrefs],
    };
  }

  const inviteUrl = `${location.origin}${location.pathname}#/s/${sid}`;
  const decided = session.decision;
  const decidedOption = decided
    ? results.find(
        (o) =>
          o.restaurant.id === decided.restaurantId &&
          o.timeSlot.id === decided.timeSlotId,
      )
    : undefined;

  const slots = session.timeSlots
    .map((slot) => {
      const checked = draft?.availableSlotIds.includes(slot.id) ? "checked" : "";
      const free = results.find((o) => o.timeSlot.id === slot.id)?.freeCount ?? session.participants.filter((p) => p.availableSlotIds.includes(slot.id)).length;
      return `<label class="choice">
        <input type="checkbox" name="slot" value="${slot.id}" ${checked} />
        <span>${esc(fmt(slot.start))}</span>
        <span class="muted small">${free}/${session.participants.length} free</span>
      </label>`;
    })
    .join("");

  const cuisines = CUISINES.map(
    (cuisine) => `<label class="pill">
      <input type="checkbox" name="cuisine" value="${esc(cuisine)}" ${
        draft?.cuisinePrefs.includes(cuisine) ? "checked" : ""
      } />
      <span>${esc(cuisine)}</span>
    </label>`,
  ).join("");

  const restaurants = session.restaurants.length
    ? session.restaurants
        .map(
          (r) => `<li class="restaurant">
            <strong>${esc(r.name)}</strong>
            <span class="muted small">${r.cuisines.map(esc).join(", ")}${r.address ? ` · ${esc(r.address)}` : ""}</span>
          </li>`,
        )
        .join("")
    : `<li class="muted">No restaurants yet — add the first one.</li>`;

  const resultCards = results.slice(0, 12).map((option, index) => {
    const isDecided =
      decided &&
      option.restaurant.id === decided.restaurantId &&
      option.timeSlot.id === decided.timeSlotId;
    return `<li class="option ${isDecided ? "is-decided" : ""}">
      <div class="option-rank">#${index + 1}</div>
      <div class="option-body">
        <strong>${esc(option.restaurant.name)}</strong>
        <div class="muted small">${esc(fmt(option.timeSlot.start))} · ${option.freeCount} free · ${option.matchedCount} cuisine match${option.matchedCount === 1 ? "" : "es"}</div>
        <div class="muted small">${option.attendees.map(esc).join(", ") || "nobody free"}</div>
      </div>
      ${
        me?.id === session.hostId && !decided
          ? `<button class="primary small" data-action="confirm"
              data-restaurant-id="${option.restaurant.id}"
              data-slot-id="${option.timeSlot.id}">Confirm</button>`
          : ""
      }
    </li>`;
  }).join("");

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
      ? `<section class="banner">🎉 Decided: <strong>${esc(decidedOption.restaurant.name)}</strong> at ${esc(fmt(decidedOption.timeSlot.start))} — ${esc(decidedOption.attendees.join(", ") || "nobody")}</section>`
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
              <div class="choices">${slots || '<p class="muted">The host added no times.</p>'}</div>
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
              <select name="restaurantCuisines" multiple size="5">
                ${CUISINES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
              </select>
            </label>
            <label>Address (optional)
              <input name="restaurantAddress" maxlength="160" />
            </label>
            <button type="submit" class="ghost">Add restaurant</button>
          </form>`
        : ""
    }
  </section>

  <section class="card">
    <h2>Ranked options</h2>
    <p class="muted small">Best overlap of free people and liked cuisines${decided ? "" : " — the host confirms the final pick"}.</p>
    <ol class="options">${resultCards || '<li class="muted">Add restaurants to see options.</li>'}</ol>
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

function collectDraft(): void {
  draft = {
    availableSlotIds: [
      ...root.querySelectorAll<HTMLInputElement>('input[name="slot"]:checked'),
    ].map((i) => i.value),
    cuisinePrefs: [
      ...root.querySelectorAll<HTMLInputElement>(
        'input[name="cuisine"]:checked',
      ),
    ].map((i) => i.value),
  };
}

async function onClick(event: Event): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  );
  if (!button) return;
  const { action } = button.dataset;

  if (action === "add-time") {
    document
      .getElementById("times")
      ?.insertAdjacentHTML("beforeend", timeRow());
    return;
  }
  if (action === "remove-time") {
    const rows = root.querySelectorAll(".time-row");
    if (rows.length > 1) button.closest(".time-row")?.remove();
    return;
  }
  if (action === "share") {
    const sid = route().page === "session" ? (route() as { sid: string }).sid : "";
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
    const current = route();
    if (current.page !== "session") return;
    const identity = getIdentity(current.sid);
    if (!identity) return;
    try {
      await api.decide(current.sid, identity, {
        restaurantId: button.dataset.restaurantId as string,
        timeSlotId: button.dataset.slotId as string,
      });
      await loadSession(current.sid);
    } catch (error) {
      status(error instanceof Error ? error.message : "Could not confirm");
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
      const timeInputs = [
        ...root.querySelectorAll<HTMLInputElement>(".time-input"),
      ]
        .map((i) => i.value)
        .filter(Boolean)
        .map((v) => new Date(v).toISOString());
      const result = await api.createSession({
        name: String(values.get("sessionName") ?? ""),
        hostName: String(values.get("hostName") ?? ""),
        timeSlots: timeInputs,
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
      const match = raw.match(/s\/([A-Za-z0-9-]+)/) ?? raw.match(/^([A-Za-z0-9-]+)$/);
      if (match) location.hash = `#/s/${match[1]}`;
      else status("That doesn't look like a valid invite");
      return;
    }

    const current = route();
    if (current.page !== "session") return;
    const sid = current.sid;
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

    if (kind === "me") {
      collectDraft();
      await api.saveMe(sid, identity, draft ?? {});
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
  }
}

/* ---------------------------------- boot ---------------------------------- */

root.addEventListener("click", (e) => void onClick(e));
root.addEventListener("submit", (e) => void onSubmit(e));
root.addEventListener("change", (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('input[name="slot"], input[name="cuisine"]')) {
    collectDraft();
  }
});
window.addEventListener("hashchange", () => void render());
void render();
