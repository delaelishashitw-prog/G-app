import type { Dispatch, SetStateAction } from 'react';
import type { ChurchSettings } from '../../types/database.types';
import { initialSettings } from '../../lib/initialData';

export function normalizeSettings(incoming: Partial<ChurchSettings> | null | undefined, fallback: ChurchSettings): ChurchSettings {
  const next = {
    ...fallback,
    ...(incoming || {}),
  };

  const seniorPastor =
    !next.senior_pastor ||
    next.senior_pastor === 'Senior Pastor' ||
    next.senior_pastor.includes('Agyemang-Prempeh') ||
    next.senior_pastor.includes('Emmanuel')
      ? fallback.senior_pastor
      : next.senior_pastor;

  const generalSecretary =
    !next.general_secretary || next.general_secretary === 'General Secretary'
      ? fallback.general_secretary
      : next.general_secretary;

  return {
    ...fallback,
    ...next,
    senior_pastor: seniorPastor,
    general_secretary: generalSecretary,
  };
}

export function loadSettingsFromStorage(fallback: ChurchSettings = initialSettings): ChurchSettings {
  try {
    const saved = localStorage.getItem('gwcc_settings');
    if (!saved) return fallback;

    const parsed = JSON.parse(saved) as Partial<ChurchSettings>;
    if (!parsed || typeof parsed !== 'object') return fallback;

    const nextSettings = normalizeSettings(parsed, fallback);
    return nextSettings.church_name && nextSettings.church_name !== 'Church Management System'
      ? nextSettings
      : fallback;
  } catch {
    return fallback;
  }
}

export function updateSettings(
  newSettings: Partial<ChurchSettings>,
  setSettings: Dispatch<SetStateAction<ChurchSettings>>
) {
  setSettings((prev) => normalizeSettings({ ...prev, ...newSettings }, prev));
}
