const SETTINGS_KEY = "player:settings";
const LAST_STATE_KEY = "player:lastState";

const DEFAULT_SETTINGS = { volume: 1, shuffle: false, repeatMode: "off" };

export function getSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
  } catch (e) {
    console.error("Error reading player settings:", e);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error("Error saving player settings:", e);
    return false;
  }
}

export function getLastState() {
  try {
    const data = localStorage.getItem(LAST_STATE_KEY);
    return data ? JSON.parse(data) : { lastTrackId: null, lastPositionSeconds: 0 };
  } catch (e) {
    console.error("Error reading player last state:", e);
    return { lastTrackId: null, lastPositionSeconds: 0 };
  }
}

export function saveLastState(state) {
  try {
    localStorage.setItem(LAST_STATE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error("Error saving player last state:", e);
    return false;
  }
}
