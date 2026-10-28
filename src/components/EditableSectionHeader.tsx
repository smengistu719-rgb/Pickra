import React, { useEffect, useState } from 'react';
import { Check, PenLine, RotateCcw, X } from 'lucide-react';
import { SectionHeaderCopy } from '../types';

interface EditableSectionHeaderProps {
  copy: SectionHeaderCopy;
  onSave: (nextCopy: SectionHeaderCopy) => void;
  onReset?: () => void;
  level?: 'h1' | 'h2';
  showSubtitle?: boolean;
  className?: string;
  canEdit?: boolean;
}

export const EditableSectionHeader: React.FC<EditableSectionHeaderProps> = ({
  copy,
  onSave,
  onReset,
  level = 'h1',
  showSubtitle = true,
  className = '',
  canEdit = false,
}) => {
  const [editing, setEditing] = useState(false);
  const [kicker, setKicker] = useState(copy.kicker);
  const [title, setTitle] = useState(copy.title);
  const [subtitle, setSubtitle] = useState(copy.subtitle || '');

  useEffect(() => {
    setKicker(copy.kicker);
    setTitle(copy.title);
    setSubtitle(copy.subtitle || '');
  }, [copy.kicker, copy.title, copy.subtitle]);

  useEffect(() => {
    if (!canEdit && editing) {
      setEditing(false);
    }
  }, [canEdit, editing]);

  function handleSave() {
    if (!canEdit) return;
    const cleanTitle = title.trim() || copy.title;
    onSave({
      kicker: kicker.trim(),
      title: cleanTitle,
      subtitle: subtitle.trim(),
    });
    setEditing(false);
  }

  if (editing && canEdit) {
    return (
      <div
        className={`p-4 rounded-xl bg-white border border-stone-300 space-y-2.5 max-w-2xl ${className}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-stone-500">
            Edit Section Heading &amp; Description
          </span>
          {onReset && (
            <button
              type="button"
              onClick={() => {
                onReset();
                setEditing(false);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-[#9A3412] cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Default</span>
            </button>
          )}
        </div>
        <input
          type="text"
          value={kicker}
          onChange={(e) => setKicker(e.target.value)}
          placeholder="Section kicker (optional)..."
          className="w-full px-3 py-1.5 text-xs font-medium text-[#9A3412] bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Section headline..."
          className="w-full px-3 py-2 font-serif text-base font-medium text-stone-900 bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
        />
        {showSubtitle && (
          <textarea
            rows={2}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Section description (optional, leave blank to hide)..."
            className="w-full px-3 py-2 text-xs text-stone-700 bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
          />
        )}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Text</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setKicker(copy.kicker);
              setTitle(copy.title);
              setSubtitle(copy.subtitle || '');
              setEditing(false);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group/header ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {copy.kicker && (
          <p className="text-xs font-medium text-[#9A3412]">{copy.kicker}</p>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit section text"
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-stone-500 hover:text-stone-900 bg-[#F3EFE8]/80 hover:bg-stone-200 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <PenLine className="w-3 h-3" />
            <span>Edit Text</span>
          </button>
        )}
      </div>

      {level === 'h1' ? (
        <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-medium text-stone-900 tracking-tight">
          {copy.title}
        </h1>
      ) : (
        <h2 className="mt-1 font-serif text-2xl sm:text-[1.75rem] font-medium text-stone-900 tracking-tight">
          {copy.title}
        </h2>
      )}

      {showSubtitle && copy.subtitle && (
        <p className="mt-2.5 text-sm sm:text-base text-stone-600 leading-relaxed">
          {copy.subtitle}
        </p>
      )}
    </div>
  );
};
