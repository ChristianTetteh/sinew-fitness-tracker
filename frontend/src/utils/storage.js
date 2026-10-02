// localStorage can throw (private mode, blocked site data, quota), so every access goes
// through these helpers and the app keeps working without persistence.
export function getItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore: worst case the value isn't remembered
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
