const TABS_STORAGE_KEY = "coderunner_tabs";
const ACTIVE_TAB_STORAGE_KEY = "coderunner_activeTab";
const STORAGE_KEY_PREFIX = "coderunner_";

export function getAllTabs() {
  try {
    const data = localStorage.getItem(TABS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading tabs from localStorage:", e);
    return [];
  }
}

export function saveAllTabs(tabs) {
  try {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
    return true;
  } catch (e) {
    console.error("Error saving tabs to localStorage:", e);
    return false;
  }
}

export function getActiveTabId() {
  try {
    return localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function setActiveTabId(tabId) {
  try {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tabId);
    return true;
  } catch (e) {
    console.error("Error saving active tab:", e);
    return false;
  }
}

export function getSavedFiles(language) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${language}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Error reading from localStorage:", e);
    return {};
  }
}

export function saveFile(language, fileName, code) {
  try {
    const files = getSavedFiles(language);
    files[fileName] = {
      code,
      timestamp: new Date().toISOString(),
      savedAt: Date.now()
    };
    const key = `${STORAGE_KEY_PREFIX}${language}`;
    localStorage.setItem(key, JSON.stringify(files));
    return true;
  } catch (e) {
    console.error("Error saving to localStorage:", e);
    return false;
  }
}

export function getFile(language, fileName) {
  try {
    const files = getSavedFiles(language);
    return files[fileName];
  } catch (e) {
    console.error("Error reading file from localStorage:", e);
    return null;
  }
}

export function deleteFile(language, fileName) {
  try {
    const files = getSavedFiles(language);
    delete files[fileName];
    const key = `${STORAGE_KEY_PREFIX}${language}`;
    localStorage.setItem(key, JSON.stringify(files));
    return true;
  } catch (e) {
    console.error("Error deleting file from localStorage:", e);
    return false;
  }
}

export function renameFile(language, oldName, newName) {
  try {
    const files = getSavedFiles(language);
    if (files[oldName]) {
      files[newName] = files[oldName];
      delete files[oldName];
      const key = `${STORAGE_KEY_PREFIX}${language}`;
      localStorage.setItem(key, JSON.stringify(files));
      return true;
    }
    return false;
  } catch (e) {
    console.error("Error renaming file in localStorage:", e);
    return false;
  }
}

export function getRecentFiles(language, limit = 5) {
  try {
    const files = getSavedFiles(language);
    return Object.entries(files)
      .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0))
      .slice(0, limit)
      .map(([name, data]) => ({ name, ...data }));
  } catch (e) {
    console.error("Error getting recent files:", e);
    return [];
  }
}

export function fileExists(language, fileName) {
  try {
    const files = getSavedFiles(language);
    return fileName in files;
  } catch (e) {
    return false;
  }
}
