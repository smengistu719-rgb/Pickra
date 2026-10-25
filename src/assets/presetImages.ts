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

const PRESET_MAP: Record<string, string> = PRESET_IMAGES.reduce(
  (acc, item) => {
    acc[item.key] = item.src;
    return acc;
  },
  {} as Record<string, string>
);

export function resolveImageSrc(imageKey: string): string {
  const trimmed = (imageKey || '').trim();
  if (PRESET_MAP[trimmed]) {
    return PRESET_MAP[trimmed];
  }
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return PRESET_MAP.workspace;
}
