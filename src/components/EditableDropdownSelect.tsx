import React, { useEffect, useState } from 'react';
import { Check, PenLine, Plus, Trash2, X } from 'lucide-react';

export interface PinnedDropdownOption {
  value: string;
  label: string;
}

interface EditableDropdownSelectProps {
  value: string;
  options: string[];
  onChange: (nextValue: string) => void;
  onAddOption: (newOption: string) => void;
  onRenameOption: (oldOption: string, nextOption: string) => void;
  onDeleteOption: (optionToDelete: string) => void;
  prefixOptions?: PinnedDropdownOption[];
  ariaLabel?: string;
  selectClassName?: string;
  containerClassName?: string;
  placeholder?: string;
  compact?: boolean;
  canEdit?: boolean;
}

export const EditableDropdownSelect: React.FC<EditableDropdownSelectProps> = ({
  value,
  options,
  onChange,
  onAddOption,
  onRenameOption,
  onDeleteOption,
  prefixOptions = [],
  ariaLabel = 'Select option',
  selectClassName = 'px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:border-[#9A3412]',
  containerClassName = '',
  placeholder = 'Option name...',
  compact = false,
  canEdit = false,
}) => {
  const [mode, setMode] = useState<'idle' | 'add' | 'edit' | 'confirm-delete'>('idle');
  const [draftText, setDraftText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit && mode !== 'idle') {
      setMode('idle');
    }
  }, [canEdit, mode]);

  const isPinnedSelected = prefixOptions.some((p) => p.value === value);
  const canModifySelected =
    canEdit && Boolean(value) && !isPinnedSelected && options.includes(value);

  const mergedOptions = React.useMemo(() => {
    const seen = new Set<string>(prefixOptions.map((p) => p.value));
    const list: string[] = [];
    for (const opt of options) {
      const clean = opt.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        list.push(clean);
      }
    }
    if (value && value.trim() && !seen.has(value.trim())) {
      list.push(value.trim());
    }
    return list;
  }, [options, prefixOptions, value]);

  function startAdd() {
    if (!canEdit) return;
    setDraftText('');
    setErrorMsg(null);
    setMode('add');
  }

  function startEdit() {
    if (!canModifySelected) return;
    setDraftText(value);
    setErrorMsg(null);
    setMode('edit');
  }

  function handleSave() {
    if (!canEdit) return;
    const cleaned = draftText.trim().slice(0, 140);
    if (cleaned.length < 2) {
      setErrorMsg('Enter at least 2 characters.');
      return;
    }
    if (prefixOptions.some((p) => p.value.toLowerCase() === cleaned.toLowerCase())) {
      setErrorMsg('Reserved filter option.');
      return;
    }
    if (mode === 'add') {
      onAddOption(cleaned);
      onChange(cleaned);
    } else if (mode === 'edit') {
      if (cleaned !== value) {
        onRenameOption(value, cleaned);
      }
      onChange(cleaned);
    }
    setErrorMsg(null);
    setMode('idle');
  }

  function handleConfirmDelete() {
    if (!canModifySelected) return;
    const idx = options.indexOf(value);
    let fallback = prefixOptions[0]?.value || '';
    if (!fallback) {
      const remaining = options.filter((o) => o !== value);
      fallback =
        remaining[Math.max(0, Math.min(idx, remaining.length - 1))] ||
        remaining[0] ||
        'General';
    }
    onDeleteOption(value);
    onChange(fallback);
    setMode('idle');
  }

  return (
    <div className={`space-y-1.5 ${containerClassName}`}>
      <div className="flex items-center gap-1.5">
        <select
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (mode !== 'idle') setMode('idle');
          }}
          className={`flex-1 min-w-0 ${selectClassName}`}
        >
          {prefixOptions.map((p) => (
            <option key={`pin_${p.value}`} value={p.value}>
              {p.label}
            </option>
          ))}
          {mergedOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        {canEdit && (
          <div className="inline-flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={startAdd}
              title="Add option to dropdown"
              aria-label={`Add option to ${ariaLabel}`}
              className={`inline-flex items-center justify-center gap-1 ${
                compact ? 'px-2 py-1.5 text-[11px]' : 'px-2.5 py-2 text-xs'
              } font-medium text-stone-700 hover:text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 border border-stone-300/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0`}
            >
              <Plus className="w-3.5 h-3.5 text-[#9A3412]" />
              {!compact && <span className="hidden sm:inline">Add</span>}
            </button>

            {canModifySelected && (
              <>
                <button
                  type="button"
                  onClick={startEdit}
                  title={`Rename "${value}"`}
                  aria-label={`Rename ${value}`}
                  className={`inline-flex items-center justify-center ${
                    compact ? 'p-1.5' : 'p-2'
                  } text-stone-600 hover:text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 border border-stone-300/80 rounded-lg transition-colors cursor-pointer shrink-0`}
                >
                  <PenLine className="w-3.5 h-3.5" />
                </button>

                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setMode(mode === 'confirm-delete' ? 'idle' : 'confirm-delete');
                    }}
                    title={`Remove "${value}"`}
                    aria-label={`Remove ${value}`}
                    className={`inline-flex items-center justify-center ${
                      compact ? 'p-1.5' : 'p-2'
                    } text-stone-500 hover:text-red-700 bg-white hover:bg-red-50 border border-stone-300/80 hover:border-red-200 rounded-lg transition-colors cursor-pointer shrink-0`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {canEdit && (mode === 'add' || mode === 'edit') && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-[#FBF9F5] border border-stone-300/90">
          <input
            type="text"
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              } else if (e.key === 'Escape') {
                setMode('idle');
              }
            }}
            placeholder={mode === 'add' ? `New ${placeholder.toLowerCase()}` : placeholder}
            autoFocus
            className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded text-stone-900 focus:outline-none focus:border-[#9A3412]"
          />
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Check className="w-3 h-3" />
            <span>{mode === 'add' ? 'Add' : 'Save'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3 h-3" />
            <span>Cancel</span>
          </button>
          {errorMsg && (
            <span className="w-full text-[11px] text-red-700">{errorMsg}</span>
          )}
        </div>
      )}

      {canEdit && mode === 'confirm-delete' && canModifySelected && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-xs">
          <span className="text-red-900 truncate">
            Remove &ldquo;{value}&rdquo; from list?
          </span>
          <div className="inline-flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="font-semibold text-red-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
