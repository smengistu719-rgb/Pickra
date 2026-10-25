import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';
import { PRESET_IMAGES } from '../assets/presetImages';
import { compressImageFileToDataUrl } from '../firebase';
import { ResilientImage } from './ResilientImage';

interface ImageUploadPickerProps {
  value: string;
  onChange: (nextValue: string) => void;
  label?: string;
  showPreview?: boolean;
  previewAspectClass?: string;
  compact?: boolean;
}

export const ImageUploadPicker: React.FC<ImageUploadPickerProps> = ({
  value,
  onChange,
  label = 'Visual / Cover Image',
  showPreview = true,
  previewAspectClass = 'aspect-[16/9]',
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isPreset = PRESET_IMAGES.some((p) => p.key === value);
  const isDataUpload = value.startsWith('data:image/');
  const isHttpsUrl = value.startsWith('https://');

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file);
      onChange(compressedDataUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to process image file.'
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-stone-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => void handleFileSelect(e)}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 border border-stone-300/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-[#9A3412]" />
            <span>
              {uploading
                ? 'Compressing...'
                : isDataUpload
                ? 'Replace Uploaded Photo'
                : 'Upload Photo'}
            </span>
          </button>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 ${
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'
        } gap-2.5`}
      >
        <select
          aria-label={`${label} preset`}
          value={isPreset ? value : isDataUpload ? '__uploaded__' : '__url__'}
          onChange={(e) => {
            const next = e.target.value;
            if (next === '__uploaded__' || next === '__url__') return;
            onChange(next);
          }}
          className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:border-[#9A3412]"
        >
          {isDataUpload && (
            <option value="__uploaded__">Uploaded Device Image (Active)</option>
          )}
          {isHttpsUrl && (
            <option value="__url__">Custom HTTPS Image URL (Active)</option>
          )}
          {PRESET_IMAGES.map((img) => (
            <option key={img.key} value={img.key}>
              Studio Preset: {img.label}
            </option>
          ))}
        </select>

        <input
          type="url"
          value={isHttpsUrl ? value : ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange(raw || 'workspace');
          }}
          placeholder="Or paste https:// image URL..."
          className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:border-[#9A3412]"
        />
      </div>

      {uploadError && (
        <p className="text-xs text-red-700">{uploadError}</p>
      )}

      {showPreview && (
        <div
          className={`${previewAspectClass} w-full rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80 relative`}
        >
          {value ? (
            <ResilientImage
              imageKey={value}
              alt={label}
              fallbackLabel={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-stone-400 gap-1.5">
              <ImageIcon className="w-4 h-4" />
              <span>Image preview</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
