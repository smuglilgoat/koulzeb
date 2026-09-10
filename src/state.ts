export type Identity = {
  participantId: string;
  token: string;
  name: string;
};

const identityKey = (sid: string) => `koulzeb:identity:${sid}`;
const nameKey = "koulzeb:name";

export function getIdentity(sid: string): Identity | null {
  try {
    const raw = localStorage.getItem(identityKey(sid));
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function setIdentity(sid: string, identity: Identity): void {
  localStorage.setItem(identityKey(sid), JSON.stringify(identity));
}

/** Last name typed, used to prefill join/create forms. */
export function getSavedName(): string {
  return localStorage.getItem(nameKey) ?? "";
}

export function setSavedName(name: string): void {
  localStorage.setItem(nameKey, name);
}
