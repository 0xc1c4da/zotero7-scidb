import { config } from "../../package.json";
import { getString } from "../utils/locale";

interface PrefsData {
  window: Window;
  columns: Array<{
    dataKey: string;
    label: string;
    fixedWidth?: boolean;
    width?: number;
  }>;
  rows: Array<{ [dataKey: string]: string }>;
}

export async function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [], // Empty columns since we don't use the table
      rows: []     // Empty rows since we don't use the table
    } as PrefsData;
  } else {
    addon.data.prefs.window = _window;
  }
  updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  if (!addon.data.prefs?.window) return;
  
  // Get the current endpoint value
  const prefKey = `extensions.zotero.${config.addonRef}.endpoint`;
  const currentEndpoint = (Zotero.Prefs.get(prefKey) as string) || "https://sci-hub.usualwant.com/";
  
  // Set the input value
  const input = addon.data.prefs.window.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-endpoint`
  ) as HTMLInputElement;
  
  if (input) {
    input.value = currentEndpoint;
  }
}

function bindPrefEvents() {
  if (!addon.data.prefs?.window) return;

  const prefKey = `extensions.zotero.${config.addonRef}.endpoint`;
  const input = addon.data.prefs.window.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-endpoint`
  ) as HTMLInputElement;

  if (input) {
    input.addEventListener("change", (e) => {
      const value = (e.target as HTMLInputElement).value;
      Zotero.Prefs.set(prefKey, value);
      ztoolkit.log(`Updated endpoint to: ${value}`);
    });
  }
}
