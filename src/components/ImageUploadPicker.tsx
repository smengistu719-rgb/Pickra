import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  PenLine,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deletePresetImageOption,
  getEffectivePresetImages,
  PresetImageOption,
  subscribePresetImages,
  upsertPresetImageOption,
} from '../assets/presetImages';
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
  const presetFileInputRef = useRef<HTMLInputElement | null>(null);
  const [presets, setPresets] = useState<PresetImageOption[]>(() =>
    getEffectivePresetImages()
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Preset dropdown CRUD state
  const [presetMode, setPresetMode] = useState<
    'idle' | 'add' | 'edit' | 'confirm-delete'
  >('idle');
  const [presetDraftLabel, setPresetDraftLabel] = useState('');
  const [presetDraftSrc, setPresetDraftSrc] = useState('');
  const [presetBusy, setPresetBusy] = useState(false);

  useEffect(() => {
    return subscribePresetImages(() => {
      setPresets(getEffectivePresetImages());
    });
  }, []);

  const selectedPreset = presets.find((p) => p.key === value);
  const isPreset = Boolean(selectedPreset);
  const isDataUpload = !isPreset && value.startsWith('data:image/');
  const isHttpsUrl = !isPreset && value.startsWith('https://');

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

  async function handlePresetFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPresetBusy(true);
    setUploadError(null);
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file);
      setPresetDraftSrc(compressedDataUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to process preset image.'
      );
    } finally {
      setPresetBusy(false);
      if (presetFileInputRef.current) {
        presetFileInputRef.current.value = '';
      }
    }
  }

  function openAddPreset() {
    setPresetDraftLabel('');
    setPresetDraftSrc(isDataUpload || isHttpsUrl ? value : presets[0]?.src || '');
    setPresetMode('add');
  }

  function openEditPreset() {
    if (!selectedPreset) return;
    setPresetDraftLabel(selectedPreset.label);
    setPresetDraftSrc(selectedPreset.src);
    setPresetMode('edit');
  }

  function handleSavePreset() {
    const cleanLabel = presetDraftLabel.trim();
    if (cleanLabel.length < 2) {
      setUploadError('Enter a preset name (at least 2 characters).');
      return;
    }
    const cleanSrc = presetDraftSrc.trim() || presets[0]?.src || '';
    const saved = upsertPresetImageOption({
      key: presetMode === 'edit' && selectedPreset ? selectedPreset.key : undefined,
      label: cleanLabel,
      src: cleanSrc,
    });
    setPresets(getEffectivePresetImages());
    onChange(saved.key);
    setUploadError(null);
    setPresetMode('idle');
  }

  function handleConfirmDeletePreset() {
    if (!selectedPreset) return;
    const fallbackKey = deletePresetImageOption(selectedPreset.key);
    setPresets(getEffectivePresetImages());
    onChange(fallbackKey);
    setPresetMode('idle');
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-stone-700">{label}</label>
        <div className="flex items-center gap-1.5">
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
                ? 'Replace Photo'
                : 'Upload Photo'}
            </span>
          </button>
          {(isDataUpload || isHttpsUrl) && (
            <button
              type="button"
              onClick={() => onChange(presets[0]?.key || 'workspace')}
              title="Reset to studio preset"
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-stone-600 hover:text-red-700 bg-white border border-stone-300/80 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 ${
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'
        } gap-2.5`}
      >
        <div className="flex items-center gap-1">
          <select
            aria-label={`${label} preset`}
            value={isPreset ? value : isDataUpload ? '__uploaded__' : '__url__'}
            onChange={(e) => {
              const next = e.target.value;
              if (next === '__uploaded__' || next === '__url__') return;
              onChange(next);
              setPresetMode('idle');
            }}
            className="flex-1 min-w-0 px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:border-[#9A3412]"
          >
            {isDataUpload && (
              <option value="__uploaded__">Uploaded Device Image (Active)</option>
            )}
            {isHttpsUrl && (
              <option value="__url__">Custom HTTPS Image URL (Active)</option>
            )}
            {presets.map((img) => (
              <option key={img.key} value={img.key}>
                Studio Preset: {img.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openAddPreset}
            title="Add new image preset to dropdown"
            className="p-2 text-stone-700 hover:text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 border border-stone-300/80 rounded-lg cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#9A3412]" />
          </button>

          {isPreset && (
            <>
              <button
                type="button"
                onClick={openEditPreset}
                title="Edit preset name or replace preset photo"
                className="p-2 text-stone-600 hover:text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 border border-stone-300/80 rounded-lg cursor-pointer shrink-0"
              >
                <PenLine className="w-3.5 h-3.5" />
              </button>
              {presets.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPresetMode(
                      presetMode === 'confirm-delete' ? 'idle' : 'confirm-delete'
                    )
                  }
                  title="Remove preset from dropdown"
                  className="p-2 text-stone-500 hover:text-red-700 bg-white hover:bg-red-50 border border-stone-300/80 rounded-lg cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>

        <input
          type="url"
          value={isHttpsUrl ? value : ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange(raw || presets[0]?.key || 'workspace');
          }}
          placeholder="Or paste https:// image URL..."
          className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:border-[#9A3412]"
        />
      </div>

      {(presetMode === 'add' || presetMode === 'edit') && (
        <div className="p-3 rounded-lg bg-[#FBF9F5] border border-stone-300 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-stone-700">
              {presetMode === 'add'
                ? 'Add Studio Image Preset to Dropdown'
                : 'Edit Studio Preset Name & Photo'}
            </span>
            <input
              ref={presetFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handlePresetFileSelect(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={presetBusy}
              onClick={() => presetFileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-800 bg-white border border-stone-300 rounded cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3 h-3 text-[#9A3412]" />
              <span>{presetBusy ? 'Uploading...' : 'Upload Preset Photo'}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={presetDraftLabel}
              onChange={(e) => setPresetDraftLabel(e.target.value)}
              placeholder="Preset title (e.g., Leather Notebook)..."
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded text-stone-900 focus:outline-none focus:border-[#9A3412]"
            />
            <input
              type="url"
              value={presetDraftSrc.startsWith('https://') ? presetDraftSrc : ''}
              onChange={(e) => setPresetDraftSrc(e.target.value.trim())}
              placeholder={
                presetDraftSrc.startsWith('data:image/')
                  ? 'Uploaded photo attached (or paste https:// URL)'
                  : 'Or paste https:// image URL...'
              }
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded text-stone-900 focus:outline-none focus:border-[#9A3412]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSavePreset}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded cursor-pointer whitespace-nowrap"
            >
              <Check className="w-3 h-3" />
              <span>{presetMode === 'add' ? 'Add Preset' : 'Save Preset'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPresetMode('idle')}
              className="px-2 py-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {presetMode === 'confirm-delete' && selectedPreset && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs">
          <span className="text-red-900 truncate">
            Remove preset &ldquo;{selectedPreset.label}&rdquo;?
          </span>
          <div className="inline-flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirmDeletePreset}
              className="font-semibold text-red-700 hover:underline cursor-pointer"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setPresetMode('idle')}
              className="text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}

      {showPreview && (
        <div
          className={`${previewAspectClass} w-full rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80 relative group/imgprev`}
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-stone-900 bg-white/95 hover:bg-white border border-stone-300/90 rounded-lg shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3 h-3 text-[#9A3412]" />
            <span>Change Image</span>
          </button>
        </div>
      )}
    </div>
  );
};
