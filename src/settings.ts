import { createSignal } from 'solid-js';

export type Settings = object

const [settings, setSettings] = createSignal<Settings>({});

export { settings };

// Load
{
  const newSettings: Settings = { ...settings() };

  for (const key in settings()) {
    newSettings[key] = await GM.getValue(key, newSettings[key]);
  }

  setSettings(newSettings);
}

// Save
export async function saveSettings(
  change?: Partial<Settings> | ((prevSettings: Settings) => Settings),
) {
  if (typeof change === 'function') {
    setSettings(change);
  } else if (typeof change === 'object') {
    setSettings((prevSettings) => ({
      ...prevSettings,
      change,
    }));
  }

  const currentSettings = settings();

  for (const key in currentSettings) {
    await GM.setValue(key, currentSettings[key]);
  }
}
