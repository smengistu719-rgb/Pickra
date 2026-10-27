import heroWorkspaceImg from './images/hero_workspace_editorial_1792873961640.jpg';
import ergonomicAudioImg from './images/product_ergonomic_audio_1792873962464.jpg';
import digitalBlueprintImg from './images/digital_automation_blueprint_1792873964219.jpg';
import creativeStudioImg from './images/service_creative_studio_1792873965281.jpg';
import cameraKitImg from './images/article_camera_kit_1792873965417.jpg';
import monographEditionImg from './images/pickra_monograph_edition_1792924657125.jpg';
import deskTrayKitImg from './images/pickra_desk_tray_kit_1792924679151.jpg';

export interface PresetImageOption {
  key: string;
  label: string;
  src: string;
}

export const PRESET_IMAGES: PresetImageOption[] = [
  {
    key: 'workspace',
    label: 'Architectural Studio Desk',
    src: heroWorkspaceImg,
  },
  {
    key: 'edition',
    label: 'Linen Field Monograph & Brass Pen',
    src: monographEditionImg,
  },
  {
    key: 'tray',
    label: 'Anodized Aluminum & Walnut Desk Valet',
    src: deskTrayKitImg,
  },
  {
    key: 'audio',
    label: 'Reference Audio & DAC Hardware',
    src: ergonomicAudioImg,
  },
  {
    key: 'digital',
    label: 'Digital Systems & Tablet Blueprint',
    src: digitalBlueprintImg,
  },
  {
    key: 'service',
    label: 'Design & Engineering Specialist Desk',
    src: creativeStudioImg,
  },
  {
    key: 'camera',
    label: 'Creator Rangefinder & Field SSD Kit',
    src: cameraKitImg,
  },
];

const CUSTOM_PRESETS_STORAGE_KEY = 'pickra_custom_image_presets_v1';
const PRESETS_CHANGED_EVENT = 'pickra-presets-changed';

interface StoredPresetCustomizations {
  customPresets: PresetImageOption[];
  hiddenKeys: string[];
  labelOverrides: Record<string, string>;
  srcOverrides: Record<string, string>;
}

const DEFAULT_CUSTOMIZATIONS: StoredPresetCustomizations = {
  customPresets: [],
  hiddenKeys: [],
  labelOverrides: {},
  srcOverrides: {},
};

function readStoredCustomizations(): StoredPresetCustomizations {
  if (typeof window === 'undefined') return DEFAULT_CUSTOMIZATIONS;
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOMIZATIONS;
    const parsed = JSON.parse(raw) as Partial<StoredPresetCustomizations>;
    return {
      customPresets: Array.isArray(parsed.customPresets)
        ? parsed.customPresets.filter(
            (p): p is PresetImageOption =>
              Boolean(p && typeof p.key === 'string' && typeof p.label === 'string' && typeof p.src === 'string')
          )
        : [],
      hiddenKeys: Array.isArray(parsed.hiddenKeys)
        ? parsed.hiddenKeys.map(String)
        : [],
      labelOverrides:
        parsed.labelOverrides && typeof parsed.labelOverrides === 'object'
          ? (parsed.labelOverrides as Record<string, string>)
          : {},
      srcOverrides:
        parsed.srcOverrides && typeof parsed.srcOverrides === 'object'
          ? (parsed.srcOverrides as Record<string, string>)
          : {},
    };
  } catch {
    return DEFAULT_CUSTOMIZATIONS;
  }
}

function writeStoredCustomizations(next: StoredPresetCustomizations): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(PRESETS_CHANGED_EVENT));
  } catch {
    // ignore storage quota errors
  }
}

export function getEffectivePresetImages(): PresetImageOption[] {
  const custom = readStoredCustomizations();
  const hiddenSet = new Set(custom.hiddenKeys);
  const builtIns = PRESET_IMAGES.filter((item) => !hiddenSet.has(item.key)).map(
    (item) => ({
      key: item.key,
      label: custom.labelOverrides[item.key] || item.label,
      src: custom.srcOverrides[item.key] || item.src,
    })
  );
  const extras = custom.customPresets.filter((item) => !hiddenSet.has(item.key));
  const combined = [...builtIns, ...extras];
  if (combined.length === 0) {
    return [PRESET_IMAGES[0]];
  }
  return combined;
}

export function upsertPresetImageOption(input: {
  key?: string;
  label: string;
  src: string;
}): PresetImageOption {
  const cleanLabel = input.label.trim().slice(0, 80) || 'Custom Studio Preset';
  const cleanSrc = input.src.trim() || PRESET_IMAGES[0].src;
  const current = readStoredCustomizations();

  const targetKey =
    input.key && input.key.trim()
      ? input.key.trim()
      : `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const isBuiltIn = PRESET_IMAGES.some((p) => p.key === targetKey);

  if (isBuiltIn) {
    const next: StoredPresetCustomizations = {
      ...current,
      hiddenKeys: current.hiddenKeys.filter((k) => k !== targetKey),
      labelOverrides: {
        ...current.labelOverrides,
        [targetKey]: cleanLabel,
      },
      srcOverrides: {
        ...current.srcOverrides,
        [targetKey]: cleanSrc,
      },
    };
    writeStoredCustomizations(next);
    return { key: targetKey, label: cleanLabel, src: cleanSrc };
  }

  const existingIdx = current.customPresets.findIndex((p) => p.key === targetKey);
  const updatedOption: PresetImageOption = {
    key: targetKey,
    label: cleanLabel,
    src: cleanSrc,
  };
  const nextCustom =
    existingIdx >= 0
      ? current.customPresets.map((p, i) => (i === existingIdx ? updatedOption : p))
      : [...current.customPresets.slice(-19), updatedOption];

  writeStoredCustomizations({
    ...current,
    hiddenKeys: current.hiddenKeys.filter((k) => k !== targetKey),
    customPresets: nextCustom,
  });
  return updatedOption;
}

export function deletePresetImageOption(keyToDelete: string): string {
  const current = readStoredCustomizations();
  const nextHidden = Array.from(new Set([...current.hiddenKeys, keyToDelete]));
  const nextCustom = current.customPresets.filter((p) => p.key !== keyToDelete);
  writeStoredCustomizations({
    ...current,
    hiddenKeys: nextHidden,
    customPresets: nextCustom,
  });
  const remaining = getEffectivePresetImages();
  return remaining[0]?.key || 'workspace';
}

export function subscribePresetImages(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(PRESETS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(PRESETS_CHANGED_EVENT, listener);
}

const DEFAULT_PRESET_MAP: Record<string, string> = PRESET_IMAGES.reduce(
  (acc, item) => {
    acc[item.key] = item.src;
    return acc;
  },
  {} as Record<string, string>
);

export function resolveImageSrc(imageKey: string): string {
  const trimmed = (imageKey || '').trim();
  const effective = getEffectivePresetImages();
  const matched = effective.find((p) => p.key === trimmed);
  if (matched) {
    return matched.src;
  }
  if (DEFAULT_PRESET_MAP[trimmed]) {
    return DEFAULT_PRESET_MAP[trimmed];
  }
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return effective[0]?.src || DEFAULT_PRESET_MAP.workspace;
}
