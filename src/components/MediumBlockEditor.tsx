import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  Bookmark,
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Italic,
  Link2,
  Lock,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  Minus,
  Package,
  Palette,
  Plus,
  Quote,
  ShoppingBag,
  Trash2,
  Type,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  DirectProductDraftInput,
  OfferDraftInput,
  PostDraftInput,
  useFirebaseApp,
} from '../context/FirebaseContext';
import {
  AffiliateOffer,
  AffiliatePlatform,
  ALL_AFFILIATE_PLATFORMS,
  BLOG_THEME_PALETTES,
  BlogColorTheme,
  BlogPost,
  CalloutColorTheme,
  DirectProduct,
  DirectProductKind,
  OfferKind,
  PostCategory,
  PublishStatus,
} from '../types';
import {
  compressImageFileToDataUrl,
  formatPriceCents,
  readCompactVideoFileToDataUrl,
} from '../firebase';
import { PRESET_IMAGES } from '../assets/presetImages';
import { DEFAULT_DISCLOSURE } from '../data/editorialSeed';
import {
  blocksToMarkdown,
  computeWordCountAndReadTime,
  createBlockId,
  createEmptyParagraphBlock,
  extractHostnameLabel,
  extractOfferIdsFromBlocks,
  markdownToBlocks,
  StoryBlock,
} from '../utils/editorialBlocks';
import {
  BookmarkLinkCard,
  CALLOUT_STYLES,
  StoryBlocksRenderer,
  VideoEmbedFigure,
} from './EditorialRichBlocks';
import { OfferCard } from './OfferCard';
import { DirectProductCard } from './DirectProductCard';
import { ResilientImage } from './ResilientImage';
import { ImageUploadPicker } from './ImageUploadPicker';
import { EditableDropdownSelect } from './EditableDropdownSelect';

interface MediumBlockEditorProps {
  initialPost?: BlogPost | null;
  onBack: () => void;
  onPublished: (savedPostId: string) => void;
}

const LOCAL_DRAFT_STORAGE_KEY = 'pickra_medium_story_draft_v2';

const POST_CATEGORIES: PostCategory[] = [
  'Field Guides',
  'Hardware & Gear',
  'Digital Systems',
  'Freelance Talent',
];

const BLOG_THEMES: BlogColorTheme[] = [
  'classic',
  'sage',
  'terracotta',
  'slate',
  'midnight',
];

const CALLOUT_THEMES: CalloutColorTheme[] = [
  'amber',
  'sage',
  'terracotta',
  'slate',
  'midnight',
];

function escapeHtmlText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownInlineToHtml(markdown: string): string {
  if (!markdown) return '';
  const tokenRegex =
    /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      result += escapeHtmlText(markdown.slice(lastIndex, match.index)).replace(
        /\n/g,
        '<br>'
      );
    }
    if (match[2] !== undefined && match[3] !== undefined) {
      const safeHref = escapeHtmlText(match[3]);
      const safeLabel = escapeHtmlText(match[2]);
      result += `<a href="${safeHref}" data-inline-link="true" class="text-[#9A3412] underline decoration-[#9A3412]/70 underline-offset-4 font-medium cursor-pointer">${safeLabel}</a>`;
    } else if (match[4] !== undefined) {
      result += `<strong class="font-semibold">${escapeHtmlText(
        match[4]
      )}</strong>`;
    } else if (match[5] !== undefined) {
      result += `<em class="italic">${escapeHtmlText(match[5])}</em>`;
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < markdown.length) {
    result += escapeHtmlText(markdown.slice(lastIndex)).replace(/\n/g, '<br>');
  }

  return result;
}

function serializeChildNodesToMarkdown(parent: Node): string {
  let out = '';
  parent.childNodes.forEach((child, idx) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += (child.textContent || '').replace(/\u00A0/g, ' ');
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();

    if (tag === 'BR') {
      out += '\n';
      return;
    }

    const inner = serializeChildNodesToMarkdown(el);

    if (tag === 'A') {
      const rawHref = (el.getAttribute('href') || '').trim();
      const cleanInner = inner.replace(/[\[\]\n]/g, ' ').trim();
      if (!cleanInner) return;
      if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
        const httpsHref = rawHref.startsWith('http://')
          ? `https://${rawHref.slice(7)}`
          : rawHref;
        out += `[${cleanInner}](${httpsHref})`;
      } else {
        out += cleanInner;
      }
      return;
    }

    if (tag === 'STRONG' || tag === 'B') {
      out += inner ? `**${inner}**` : '';
      return;
    }

    if (tag === 'EM' || tag === 'I') {
      out += inner ? `*${inner}*` : '';
      return;
    }

    if (tag === 'DIV' || tag === 'P') {
      if (idx > 0 && !out.endsWith('\n')) {
        out += '\n';
      }
      out += inner;
      return;
    }

    out += inner;
  });
  return out;
}

function domNodeToMarkdown(root: HTMLElement): string {
  const raw = serializeChildNodesToMarkdown(root);
  return raw.replace(/\n+$/, '');
}

function RichInlineEditable({
  value,
  onChange,
  onFocus,
  onKeyDown,
  onClickLink,
  placeholder,
  className,
  editorRef,
}: {
  value: string;
  onChange: (val: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onClickLink?: (info: {
    linkIndex: number;
    label: string;
    url: string;
  }) => void;
  placeholder?: string;
  className?: string;
  editorRef?: (el: HTMLDivElement | null) => void;
}) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const lastMarkdownRef = useRef<string | null>(null);

  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    if (lastMarkdownRef.current !== value) {
      el.innerHTML = markdownInlineToHtml(value);
      lastMarkdownRef.current = value;
    }
  }, [value]);

  const isEmpty = value.trim().length === 0;

  return (
    <div className="relative w-full">
      {isEmpty && placeholder && (
        <div
          aria-hidden="true"
          className={`pointer-events-none select-none absolute inset-0 text-stone-400 ${
            className || ''
          }`}
        >
          {placeholder}
        </div>
      )}
      <div
        ref={(el) => {
          internalRef.current = el;
          editorRef?.(el);
        }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onInput={(e) => {
          const nextMd = domNodeToMarkdown(e.currentTarget);
          lastMarkdownRef.current = nextMd;
          onChange(nextMd);
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          const anchor = target?.closest('a');
          if (anchor && internalRef.current?.contains(anchor)) {
            e.preventDefault();
            e.stopPropagation();
            const allAnchors = Array.from(
              internalRef.current.querySelectorAll('a')
            );
            const linkIndex = allAnchors.indexOf(anchor);
            onClickLink?.({
              linkIndex: Math.max(0, linkIndex),
              label: (anchor.textContent || '').trim(),
              url: (anchor.getAttribute('href') || '').trim(),
            });
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData('text/plain');
          if (!pasted) return;
          const el = internalRef.current;
          const sel = window.getSelection();
          if (
            el &&
            sel &&
            sel.rangeCount > 0 &&
            el.contains(sel.anchorNode) &&
            !sel.isCollapsed &&
            /^https?:\/\/\S+$/i.test(pasted.trim())
          ) {
            const range = sel.getRangeAt(0);
            const selectedLabel = sel.toString().trim();
            if (selectedLabel) {
              const cleanHref = pasted.trim().startsWith('http://')
                ? `https://${pasted.trim().slice(7)}`
                : pasted.trim();
              const a = document.createElement('a');
              a.setAttribute('href', cleanHref);
              a.setAttribute('data-inline-link', 'true');
              a.className =
                'text-[#9A3412] underline decoration-[#9A3412]/70 underline-offset-4 font-medium cursor-pointer';
              a.textContent = selectedLabel;
              range.deleteContents();
              range.insertNode(a);
              range.setStartAfter(a);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              const nextMd = domNodeToMarkdown(el);
              lastMarkdownRef.current = nextMd;
              onChange(nextMd);
              return;
            }
          }
          document.execCommand('insertText', false, pasted);
        }}
        className={`w-full min-h-[1.75em] whitespace-pre-wrap break-words bg-transparent focus:outline-none ${
          className || ''
        }`}
      />
    </div>
  );
}

interface SavedAffiliateCatalogDropdownProps {
  label: string;
  placeholderLabel: string;
  offers: AffiliateOffer[];
  selectedOfferId?: string;
  onSelectOffer: (offer: AffiliateOffer) => void;
  onSaveOffer: (input: OfferDraftInput) => Promise<string>;
  onDeleteOffer: (offerId: string) => Promise<void>;
}

const SavedAffiliateCatalogDropdown: React.FC<
  SavedAffiliateCatalogDropdownProps
> = ({
  label,
  placeholderLabel,
  offers,
  selectedOfferId,
  onSelectOffer,
  onSaveOffer,
  onDeleteOffer,
}) => {
  const {
    dropdownOptions,
    addDropdownOption,
    renameDropdownOption,
    deleteDropdownOption,
  } = useFirebaseApp();

  const [internalSelectedId, setInternalSelectedId] = useState<string>(
    selectedOfferId || ''
  );
  const [editorMode, setEditorMode] = useState<'closed' | 'add' | 'edit'>(
    'closed'
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftKind, setDraftKind] = useState<OfferKind>('physical');
  const [draftPlatform, setDraftPlatform] =
    useState<AffiliatePlatform>('Amazon');
  const [draftPrice, setDraftPrice] = useState('$99.00');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftImageKey, setDraftImageKey] = useState('audio');
  const [draftVideoUrl, setDraftVideoUrl] = useState('');
  const [draftSummary, setDraftSummary] = useState('');

  useEffect(() => {
    if (selectedOfferId !== undefined) {
      setInternalSelectedId(selectedOfferId);
    }
  }, [selectedOfferId]);

  const activeOffer = useMemo(
    () => offers.find((o) => o.id === internalSelectedId) || null,
    [offers, internalSelectedId]
  );

  function openAddForm() {
    setLocalError(null);
    setConfirmRemove(false);
    setDraftTitle('');
    setDraftKind('physical');
    setDraftPlatform(dropdownOptions.productPlatforms[0] || 'Amazon');
    setDraftPrice('$99.00');
    setDraftUrl('');
    setDraftImageKey('audio');
    setDraftVideoUrl('');
    setDraftSummary('');
    setEditorMode('add');
  }

  function openEditForm() {
    if (!activeOffer) return;
    setLocalError(null);
    setConfirmRemove(false);
    setDraftTitle(activeOffer.title);
    setDraftKind(activeOffer.kind);
    setDraftPlatform(activeOffer.platform);
    setDraftPrice(activeOffer.priceLabel);
    setDraftUrl(activeOffer.affiliateUrl);
    setDraftImageKey(activeOffer.imageKey || 'audio');
    setDraftVideoUrl(activeOffer.videoUrl || '');
    setDraftSummary(activeOffer.summary);
    setEditorMode('edit');
  }

  async function handleSaveItem() {
    setSaving(true);
    setLocalError(null);
    try {
      const targetId =
        editorMode === 'edit' && activeOffer ? activeOffer.id : undefined;
      const cleanSummary =
        draftSummary.trim().length >= 10
          ? draftSummary.trim()
          : `${draftTitle.trim()} on ${draftPlatform} — curated partner link.`;
      const payload: OfferDraftInput = {
        id: targetId,
        title: draftTitle,
        kind: draftKind,
        platform: draftPlatform,
        category:
          editorMode === 'edit' && activeOffer
            ? activeOffer.category
            : draftKind === 'service'
            ? 'Professional Service'
            : 'Featured Pick',
        priceLabel: draftPrice || '$99.00',
        commissionNote:
          editorMode === 'edit' && activeOffer
            ? activeOffer.commissionNote
            : '',
        affiliateUrl: draftUrl,
        imageKey: draftImageKey || 'audio',
        videoUrl: draftVideoUrl,
        summary: cleanSummary,
        highlights:
          editorMode === 'edit' && activeOffer ? activeOffer.highlights : [],
        status: 'published',
      };
      const savedId = await onSaveOffer(payload);
      setInternalSelectedId(savedId);
      setEditorMode('closed');
      let cleanHref = draftUrl.trim();
      if (cleanHref && !cleanHref.startsWith('http')) {
        cleanHref = `https://${cleanHref}`;
      }
      if (cleanHref.startsWith('http://')) {
        cleanHref = `https://${cleanHref.slice(7)}`;
      }
      const nowMs = Date.now();
      onSelectOffer({
        id: savedId,
        title: draftTitle.trim(),
        kind: draftKind,
        platform: draftPlatform,
        category: payload.category,
        priceLabel: payload.priceLabel,
        commissionNote: payload.commissionNote,
        affiliateUrl: cleanHref,
        imageKey: payload.imageKey,
        videoUrl: draftVideoUrl.trim(),
        summary: cleanSummary,
        highlights: payload.highlights,
        status: 'published',
        authorId: editorMode === 'edit' && activeOffer ? activeOffer.authorId : '',
        authorName:
          editorMode === 'edit' && activeOffer ? activeOffer.authorName : 'Pickra',
        createdAtMs:
          editorMode === 'edit' && activeOffer ? activeOffer.createdAtMs : nowMs,
        updatedAtMs: nowMs,
      });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Unable to save catalog item.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemove() {
    if (!activeOffer) return;
    setSaving(true);
    setLocalError(null);
    try {
      await onDeleteOffer(activeOffer.id);
      setConfirmRemove(false);
      setEditorMode('closed');
      const remaining = offers.filter((o) => o.id !== activeOffer.id);
      const next = remaining[0] || null;
      setInternalSelectedId(next ? next.id : '');
      if (next && selectedOfferId !== undefined) {
        onSelectOffer(next);
      }
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Unable to remove catalog item.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-[11px] text-stone-500">{label}</label>
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() =>
              editorMode === 'add' ? setEditorMode('closed') : openAddForm()
            }
            className="inline-flex items-center gap-0.5 font-semibold text-[#9A3412] hover:underline cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>{editorMode === 'add' ? 'Cancel Add' : 'Add'}</span>
          </button>

          {activeOffer && (
            <>
              <span className="text-stone-300" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() =>
                  editorMode === 'edit'
                    ? setEditorMode('closed')
                    : openEditForm()
                }
                className="inline-flex items-center gap-0.5 font-medium text-stone-700 hover:text-[#9A3412] cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3 h-3" />
                <span>{editorMode === 'edit' ? 'Close Edit' : 'Edit'}</span>
              </button>
              <span className="text-stone-300" aria-hidden="true">
                ·
              </span>
              {confirmRemove ? (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleConfirmRemove()}
                    className="font-semibold text-red-700 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="inline-flex items-center gap-0.5 text-stone-500 hover:text-red-700 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <select
        value={internalSelectedId}
        onChange={(e) => {
          const val = e.target.value;
          setInternalSelectedId(val);
          setConfirmRemove(false);
          setEditorMode('closed');
          const picked = offers.find((o) => o.id === val);
          if (picked) {
            onSelectOffer(picked);
          }
        }}
        className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
      >
        <option value="">{placeholderLabel}</option>
        {offers.map((o) => (
          <option key={o.id} value={o.id}>
            {o.platform} ({o.kind}): {o.title} · {o.priceLabel}
          </option>
        ))}
      </select>

      {editorMode !== 'closed' && (
        <div className="p-3 bg-[#FBF9F5] border border-stone-300 rounded-lg space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-stone-900">
              {editorMode === 'edit'
                ? 'Edit Saved Affiliate Item'
                : 'Add New Affiliate Product / Service to List'}
            </span>
            <button
              type="button"
              onClick={() => setEditorMode('closed')}
              className="text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {localError && (
            <div className="px-2.5 py-1.5 bg-red-50 border border-red-200 rounded text-[11px] text-red-900">
              {localError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Product or Service Title"
              className="sm:col-span-2 px-2.5 py-1.5 bg-white border border-stone-300 rounded"
            />
            <select
              value={draftKind}
              onChange={(e) => setDraftKind(e.target.value as OfferKind)}
              className="px-2.5 py-1.5 bg-white border border-stone-300 rounded"
            >
              <option value="physical">Physical Product</option>
              <option value="digital">Digital Product</option>
              <option value="service">Service Affiliate</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
            <EditableDropdownSelect
              ariaLabel="Affiliate Platform"
              value={draftPlatform}
              options={
                draftKind === 'service'
                  ? dropdownOptions.servicePlatforms
                  : dropdownOptions.productPlatforms
              }
              onChange={(val) => setDraftPlatform(val as AffiliatePlatform)}
              onAddOption={(opt) =>
                addDropdownOption(
                  draftKind === 'service'
                    ? 'servicePlatforms'
                    : 'productPlatforms',
                  opt
                )
              }
              onRenameOption={(oldOpt, nextOpt) =>
                renameDropdownOption(
                  draftKind === 'service'
                    ? 'servicePlatforms'
                    : 'productPlatforms',
                  oldOpt,
                  nextOpt
                )
              }
              onDeleteOption={(opt) =>
                deleteDropdownOption(
                  draftKind === 'service'
                    ? 'servicePlatforms'
                    : 'productPlatforms',
                  opt
                )
              }
              placeholder="Platform..."
              compact
              selectClassName="px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded text-stone-900"
            />
            <input
              type="text"
              value={draftPrice}
              onChange={(e) => setDraftPrice(e.target.value)}
              placeholder="Price label (e.g. $49.00)"
              className="px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
            />
          </div>

          <input
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://www.amazon.com/... or https://drive.google.com/..."
            className="w-full px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
          />

          <ImageUploadPicker
            label="Item Image (Upload Photo, Paste URL, or Studio Preset)"
            value={draftImageKey}
            onChange={setDraftImageKey}
            compact
            showPreview={true}
            previewAspectClass="aspect-[16/9]"
          />

          <input
            type="url"
            value={draftVideoUrl}
            onChange={(e) => setDraftVideoUrl(e.target.value)}
            placeholder="Optional Video URL (YouTube, Vimeo, Loom, MP4)"
            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
          />

          <textarea
            rows={2}
            value={draftSummary}
            onChange={(e) => setDraftSummary(e.target.value)}
            placeholder="Description (optional — auto-generated if brief)..."
            className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditorMode('closed')}
              className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveItem()}
              className="px-3.5 py-1.5 font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:bg-stone-300 rounded cursor-pointer whitespace-nowrap"
            >
              {saving
                ? 'Saving...'
                : editorMode === 'edit'
                ? 'Update Item'
                : 'Add to Catalog'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function AutoResizeTextarea({
  value,
  onChange,
  onFocus,
  onKeyDown,
  placeholder,
  className,
  textareaRef,
}: {
  value: string;
  onChange: (val: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        internalRef.current = el;
        textareaRef?.(el);
      }}
      rows={1}
      value={value}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none ${
        className || ''
      }`}
    />
  );
}

export const MediumBlockEditor: React.FC<MediumBlockEditorProps> = ({
  initialPost,
  onBack,
  onPublished,
}) => {
  const {
    siteConfig,
    studioOffers,
    publishedOffers,
    allAccessibleOffersMap,
    studioDirectProducts,
    publishedDirectProducts,
    allAccessibleDirectProductsMap,
    savePost,
    deletePost,
    saveOffer,
    deleteOffer,
    saveDirectProduct,
    deleteDirectProduct,
    updateOfferImage,
    updateDirectProductImage,
    dropdownOptions,
    addDropdownOption,
    renameDropdownOption,
    deleteDropdownOption,
  } = useFirebaseApp();

  const [confirmDeleteStory, setConfirmDeleteStory] = useState(false);
  const [confirmRemoveStoreBlockId, setConfirmRemoveStoreBlockId] = useState<
    string | null
  >(null);
  const [confirmRemoveSidebarOfferId, setConfirmRemoveSidebarOfferId] =
    useState<string | null>(null);
  const [sidebarOfferEditorOpen, setSidebarOfferEditorOpen] = useState(false);
  const [editingSidebarOfferId, setEditingSidebarOfferId] = useState<
    string | undefined
  >(undefined);

  // Preserve initialPost.id (including seed_* IDs so editing replaces starter posts seamlessly)
  const [editingPostId, setEditingPostId] = useState<string | undefined>(
    initialPost?.id
  );
  const [title, setTitle] = useState<string>(initialPost?.title || '');
  const [subtitle, setSubtitle] = useState<string>(initialPost?.subtitle || '');
  const [blogTheme, setBlogTheme] = useState<BlogColorTheme>(
    initialPost?.theme || 'classic'
  );
  const [blocks, setBlocks] = useState<StoryBlock[]>(() => {
    if (initialPost) {
      return markdownToBlocks(initialPost.content);
    }
    try {
      const saved = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
          return parsed.blocks as StoryBlock[];
        }
      }
    } catch {
      // ignore storage errors
    }
    return [createEmptyParagraphBlock('')];
  });

  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [category, setCategory] = useState<PostCategory>(
    initialPost?.category || 'Field Guides'
  );
  const [coverImageValue, setCoverImageValue] = useState<string>(
    initialPost?.coverImageKey || 'workspace'
  );
  const [extraAttachedIds, setExtraAttachedIds] = useState<string[]>(
    initialPost?.attachedOfferIds || []
  );
  const [disclosureText, setDisclosureText] = useState<string>(
    initialPost?.disclosureText ||
      siteConfig.defaultDisclosureText ||
      DEFAULT_DISCLOSURE
  );
  const [featured, setFeatured] = useState<boolean>(
    initialPost?.featured || false
  );
  const [publishStatus, setPublishStatus] = useState<PublishStatus>(
    initialPost?.status === 'draft' ? 'draft' : 'published'
  );

  // Load saved draft or updated initialPost
  useEffect(() => {
    if (initialPost) {
      setEditingPostId(initialPost.id);
      setTitle(initialPost.title);
      setSubtitle(initialPost.subtitle);
      setBlogTheme(initialPost.theme || 'classic');
      setBlocks(markdownToBlocks(initialPost.content));
      setCategory(initialPost.category);
      setCoverImageValue(initialPost.coverImageKey || 'workspace');
      setExtraAttachedIds(initialPost.attachedOfferIds);
      setDisclosureText(initialPost.disclosureText || DEFAULT_DISCLOSURE);
      setFeatured(initialPost.featured);
      setPublishStatus(
        initialPost.status === 'archived' ? 'published' : initialPost.status
      );
      return;
    }

    try {
      const saved = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.title === 'string') setTitle(parsed.title);
        if (typeof parsed.subtitle === 'string') setSubtitle(parsed.subtitle);
        if (typeof parsed.blogTheme === 'string') {
          setBlogTheme(parsed.blogTheme as BlogColorTheme);
        }
        if (typeof parsed.coverImageValue === 'string') {
          setCoverImageValue(parsed.coverImageValue);
        }
      }
    } catch {
      // ignore
    }
  }, [initialPost]);

  // Active Block & Inserter UI State
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [openPlusMenuBlockId, setOpenPlusMenuBlockId] = useState<string | null>(
    null
  );
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  // Inline Link Popover State for Text Blocks
  const [linkPopoverBlockId, setLinkPopoverBlockId] = useState<string | null>(
    null
  );
  const [inlineLinkLabel, setInlineLinkLabel] = useState('');
  const [inlineLinkUrl, setInlineLinkUrl] = useState('');
  const [editingInlineLinkIndex, setEditingInlineLinkIndex] = useState<
    number | null
  >(null);
  const savedSelectionRangeRef = useRef<{
    blockId: string;
    range: Range;
  } | null>(null);

  // Quick-Create / Edit Affiliate Offer State
  const [quickCreateOfferBlockId, setQuickCreateOfferBlockId] = useState<
    string | null
  >(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickKind, setQuickKind] = useState<OfferKind>('physical');
  const [quickPlatform, setQuickPlatform] =
    useState<AffiliatePlatform>('Amazon');
  const [quickPrice, setQuickPrice] = useState('$99.00');
  const [quickUrl, setQuickUrl] = useState('');
  const [quickImageKey, setQuickImageKey] = useState('audio');
  const [quickSummary, setQuickSummary] = useState('');

  // Quick-Create / Edit Direct Store Product Inline Modal inside Direct Product Block
  const [quickCreateProductBlockId, setQuickCreateProductBlockId] = useState<
    string | null
  >(null);
  const [editingBlockProductId, setEditingBlockProductId] = useState<
    string | undefined
  >(undefined);
  const [quickProdTitle, setQuickProdTitle] = useState('');
  const [quickProdKind, setQuickProdKind] =
    useState<DirectProductKind>('physical');
  const [quickProdPriceUsd, setQuickProdPriceUsd] = useState('79.00');
  const [quickProdSku, setQuickProdSku] = useState('PK-ED-01');
  const [quickProdImageKey, setQuickProdImageKey] = useState('edition');
  const [quickProdSummary, setQuickProdSummary] = useState('');

  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  const blockEditableRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-save working draft locally when creating a new story
  useEffect(() => {
    if (initialPost) return;
    try {
      localStorage.setItem(
        LOCAL_DRAFT_STORAGE_KEY,
        JSON.stringify({ title, subtitle, blocks, blogTheme, coverImageValue })
      );
    } catch {
      // ignore storage errors
    }
  }, [title, subtitle, blocks, blogTheme, coverImageValue, initialPost]);

  const activePalette =
    BLOG_THEME_PALETTES[blogTheme] || BLOG_THEME_PALETTES.classic;

  const attachableOffers: AffiliateOffer[] = useMemo(() => {
    const map = new Map<string, AffiliateOffer>();
    for (const item of studioOffers) map.set(item.id, item);
    for (const item of publishedOffers) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioOffers, publishedOffers]);

  const attachableDirectProducts: DirectProduct[] = useMemo(() => {
    const map = new Map<string, DirectProduct>();
    for (const item of studioDirectProducts) map.set(item.id, item);
    for (const item of publishedDirectProducts) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioDirectProducts, publishedDirectProducts]);

  const { words, minutes } = useMemo(
    () => computeWordCountAndReadTime(blocks),
    [blocks]
  );

  const combinedAttachedOfferIds = useMemo(() => {
    const fromBlocks = extractOfferIdsFromBlocks(blocks);
    const merged = Array.from(new Set([...fromBlocks, ...extraAttachedIds]));
    return merged.slice(0, 8);
  }, [blocks, extraAttachedIds]);

  function focusBlockSoon(blockId: string) {
    setFocusedBlockId(blockId);
    requestAnimationFrame(() => {
      const el = blockEditableRefs.current[blockId];
      if (el) {
        el.focus();
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });
  }

  function updateBlock(
    blockId: string,
    updater: (prev: StoryBlock) => StoryBlock
  ) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? updater(b) : b)));
  }

  function insertBlockAfter(afterBlockId: string | null, newBlock: StoryBlock) {
    setBlocks((prev) => {
      if (!afterBlockId) {
        return [...prev, newBlock];
      }
      const idx = prev.findIndex((b) => b.id === afterBlockId);
      if (idx === -1) return [...prev, newBlock];
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
    setOpenPlusMenuBlockId(null);
    focusBlockSoon(newBlock.id);
  }

  function removeBlock(blockId: string) {
    setBlocks((prev) => {
      if (prev.length <= 1) {
        return [createEmptyParagraphBlock('')];
      }
      const idx = prev.findIndex((b) => b.id === blockId);
      const filtered = prev.filter((b) => b.id !== blockId);
      const focusIdx = Math.max(0, idx - 1);
      if (filtered[focusIdx]) {
        focusBlockSoon(filtered[focusIdx].id);
      }
      return filtered;
    });
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  }

  function convertTextBlockType(
    blockId: string,
    nextType: 'paragraph' | 'heading' | 'subheading' | 'quote'
  ) {
    updateBlock(blockId, (prev) => {
      const currentText =
        prev.type === 'paragraph' ||
        prev.type === 'heading' ||
        prev.type === 'subheading' ||
        prev.type === 'quote'
          ? prev.text
          : '';
      return { id: prev.id, type: nextType, text: currentText };
    });
    focusBlockSoon(blockId);
  }

  function wrapSelectedText(blockId: string, wrapper: '**' | '*') {
    const el = blockEditableRefs.current[blockId];
    const target = blocks.find((b) => b.id === blockId);
    if (
      !target ||
      (target.type !== 'paragraph' &&
        target.type !== 'heading' &&
        target.type !== 'subheading' &&
        target.type !== 'quote' &&
        target.type !== 'callout')
    ) {
      return;
    }

    const sel = window.getSelection();
    if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      if (!sel.isCollapsed) {
        document.execCommand(wrapper === '**' ? 'bold' : 'italic', false);
        const nextMd = domNodeToMarkdown(el);
        updateBlock(
          blockId,
          (prev) => ({ ...prev, text: nextMd } as StoryBlock)
        );
        return;
      }
    }

    const suffix = `${wrapper}text${wrapper}`;
    const nextText = target.text
      ? `${target.text}${target.text.endsWith(' ') ? '' : ' '}${suffix}`
      : suffix;
    updateBlock(blockId, (prev) => ({ ...prev, text: nextText } as StoryBlock));
    focusBlockSoon(blockId);
  }

  function openInlineLinkPopover(
    blockId: string,
    existingLink?: { linkIndex: number; label: string; url: string }
  ) {
    const el = blockEditableRefs.current[blockId];
    const target = blocks.find((b) => b.id === blockId);
    if (
      !target ||
      (target.type !== 'paragraph' &&
        target.type !== 'heading' &&
        target.type !== 'subheading' &&
        target.type !== 'quote' &&
        target.type !== 'callout')
    ) {
      return;
    }

    if (existingLink) {
      savedSelectionRangeRef.current = null;
      setEditingInlineLinkIndex(existingLink.linkIndex);
      setInlineLinkLabel(existingLink.label);
      setInlineLinkUrl(existingLink.url);
      setLinkPopoverBlockId(blockId);
      return;
    }

    setEditingInlineLinkIndex(null);
    let selectedText = '';
    const sel = window.getSelection();
    if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0).cloneRange();
      savedSelectionRangeRef.current = { blockId, range };
      selectedText = sel.toString().trim();
    } else {
      savedSelectionRangeRef.current = null;
    }

    setInlineLinkLabel(selectedText || '');
    setInlineLinkUrl('');
    setLinkPopoverBlockId(blockId);
  }

  function replaceNthMarkdownLink(
    source: string,
    targetIndex: number,
    replacement: string
  ): string {
    const regex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let currentIndex = 0;
    return source.replace(regex, (fullMatch) => {
      if (currentIndex === targetIndex) {
        currentIndex += 1;
        return replacement;
      }
      currentIndex += 1;
      return fullMatch;
    });
  }

  function applyInlineLinkToBlock(blockId: string) {
    const target = blocks.find((b) => b.id === blockId);
    if (
      !target ||
      (target.type !== 'paragraph' &&
        target.type !== 'heading' &&
        target.type !== 'subheading' &&
        target.type !== 'quote' &&
        target.type !== 'callout')
    ) {
      return;
    }

    let cleanUrl = inlineLinkUrl.trim();
    if (!cleanUrl) return;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    if (cleanUrl.startsWith('http://')) {
      cleanUrl = `https://${cleanUrl.slice(7)}`;
    }

    const cleanLabel = (
      inlineLinkLabel.trim() || extractHostnameLabel(cleanUrl)
    ).replace(/[\[\]]/g, '');
    const markdownLink = `[${cleanLabel}](${cleanUrl})`;

    if (editingInlineLinkIndex !== null) {
      const updated = replaceNthMarkdownLink(
        target.text,
        editingInlineLinkIndex,
        markdownLink
      );
      updateBlock(blockId, (prev) => ({ ...prev, text: updated } as StoryBlock));
      setLinkPopoverBlockId(null);
      setEditingInlineLinkIndex(null);
      setInlineLinkLabel('');
      setInlineLinkUrl('');
      focusBlockSoon(blockId);
      return;
    }

    const el = blockEditableRefs.current[blockId];
    const saved = savedSelectionRangeRef.current;
    if (el && saved && saved.blockId === blockId && el.contains(saved.range.startContainer)) {
      const a = document.createElement('a');
      a.setAttribute('href', cleanUrl);
      a.setAttribute('data-inline-link', 'true');
      a.className =
        'text-[#9A3412] underline decoration-[#9A3412]/70 underline-offset-4 font-medium cursor-pointer';
      a.textContent = cleanLabel;

      const range = saved.range;
      range.deleteContents();
      range.insertNode(a);
      const nextMd = domNodeToMarkdown(el);
      updateBlock(blockId, (prev) => ({ ...prev, text: nextMd } as StoryBlock));
      savedSelectionRangeRef.current = null;
      setLinkPopoverBlockId(null);
      setInlineLinkLabel('');
      setInlineLinkUrl('');
      focusBlockSoon(blockId);
      return;
    }

    const spacer =
      target.text.length > 0 && !target.text.endsWith(' ') ? ' ' : '';
    const nextText = `${target.text}${spacer}${markdownLink}`;
    updateBlock(blockId, (prev) => ({ ...prev, text: nextText } as StoryBlock));
    setLinkPopoverBlockId(null);
    setInlineLinkLabel('');
    setInlineLinkUrl('');
    focusBlockSoon(blockId);
  }

  function removeInlineLinkFromBlock(blockId: string) {
    if (editingInlineLinkIndex === null) return;
    const target = blocks.find((b) => b.id === blockId);
    if (
      !target ||
      (target.type !== 'paragraph' &&
        target.type !== 'heading' &&
        target.type !== 'subheading' &&
        target.type !== 'quote' &&
        target.type !== 'callout')
    ) {
      return;
    }
    const cleanPlainText = inlineLinkLabel.trim() || 'link';
    const updated = replaceNthMarkdownLink(
      target.text,
      editingInlineLinkIndex,
      cleanPlainText
    );
    updateBlock(blockId, (prev) => ({ ...prev, text: updated } as StoryBlock));
    setLinkPopoverBlockId(null);
    setEditingInlineLinkIndex(null);
    setInlineLinkLabel('');
    setInlineLinkUrl('');
    focusBlockSoon(blockId);
  }

  async function handleImageBlockFileUpload(
    blockId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBlockId(blockId);
    setStatusMessage(null);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      updateBlock(blockId, (prev) =>
        prev.type === 'image' ? { ...prev, src: dataUrl } : prev
      );
    } catch (err) {
      setStatusMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Could not upload image.',
      });
    } finally {
      setUploadingBlockId(null);
      e.target.value = '';
    }
  }

  async function handleVideoBlockFileUpload(
    blockId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBlockId(blockId);
    setStatusMessage(null);
    try {
      const dataUrl = await readCompactVideoFileToDataUrl(file);
      updateBlock(blockId, (prev) =>
        prev.type === 'video' ? { ...prev, url: dataUrl } : prev
      );
    } catch (err) {
      setStatusMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Could not upload video.',
      });
    } finally {
      setUploadingBlockId(null);
      e.target.value = '';
    }
  }

  function handleTextBlockKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    block: Extract<
      StoryBlock,
      { type: 'paragraph' | 'heading' | 'subheading' | 'quote' }
    >
  ) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openInlineLinkPopover(block.id);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = block.text.trim().toLowerCase();

      if (trimmed === '/image') {
        updateBlock(block.id, () => ({
          id: block.id,
          type: 'image',
          src: 'workspace',
          caption: '',
          linkUrl: '',
          wide: false,
        }));
        return;
      }
      if (trimmed === '/video') {
        updateBlock(block.id, () => ({
          id: block.id,
          type: 'video',
          url: '',
          caption: '',
        }));
        return;
      }
      if (trimmed === '/link') {
        updateBlock(block.id, () => ({
          id: block.id,
          type: 'bookmark',
          url: '',
          title: '',
          description: '',
          ctaLabel: 'Visit Link',
        }));
        return;
      }
      if (trimmed === '/callout' || trimmed === '/theme') {
        updateBlock(block.id, () => ({
          id: block.id,
          type: 'callout',
          theme: 'sage',
          title: 'Key Takeaway',
          text: '',
        }));
        return;
      }
      if (
        trimmed === '/store' ||
        trimmed === '/direct' ||
        trimmed === '/product'
      ) {
        const defaultProductId = attachableDirectProducts[0]?.id || '';
        updateBlock(block.id, () => ({
          id: block.id,
          type: 'product',
          productId: defaultProductId,
        }));
        return;
      }
      if (trimmed === '/offer' || trimmed === '/affiliate') {
        const defaultOfferId = attachableOffers[0]?.id || '';
        updateBlock(block.id, () => ({
          id: block.id,
          type: 'offer',
          offerId: defaultOfferId,
        }));
        return;
      }
      if (trimmed === '/divider') {
        updateBlock(block.id, () => ({ id: block.id, type: 'divider' }));
        insertBlockAfter(block.id, createEmptyParagraphBlock(''));
        return;
      }

      insertBlockAfter(block.id, createEmptyParagraphBlock(''));
      return;
    }

    if (e.key === 'Backspace' && block.text.length === 0 && blocks.length > 1) {
      e.preventDefault();
      removeBlock(block.id);
    }
  }

  function createBlockByKind(
    kind:
      | 'paragraph'
      | 'heading'
      | 'quote'
      | 'callout'
      | 'image'
      | 'video'
      | 'bookmark'
      | 'offer'
      | 'product'
      | 'divider'
  ): StoryBlock {
    const id = createBlockId();
    switch (kind) {
      case 'paragraph':
        return { id, type: 'paragraph', text: '' };
      case 'heading':
        return { id, type: 'heading', text: '' };
      case 'quote':
        return { id, type: 'quote', text: '' };
      case 'callout':
        return {
          id,
          type: 'callout',
          theme: 'sage',
          title: 'Key Takeaway',
          text: '',
        };
      case 'image':
        return {
          id,
          type: 'image',
          src: 'workspace',
          caption: '',
          linkUrl: '',
          wide: false,
        };
      case 'video':
        return { id, type: 'video', url: '', caption: '' };
      case 'bookmark':
        return {
          id,
          type: 'bookmark',
          url: '',
          title: '',
          description: '',
          ctaLabel: 'Visit Link',
        };
      case 'offer':
        return {
          id,
          type: 'offer',
          offerId: attachableOffers[0]?.id || '',
        };
      case 'product':
        return {
          id,
          type: 'product',
          productId: attachableDirectProducts[0]?.id || '',
        };
      case 'divider':
        return { id, type: 'divider' };
    }
  }

  function clearDraftCanvas() {
    setEditingPostId(undefined);
    setTitle('');
    setSubtitle('');
    setBlogTheme('classic');
    setCoverImageValue('workspace');
    setBlocks([createEmptyParagraphBlock('')]);
    setExtraAttachedIds([]);
    try {
      localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function handleDeleteCurrentStory() {
    if (!editingPostId) return;
    setBusy(true);
    try {
      await deletePost(editingPostId);
      setConfirmDeleteStory(false);
      onBack();
    } catch (err) {
      setStatusMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Could not delete blog post.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickCreateOfferForBlock(targetBlockId: string) {
    setBusy(true);
    setStatusMessage(null);
    try {
      const input: OfferDraftInput = {
        title: quickTitle,
        kind: quickKind,
        platform: quickPlatform,
        category:
          quickKind === 'service' ? 'Professional Service' : 'Featured Pick',
        priceLabel: quickPrice,
        commissionNote: '',
        affiliateUrl: quickUrl,
        imageKey: quickImageKey,
        summary: quickSummary,
        highlights: [],
        status: 'published',
      };
      const newOfferId = await saveOffer(input);
      updateBlock(targetBlockId, () => ({
        id: targetBlockId,
        type: 'offer',
        offerId: newOfferId,
      }));
      setQuickCreateOfferBlockId(null);
      setQuickTitle('');
      setQuickUrl('');
      setQuickSummary('');
      setStatusMessage({
        tone: 'ok',
        text: 'Created affiliate product/service and embedded it into your blog.',
      });
    } catch (err) {
      setStatusMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Could not create offering.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickCreateProductForBlock(targetBlockId: string) {
    const parsedUsd = Number.parseFloat(quickProdPriceUsd);
    const priceCents = Number.isFinite(parsedUsd)
      ? Math.max(100, Math.round(parsedUsd * 100))
      : 4900;

    setBusy(true);
    setStatusMessage(null);
    try {
      const existingProd = editingBlockProductId
        ? allAccessibleDirectProductsMap[editingBlockProductId]
        : undefined;
      const input: DirectProductDraftInput = {
        id: editingBlockProductId,
        title: quickProdTitle,
        subtitle:
          existingProd?.subtitle ||
          quickProdSummary.trim().slice(0, 140) ||
          'Sold directly on Pickra Store with tracked fulfillment.',
        kind: quickProdKind,
        category:
          existingProd?.category ||
          (quickProdKind === 'digital' ? 'Digital Editions' : 'Studio Editions'),
        sku: quickProdSku || 'PK-DIR-01',
        priceCents,
        compareAtCents: existingProd?.compareAtCents || 0,
        stockCount:
          existingProd?.stockCount ?? (quickProdKind === 'digital' ? 999 : 25),
        badgeLabel: existingProd?.badgeLabel || 'Pickra Direct',
        imageKey: quickProdImageKey,
        videoUrl: existingProd?.videoUrl,
        digitalFileUrl: existingProd?.digitalFileUrl,
        digitalFileName: existingProd?.digitalFileName,
        digitalFileType: existingProd?.digitalFileType,
        summary: quickProdSummary,
        highlights: existingProd?.highlights || [],
        deliveryNote:
          existingProd?.deliveryNote ||
          (quickProdKind === 'digital'
            ? 'Instant digital download after checkout'
            : 'Ships in 48 hours'),
        featured: existingProd?.featured ?? false,
        status: 'published',
      };
      const newProductId = await saveDirectProduct(input);
      updateBlock(targetBlockId, () => ({
        id: targetBlockId,
        type: 'product',
        productId: newProductId,
      }));
      setQuickCreateProductBlockId(null);
      setEditingBlockProductId(undefined);
      setQuickProdTitle('');
      setQuickProdSummary('');
      setStatusMessage({
        tone: 'ok',
        text: editingBlockProductId
          ? 'Updated Store product and synced inside your blog.'
          : 'Created Store product and embedded it into your blog.',
      });
    } catch (err) {
      setStatusMessage({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'Could not save Store product.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveOrPublish(targetStatus: PublishStatus) {
    const compiledMarkdown = blocksToMarkdown(blocks);
    if (title.trim().length < 4) {
      setStatusMessage({
        tone: 'err',
        text: 'Please add a blog title of at least 4 characters.',
      });
      return;
    }
    if (compiledMarkdown.trim().length < 20) {
      setStatusMessage({
        tone: 'err',
        text: 'Please write at least a couple of sentences or media blocks before publishing.',
      });
      return;
    }

    const autoSubtitle =
      subtitle.trim().length >= 8
        ? subtitle.trim()
        : compiledMarkdown
            .replace(/[#>*_`\[\]()@-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);

    setBusy(true);
    setStatusMessage(null);

    try {
      const payload: PostDraftInput = {
        id: editingPostId,
        title: title.trim(),
        subtitle:
          autoSubtitle.length >= 8
            ? autoSubtitle
            : `${title.trim()} — editorial review and curated links.`,
        category,
        readTimeMinutes: minutes,
        coverImageKey: coverImageValue || 'workspace',
        content: compiledMarkdown,
        theme: blogTheme,
        attachedOfferIds: combinedAttachedOfferIds,
        disclosureText: disclosureText.trim() || DEFAULT_DISCLOSURE,
        featured,
        status: targetStatus,
        publishedLabel: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      };

      const savedId = await savePost(payload);
      setEditingPostId(savedId);

      if (!initialPost) {
        try {
          localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
      }

      if (targetStatus === 'published') {
        setShowPublishSheet(false);
        onPublished(savedId);
      } else {
        setPublishStatus(targetStatus);
        setShowPublishSheet(false);
        setStatusMessage({
          tone: 'ok',
          text: 'Blog draft saved to your workspace.',
        });
      }
    } catch (err) {
      setStatusMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Unable to publish blog.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`min-h-[82vh] transition-colors duration-200 ${activePalette.canvasClass}`}
    >
      {/* Medium-Style Minimal Story Bar + Live Color Theme Picker */}
      <div className="border-b border-stone-200/80 bg-[#FBF9F5] text-stone-900">
        <div className="max-w-[1040px] mx-auto px-5 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Blog</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-500">
              <span>
                {editingPostId ? 'Editing blog story' : 'Draft in progress'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{words} words</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{minutes} min read</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Blog Color Theme Selector */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg"
              title="Choose blog color theme"
            >
              <Palette className="w-3.5 h-3.5 text-[#9A3412] shrink-0" />
              <span className="hidden md:inline text-[11px] font-medium text-stone-600">
                Theme:
              </span>
              {BLOG_THEMES.map((tId) => {
                const cfg = BLOG_THEME_PALETTES[tId];
                const selected = blogTheme === tId;
                return (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => setBlogTheme(tId)}
                    title={cfg.label}
                    aria-label={`Select ${cfg.label} color theme`}
                    className={`w-4 h-4 rounded-full border transition-transform cursor-pointer ${
                      selected
                        ? 'scale-110 ring-2 ring-[#9A3412] border-transparent'
                        : 'border-stone-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: cfg.swatchHex }}
                  />
                );
              })}
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE8] rounded-lg">
              <button
                type="button"
                onClick={() => setEditorMode('write')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  editorMode === 'write'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Write Blocks
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('preview')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  editorMode === 'preview'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Reader Preview
              </button>
            </div>

            {editingPostId && (
              confirmDeleteStory ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDeleteCurrentStory()}
                    className="font-semibold text-red-700 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteStory(false)}
                    className="text-stone-500 hover:text-stone-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteStory(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-red-700 border border-stone-200 rounded-lg bg-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )
            )}

            {!initialPost &&
              (title ||
                blocks.length > 1 ||
                (blocks[0]?.type === 'paragraph' && blocks[0].text)) && (
                <button
                  type="button"
                  onClick={clearDraftCanvas}
                  className="hidden md:inline-flex px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Clear
                </button>
              )}

            <button
              type="button"
              onClick={() => setShowPublishSheet((v) => !v)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {showPublishSheet ? 'Close Settings' : 'Publish / Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Status Notification */}
      {statusMessage && (
        <div className="max-w-[780px] mx-auto px-5 sm:px-8 pt-5">
          <div
            role="status"
            className={`px-4 py-3 rounded-lg border text-xs flex items-center justify-between gap-4 ${
              statusMessage.tone === 'ok'
                ? 'bg-stone-100 border-stone-300 text-stone-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="underline font-medium cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Medium-Style Story Settings & Publish Panel */}
      {showPublishSheet && (
        <div className="border-b border-stone-200 bg-white text-stone-900">
          <div className="max-w-[1040px] mx-auto px-5 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Story Card Preview, Local Cover Upload & Theme */}
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-serif text-lg font-medium text-stone-900">
                Cover Image, Category &amp; Color Theme
              </h2>

              <ImageUploadPicker
                value={coverImageValue}
                onChange={setCoverImageValue}
                label="Blog Cover Photography (Upload or URL)"
                showPreview={true}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Blog Category
                  </label>
                  <EditableDropdownSelect
                    ariaLabel="Blog Category"
                    value={category}
                    options={dropdownOptions.blogCategories}
                    onChange={(val) => setCategory(val as PostCategory)}
                    onAddOption={(opt) =>
                      addDropdownOption('blogCategories', opt)
                    }
                    onRenameOption={(oldOpt, nextOpt) =>
                      renameDropdownOption('blogCategories', oldOpt, nextOpt)
                    }
                    onDeleteOption={(opt) =>
                      deleteDropdownOption('blogCategories', opt)
                    }
                    placeholder="Category..."
                    compact
                    selectClassName="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Article Color Theme
                  </label>
                  <select
                    value={blogTheme}
                    onChange={(e) =>
                      setBlogTheme(e.target.value as BlogColorTheme)
                    }
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  >
                    {BLOG_THEMES.map((tId) => (
                      <option key={tId} value={tId}>
                        {BLOG_THEME_PALETTES[tId].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs font-medium text-stone-800 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="accent-[#9A3412] w-4 h-4"
                />
                <span>Feature as Lead Story on Blog Hero</span>
              </label>
            </div>

            {/* Sidebar Attached Links & Final Publish Buttons */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-lg font-medium text-stone-900">
                      Sidebar Affiliate Picks ({combinedAttachedOfferIds.length}/8)
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Attach, add, edit, or remove affiliate products and services shown in the reading rail:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSidebarOfferId(undefined);
                      setQuickTitle('');
                      setQuickKind('physical');
                      setQuickPlatform(
                        dropdownOptions.productPlatforms[0] || 'Amazon'
                      );
                      setQuickPrice('$99.00');
                      setQuickUrl('');
                      setQuickImageKey('audio');
                      setQuickSummary('');
                      setSidebarOfferEditorOpen((v) => !v);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#9A3412] bg-[#F5F2EB] hover:bg-stone-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{sidebarOfferEditorOpen ? 'Close Form' : 'Add Pick'}</span>
                  </button>
                </div>

                {sidebarOfferEditorOpen && (
                  <div className="p-3 bg-[#FBF9F5] border border-stone-300 rounded-lg space-y-2.5 text-xs">
                    <div className="font-semibold text-stone-900">
                      {editingSidebarOfferId
                        ? 'Edit Sidebar Affiliate Pick'
                        : 'Add New Affiliate Pick'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                      <input
                        type="text"
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        placeholder="Title"
                        className="px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                      />
                      <EditableDropdownSelect
                        ariaLabel="Affiliate Platform"
                        value={quickPlatform}
                        options={
                          quickKind === 'service'
                            ? dropdownOptions.servicePlatforms
                            : dropdownOptions.productPlatforms
                        }
                        onChange={(val) =>
                          setQuickPlatform(val as AffiliatePlatform)
                        }
                        onAddOption={(opt) =>
                          addDropdownOption(
                            quickKind === 'service'
                              ? 'servicePlatforms'
                              : 'productPlatforms',
                            opt
                          )
                        }
                        onRenameOption={(oldOpt, nextOpt) =>
                          renameDropdownOption(
                            quickKind === 'service'
                              ? 'servicePlatforms'
                              : 'productPlatforms',
                            oldOpt,
                            nextOpt
                          )
                        }
                        onDeleteOption={(opt) =>
                          deleteDropdownOption(
                            quickKind === 'service'
                              ? 'servicePlatforms'
                              : 'productPlatforms',
                            opt
                          )
                        }
                        placeholder="Platform..."
                        compact
                        selectClassName="px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded text-stone-900"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        value={quickKind}
                        onChange={(e) =>
                          setQuickKind(e.target.value as OfferKind)
                        }
                        className="px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                      >
                        <option value="physical">Physical Product</option>
                        <option value="digital">Digital Product</option>
                        <option value="service">Service Affiliate</option>
                      </select>
                      <input
                        type="text"
                        value={quickPrice}
                        onChange={(e) => setQuickPrice(e.target.value)}
                        placeholder="$99.00"
                        className="px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
                      />
                      <input
                        type="url"
                        value={quickUrl}
                        onChange={(e) => setQuickUrl(e.target.value)}
                        placeholder="https://..."
                        className="px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
                      />
                    </div>
                    <ImageUploadPicker
                      label="Pick Image"
                      value={quickImageKey}
                      onChange={setQuickImageKey}
                      compact
                      showPreview={false}
                    />
                    <input
                      type="text"
                      value={quickSummary}
                      onChange={(e) => setQuickSummary(e.target.value)}
                      placeholder="Short summary..."
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSidebarOfferEditorOpen(false)}
                        className="px-2.5 py-1 text-stone-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const savedId = await saveOffer({
                              id: editingSidebarOfferId,
                              title: quickTitle,
                              kind: quickKind,
                              platform: quickPlatform,
                              category:
                                quickKind === 'service'
                                  ? 'Professional Service'
                                  : 'Featured Pick',
                              priceLabel: quickPrice || '$99.00',
                              commissionNote: '',
                              affiliateUrl: quickUrl,
                              imageKey: quickImageKey || 'audio',
                              summary:
                                quickSummary.trim().length >= 10
                                  ? quickSummary.trim()
                                  : `${quickTitle.trim()} on ${quickPlatform} — partner link.`,
                              highlights: [],
                              status: 'published',
                            });
                            setExtraAttachedIds((prev) =>
                              prev.includes(savedId)
                                ? prev
                                : [...prev, savedId].slice(0, 8)
                            );
                            setSidebarOfferEditorOpen(false);
                            setEditingSidebarOfferId(undefined);
                          } catch (err) {
                            setStatusMessage({
                              tone: 'err',
                              text:
                                err instanceof Error
                                  ? err.message
                                  : 'Could not save affiliate pick.',
                            });
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="px-3 py-1 font-semibold text-white bg-[#9A3412] rounded cursor-pointer"
                      >
                        Save Pick
                      </button>
                    </div>
                  </div>
                )}

                <div className="max-h-44 overflow-y-auto divide-y divide-stone-200/80 border border-stone-200 rounded-lg bg-[#FBF9F5]">
                  {attachableOffers.map((offer) => {
                    const checked = combinedAttachedOfferIds.includes(offer.id);
                    return (
                      <div
                        key={offer.id}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-white"
                      >
                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setExtraAttachedIds((prev) =>
                                prev.includes(offer.id)
                                  ? prev.filter((id) => id !== offer.id)
                                  : prev.length < 8
                                  ? [...prev, offer.id]
                                  : prev
                              );
                            }}
                            className="accent-[#9A3412]"
                          />
                          <span className="truncate font-medium text-stone-900">
                            {offer.title}
                          </span>
                          <span className="text-stone-500 whitespace-nowrap shrink-0">
                            · {offer.platform} · {offer.priceLabel}
                          </span>
                        </label>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSidebarOfferId(offer.id);
                              setQuickTitle(offer.title);
                              setQuickKind(offer.kind);
                              setQuickPlatform(offer.platform);
                              setQuickPrice(offer.priceLabel);
                              setQuickUrl(offer.affiliateUrl);
                              setQuickImageKey(offer.imageKey || 'audio');
                              setQuickSummary(offer.summary);
                              setSidebarOfferEditorOpen(true);
                            }}
                            className="text-stone-600 hover:text-[#9A3412] cursor-pointer"
                            title="Edit pick"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmRemoveSidebarOfferId === offer.id ? (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteOffer(offer.id);
                                  setConfirmRemoveSidebarOfferId(null);
                                }}
                                className="font-semibold text-red-700 hover:underline cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmRemoveSidebarOfferId(null)
                                }
                                className="text-stone-500 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmRemoveSidebarOfferId(offer.id)
                              }
                              className="text-stone-400 hover:text-red-700 cursor-pointer"
                              title="Remove pick"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    FTC Affiliate Disclosure Statement
                  </label>
                  <input
                    type="text"
                    value={disclosureText}
                    onChange={(e) => setDisclosureText(e.target.value)}
                    maxLength={400}
                    className="w-full px-3 py-2 text-xs text-stone-600 bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSaveOrPublish('draft')}
                  className="px-4 py-2.5 text-xs font-medium text-stone-700 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void handleSaveOrPublish(
                      publishStatus === 'archived' ? 'archived' : 'published'
                    )
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {editingPostId
                      ? 'Update & Publish Blog'
                      : 'Publish Blog to Global Audience'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WRITING CANVAS OR READER PREVIEW */}
      {editorMode === 'preview' ? (
        <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-12">
          <div className={`text-xs ${activePalette.mutedClass}`}>
            <span className="font-medium text-[#9A3412]">{category}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums">{minutes} min read</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>Theme: {activePalette.label}</span>
          </div>

          <h1
            className={`mt-3 font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-medium ${activePalette.textClass} leading-[1.15]`}
          >
            {title || 'Untitled Blog Story'}
          </h1>

          {subtitle && (
            <p
              className={`mt-4 text-lg sm:text-xl ${activePalette.mutedClass} leading-relaxed`}
            >
              {subtitle}
            </p>
          )}

          <div
            className={`my-8 aspect-[16/9] rounded-xl overflow-hidden bg-[#F3EFE8] border ${activePalette.borderClass}`}
          >
            <ResilientImage
              imageKey={coverImageValue || 'workspace'}
              alt={title || 'Story cover'}
              className="w-full h-full object-cover"
            />
          </div>

          <StoryBlocksRenderer
            blocks={blocks}
            offersMap={allAccessibleOffersMap}
            directProductsMap={allAccessibleDirectProductsMap}
            enableDropCap={true}
            articleTheme={blogTheme}
          />
        </div>
      ) : (
        <div className="max-w-[780px] mx-auto px-5 sm:px-10 py-10 sm:py-14">
          {/* Medium-Style Title & Standfirst */}
          <div className="sm:pl-11">
            <AutoResizeTextarea
              value={title}
              onChange={setTitle}
              placeholder="Blog Title"
              className={`font-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-medium ${activePalette.textClass} placeholder:text-stone-400 leading-[1.16] tracking-tight`}
            />

            <div className={`mt-3 pb-6 border-b ${activePalette.borderClass}`}>
              <AutoResizeTextarea
                value={subtitle}
                onChange={setSubtitle}
                placeholder="Write a subtitle or summary..."
                className={`text-lg sm:text-xl ${activePalette.mutedClass} placeholder:text-stone-400 leading-relaxed`}
              />
            </div>
          </div>

          {/* Interactive Block Stream */}
          <div className="mt-8 space-y-5">
            {blocks.map((block, index) => {
              const isFocused = focusedBlockId === block.id;
              const isPlusOpen = openPlusMenuBlockId === block.id;
              const isTextKind =
                block.type === 'paragraph' ||
                block.type === 'heading' ||
                block.type === 'subheading' ||
                block.type === 'quote';

              return (
                <div key={block.id} className="group relative">
                  <div className="flex items-start gap-2 sm:gap-3">
                    {/* Left Gutter Medium '+' Button */}
                    <button
                      type="button"
                      title="Insert image, video, link, color callout, or product block"
                      aria-label="Insert block below"
                      onClick={() =>
                        setOpenPlusMenuBlockId((prev) =>
                          prev === block.id ? null : block.id
                        )
                      }
                      className={`mt-1 w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        isPlusOpen
                          ? 'border-stone-900 bg-stone-900 text-white rotate-45'
                          : 'border-stone-300 text-stone-600 hover:border-stone-900 hover:text-stone-900 bg-white'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {/* Block Content Surface */}
                    <div className="flex-1 min-w-0">
                      {/* Contextual Formatting & Link Toolbar for Focused Text Blocks */}
                      {isTextKind && isFocused && (
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#1C1917] text-stone-200 rounded-lg text-xs">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                wrapSelectedText(block.id, '**');
                              }}
                              title="Bold"
                              className="p-1.5 hover:bg-stone-800 rounded cursor-pointer"
                            >
                              <Bold className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                wrapSelectedText(block.id, '*');
                              }}
                              title="Italic"
                              className="p-1.5 hover:bg-stone-800 rounded cursor-pointer"
                            >
                              <Italic className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                openInlineLinkPopover(block.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 hover:bg-stone-800 rounded text-amber-200 font-medium cursor-pointer whitespace-nowrap"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Add Link</span>
                            </button>

                            <span className="mx-1 text-stone-600">|</span>

                            {(
                              [
                                ['paragraph', 'Text'],
                                ['heading', 'H2'],
                                ['subheading', 'H3'],
                                ['quote', 'Quote'],
                              ] as const
                            ).map(([tType, label]) => (
                              <button
                                key={tType}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  convertTextBlockType(block.id, tType);
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
                                  block.type === tType
                                    ? 'bg-white text-stone-900'
                                    : 'hover:bg-stone-800 text-stone-300'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                moveBlock(block.id, -1);
                              }}
                              title="Move block up"
                              className="p-1 hover:bg-stone-800 rounded disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === blocks.length - 1}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                moveBlock(block.id, 1);
                              }}
                              title="Move block down"
                              className="p-1 hover:bg-stone-800 rounded disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                removeBlock(block.id);
                              }}
                              title="Delete block"
                              className="p-1 hover:bg-red-900/60 text-stone-300 hover:text-red-200 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Link Insertion & Edit Popover */}
                      {linkPopoverBlockId === block.id && (
                        <div className="mb-3 p-4 bg-white text-stone-900 border border-stone-300 rounded-xl shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-900">
                              {editingInlineLinkIndex !== null
                                ? 'Edit or Remove Embedded Hyperlink'
                                : 'Insert Inline Link or Affiliate Link'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLinkPopoverBlockId(null);
                                setEditingInlineLinkIndex(null);
                              }}
                              className="text-stone-400 hover:text-stone-700 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Link Text (Visible Hyperlink Words)
                              </label>
                              <input
                                type="text"
                                value={inlineLinkLabel}
                                onChange={(e) =>
                                  setInlineLinkLabel(e.target.value)
                                }
                                placeholder="e.g., HTML or Check price on Amazon"
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              />
                            </div>
                            <SavedAffiliateCatalogDropdown
                              label="Quick-Fill from Saved Affiliate Catalog"
                              placeholderLabel="Or choose a saved product/service..."
                              offers={attachableOffers}
                              onSelectOffer={(picked) => {
                                if (!inlineLinkLabel.trim()) {
                                  setInlineLinkLabel(picked.title);
                                }
                                setInlineLinkUrl(picked.affiliateUrl);
                              }}
                              onSaveOffer={saveOffer}
                              onDeleteOffer={deleteOffer}
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="url"
                              value={inlineLinkUrl}
                              onChange={(e) => setInlineLinkUrl(e.target.value)}
                              placeholder="https://www.amazon.com/... or https://drive.google.com/..."
                              className="flex-1 px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            />
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {editingInlineLinkIndex !== null &&
                                inlineLinkUrl.trim().startsWith('http') && (
                                  <a
                                    href={inlineLinkUrl.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-stone-700 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg whitespace-nowrap"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              {editingInlineLinkIndex !== null && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeInlineLinkFromBlock(block.id)
                                  }
                                  className="px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer whitespace-nowrap"
                                >
                                  Remove Link
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => applyInlineLinkToBlock(block.id)}
                                className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {editingInlineLinkIndex !== null
                                  ? 'Update Link'
                                  : 'Apply Link'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PARAGRAPH BLOCK (WYSIWYG Hyperlinks — Raw URLs Hidden) */}
                      {block.type === 'paragraph' && (
                        <div>
                          <RichInlineEditable
                            editorRef={(el) => {
                              blockEditableRefs.current[block.id] = el;
                            }}
                            value={block.text}
                            onFocus={() => setFocusedBlockId(block.id)}
                            onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                            onClickLink={(info) =>
                              openInlineLinkPopover(block.id, info)
                            }
                            onChange={(val) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                text: val,
                              }))
                            }
                            placeholder={
                              index === 0
                                ? 'Tell your story... (Click + on the left to upload images, embed videos, add links, color callouts, or affiliate products)'
                                : 'Write paragraph, or press + to insert media...'
                            }
                            className={`text-base sm:text-[17px] ${activePalette.textClass} leading-[1.8]`}
                          />
                        </div>
                      )}

                      {/* HEADING BLOCK */}
                      {block.type === 'heading' && (
                        <RichInlineEditable
                          editorRef={(el) => {
                            blockEditableRefs.current[block.id] = el;
                          }}
                          value={block.text}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                          onClickLink={(info) =>
                            openInlineLinkPopover(block.id, info)
                          }
                          onChange={(val) =>
                            updateBlock(block.id, (prev) => ({
                              ...(prev as typeof block),
                              text: val,
                            }))
                          }
                          placeholder="Section heading..."
                          className={`pt-2 font-serif text-2xl sm:text-[1.65rem] font-medium ${activePalette.textClass} leading-snug`}
                        />
                      )}

                      {/* SUBHEADING BLOCK */}
                      {block.type === 'subheading' && (
                        <RichInlineEditable
                          editorRef={(el) => {
                            blockEditableRefs.current[block.id] = el;
                          }}
                          value={block.text}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                          onClickLink={(info) =>
                            openInlineLinkPopover(block.id, info)
                          }
                          onChange={(val) =>
                            updateBlock(block.id, (prev) => ({
                              ...(prev as typeof block),
                              text: val,
                            }))
                          }
                          placeholder="Subheading..."
                          className={`pt-1 font-serif text-xl font-medium ${activePalette.textClass} leading-snug`}
                        />
                      )}

                      {/* QUOTE BLOCK */}
                      {block.type === 'quote' && (
                        <div
                          className={`py-4 border-y ${activePalette.borderClass}`}
                        >
                          <RichInlineEditable
                            editorRef={(el) => {
                              blockEditableRefs.current[block.id] = el;
                            }}
                            value={block.text}
                            onFocus={() => setFocusedBlockId(block.id)}
                            onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                            onClickLink={(info) =>
                              openInlineLinkPopover(block.id, info)
                            }
                            onChange={(val) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                text: val,
                              }))
                            }
                            placeholder="Write a memorable pull quote..."
                            className={`font-serif italic text-xl sm:text-2xl ${activePalette.textClass} leading-relaxed`}
                          />
                        </div>
                      )}

                      {/* INLINE COLOR THEME CALLOUT BLOCK */}
                      {block.type === 'callout' && (
                        <div
                          className={`my-2 rounded-xl p-4 sm:p-5 space-y-3 ${
                            CALLOUT_STYLES[block.theme]?.boxClass ||
                            CALLOUT_STYLES.amber.boxClass
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/10">
                            <div className="flex items-center gap-2">
                              <Palette className="w-3.5 h-3.5 opacity-80" />
                              <span
                                className={`text-xs font-semibold ${
                                  CALLOUT_STYLES[block.theme]?.titleClass || ''
                                }`}
                              >
                                Color Theme Callout
                              </span>
                              <div className="flex items-center gap-1 ml-1">
                                {CALLOUT_THEMES.map((cTheme) => (
                                  <button
                                    key={cTheme}
                                    type="button"
                                    title={CALLOUT_STYLES[cTheme].label}
                                    onClick={() =>
                                      updateBlock(block.id, (prev) =>
                                        prev.type === 'callout'
                                          ? { ...prev, theme: cTheme }
                                          : prev
                                      )
                                    }
                                    className={`w-4 h-4 rounded-full border cursor-pointer ${
                                      block.theme === cTheme
                                        ? 'ring-2 ring-[#9A3412] border-transparent scale-110'
                                        : 'border-stone-400/60'
                                    }`}
                                    style={{
                                      backgroundColor:
                                        CALLOUT_STYLES[cTheme].swatch,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  openInlineLinkPopover(block.id);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-black/10 hover:bg-black/20 rounded cursor-pointer"
                              >
                                <Link2 className="w-3 h-3" />
                                <span>Add Link</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, -1)}
                                disabled={index === 0}
                                className="p-1 opacity-70 hover:opacity-100 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, 1)}
                                disabled={index === blocks.length - 1}
                                className="p-1 opacity-70 hover:opacity-100 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(block.id)}
                                className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={block.title}
                            onChange={(e) =>
                              updateBlock(block.id, (prev) =>
                                prev.type === 'callout'
                                  ? { ...prev, title: e.target.value }
                                  : prev
                              )
                            }
                            placeholder="Callout title (e.g., Buyer Tip, Spec Verdict)..."
                            className={`w-full font-serif text-lg font-medium bg-transparent focus:outline-none ${
                              CALLOUT_STYLES[block.theme]?.titleClass || ''
                            }`}
                          />

                          <RichInlineEditable
                            editorRef={(el) => {
                              blockEditableRefs.current[block.id] = el;
                            }}
                            value={block.text}
                            onFocus={() => setFocusedBlockId(block.id)}
                            onClickLink={(info) =>
                              openInlineLinkPopover(block.id, info)
                            }
                            onChange={(val) =>
                              updateBlock(block.id, (prev) =>
                                prev.type === 'callout'
                                  ? { ...prev, text: val }
                                  : prev
                              )
                            }
                            placeholder="Write callout content (highlight words and click Add Link to embed clean hyperlinks)..."
                            className={`text-sm leading-relaxed ${
                              CALLOUT_STYLES[block.theme]?.bodyClass || ''
                            }`}
                          />
                        </div>
                      )}

                      {/* IMAGE BLOCK WITH DIRECT DEVICE UPLOAD */}
                      {block.type === 'image' && (
                        <div className="my-2 p-4 sm:p-5 bg-white text-stone-900 border border-stone-200/90 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-[#9A3412]" />
                              <span>Image Block (Upload or Link)</span>
                            </span>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#1C1917] hover:bg-[#9A3412] rounded cursor-pointer whitespace-nowrap">
                                <Upload className="w-3 h-3" />
                                <span>
                                  {uploadingBlockId === block.id
                                    ? 'Uploading...'
                                    : 'Upload Photo'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    void handleImageBlockFileUpload(block.id, e)
                                  }
                                  className="hidden"
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() =>
                                  updateBlock(block.id, (prev) => ({
                                    ...(prev as typeof block),
                                    wide: !(prev as typeof block).wide,
                                  }))
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-700 bg-[#F3EFE8] hover:bg-stone-200 rounded cursor-pointer"
                              >
                                {block.wide ? (
                                  <>
                                    <Minimize2 className="w-3 h-3" />
                                    <span>Standard Width</span>
                                  </>
                                ) : (
                                  <>
                                    <Maximize2 className="w-3 h-3" />
                                    <span>Wide Bleed</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, -1)}
                                disabled={index === 0}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, 1)}
                                disabled={index === blocks.length - 1}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(block.id)}
                                className="p-1 text-stone-400 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <ImageUploadPicker
                            label="Change Block Photo (Upload from Device, Paste URL, or Edit Studio Presets)"
                            value={block.src}
                            onChange={(nextSrc) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                src: nextSrc || 'workspace',
                              }))
                            }
                            showPreview={false}
                            compact
                          />

                          <div className="rounded-lg overflow-hidden bg-[#F3EFE8] border border-stone-200/80">
                            <ResilientImage
                              imageKey={block.src}
                              alt={block.caption || 'Story image preview'}
                              className="w-full max-h-[420px] object-cover"
                            />
                          </div>

                          <input
                            type="text"
                            value={block.caption}
                            onChange={(e) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                caption: e.target.value,
                              }))
                            }
                            placeholder="Type caption for image (optional)..."
                            className="w-full text-center font-serif italic text-xs text-stone-600 placeholder:text-stone-400 bg-transparent border-b border-stone-200 py-1.5 focus:outline-none focus:border-[#9A3412]"
                          />

                          <div>
                            <label className="block text-[11px] text-stone-500 mb-1">
                              Optional Click-Through / Affiliate URL on Image (https://)
                            </label>
                            <input
                              type="url"
                              value={block.linkUrl}
                              onChange={(e) =>
                                updateBlock(block.id, (prev) => ({
                                  ...(prev as typeof block),
                                  linkUrl: e.target.value,
                                }))
                              }
                              placeholder="https://www.amazon.com/... (clicking the image opens this link)"
                              className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-200 rounded-lg"
                            />
                          </div>
                        </div>
                      )}

                      {/* VIDEO BLOCK */}
                      {block.type === 'video' && (
                        <div className="my-2 p-4 sm:p-5 bg-white text-stone-900 border border-stone-200/90 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-[#9A3412]" />
                              <span>Video Embed or Upload (YouTube, Vimeo, Loom, MP4)</span>
                            </span>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-[#1C1917] hover:bg-[#9A3412] rounded cursor-pointer whitespace-nowrap">
                                <Upload className="w-3 h-3" />
                                <span>
                                  {uploadingBlockId === block.id
                                    ? 'Uploading...'
                                    : 'Upload Video'}
                                </span>
                                <input
                                  type="file"
                                  accept="video/mp4,video/webm,video/quicktime"
                                  onChange={(e) =>
                                    void handleVideoBlockFileUpload(block.id, e)
                                  }
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, -1)}
                                disabled={index === 0}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, 1)}
                                disabled={index === blocks.length - 1}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(block.id)}
                                className="p-1 text-stone-400 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] text-stone-500 mb-1">
                              Paste Video Link (YouTube watch/shorts, Vimeo, Loom, or direct https:// .mp4)
                            </label>
                            <input
                              type="url"
                              value={
                                block.url.startsWith('data:video/')
                                  ? ''
                                  : block.url
                              }
                              onChange={(e) =>
                                updateBlock(block.id, (prev) => ({
                                  ...(prev as typeof block),
                                  url: e.target.value,
                                }))
                              }
                              placeholder={
                                block.url.startsWith('data:video/')
                                  ? 'Uploaded video active — paste a URL to replace'
                                  : 'https://www.youtube.com/watch?v=... or https://vimeo.com/...'
                              }
                              className="w-full px-3.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                            />
                          </div>

                          {block.url.trim() ? (
                            <VideoEmbedFigure url={block.url} />
                          ) : (
                            <div className="py-10 px-4 text-center rounded-lg bg-[#F5F2EB] border border-dashed border-stone-300 text-xs text-stone-500">
                              Upload a compact video clip or paste a YouTube, Vimeo, Loom, or direct .mp4 video URL above to embed a responsive 16:9 video player in your blog.
                            </div>
                          )}

                          <input
                            type="text"
                            value={block.caption}
                            onChange={(e) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                caption: e.target.value,
                              }))
                            }
                            placeholder="Type caption for video (optional)..."
                            className="w-full text-center font-serif italic text-xs text-stone-600 placeholder:text-stone-400 bg-transparent border-b border-stone-200 py-1.5 focus:outline-none focus:border-[#9A3412]"
                          />
                        </div>
                      )}

                      {/* BOOKMARK / RICH LINK CARD BLOCK */}
                      {block.type === 'bookmark' && (
                        <div className="my-2 p-4 sm:p-5 bg-white text-stone-900 border border-stone-200/90 rounded-xl space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <Bookmark className="w-4 h-4 text-[#9A3412]" />
                              <span>Link Card / Partner Bookmark</span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, -1)}
                                disabled={index === 0}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, 1)}
                                disabled={index === blocks.length - 1}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(block.id)}
                                className="p-1 text-stone-400 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Destination URL (https://)
                              </label>
                              <input
                                type="url"
                                value={block.url}
                                onChange={(e) =>
                                  updateBlock(block.id, (prev) => ({
                                    ...(prev as typeof block),
                                    url: e.target.value,
                                  }))
                                }
                                placeholder="https://www.fiverr.com/... or https://www.amazon.com/..."
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              />
                            </div>

                            <SavedAffiliateCatalogDropdown
                              label="Or Auto-Fill From Saved Catalog"
                              placeholderLabel="Select saved product or service..."
                              offers={attachableOffers}
                              onSelectOffer={(picked) => {
                                updateBlock(block.id, () => ({
                                  id: block.id,
                                  type: 'bookmark',
                                  url: picked.affiliateUrl,
                                  title: `${picked.title} (${picked.priceLabel})`,
                                  description: picked.summary,
                                  ctaLabel: `View on ${picked.platform}`,
                                }));
                              }}
                              onSaveOffer={saveOffer}
                              onDeleteOffer={deleteOffer}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input
                              type="text"
                              value={block.title}
                              onChange={(e) =>
                                updateBlock(block.id, (prev) => ({
                                  ...(prev as typeof block),
                                  title: e.target.value,
                                }))
                              }
                              placeholder="Card headline / title"
                              className="sm:col-span-2 px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            />
                            <input
                              type="text"
                              value={block.ctaLabel}
                              onChange={(e) =>
                                updateBlock(block.id, (prev) => ({
                                  ...(prev as typeof block),
                                  ctaLabel: e.target.value,
                                }))
                              }
                              placeholder="Button label (e.g. Visit Link)"
                              className="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            />
                          </div>

                          <input
                            type="text"
                            value={block.description}
                            onChange={(e) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                description: e.target.value,
                              }))
                            }
                            placeholder="Short description shown on the link card..."
                            className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                          />

                          {block.url.trim() && (
                            <BookmarkLinkCard
                              url={
                                block.url.startsWith('http')
                                  ? block.url
                                  : `https://${block.url}`
                              }
                              title={block.title}
                              description={block.description}
                              ctaLabel={block.ctaLabel}
                            />
                          )}
                        </div>
                      )}

                      {/* AFFILIATE OFFER CARD BLOCK */}
                      {block.type === 'offer' && (
                        <div className="my-2 p-4 sm:p-5 bg-white text-stone-900 border border-stone-200/90 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <ShoppingBag className="w-4 h-4 text-[#9A3412]" />
                              <span>
                                Affiliate Product / Service Block
                              </span>
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, -1)}
                                disabled={index === 0}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, 1)}
                                disabled={index === blocks.length - 1}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(block.id)}
                                className="p-1 text-stone-400 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <SavedAffiliateCatalogDropdown
                            label="Choose, Add, Edit, or Remove Saved Affiliate Product or Service"
                            placeholderLabel="Select saved affiliate product or service..."
                            offers={attachableOffers}
                            selectedOfferId={block.offerId}
                            onSelectOffer={(picked) =>
                              updateBlock(block.id, () => ({
                                id: block.id,
                                type: 'offer',
                                offerId: picked.id,
                              }))
                            }
                            onSaveOffer={saveOffer}
                            onDeleteOffer={deleteOffer}
                          />

                          {allAccessibleOffersMap[block.offerId] && (
                            <OfferCard
                              offer={allAccessibleOffersMap[block.offerId]}
                              variant="inline"
                              onChangeImage={(targetOffer, nextImg) => {
                                void updateOfferImage(targetOffer.id, nextImg);
                              }}
                              onDelete={(targetOffer) => {
                                void deleteOffer(targetOffer.id);
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* PICKRA STORE PRODUCT BLOCK */}
                      {block.type === 'product' && (
                        <div className="my-2 p-4 sm:p-5 bg-white text-stone-900 border border-stone-200/90 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <Package className="w-4 h-4 text-[#9A3412]" />
                              <span>Pickra Store Product (Buy Direct Block)</span>
                            </span>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBlockProductId(undefined);
                                  setQuickProdTitle('');
                                  setQuickProdKind('physical');
                                  setQuickProdPriceUsd('79.00');
                                  setQuickProdSku('PK-ED-01');
                                  setQuickProdImageKey('edition');
                                  setQuickProdSummary('');
                                  setQuickCreateProductBlockId((prev) =>
                                    prev === block.id && !editingBlockProductId
                                      ? null
                                      : block.id
                                  );
                                }}
                                className="px-2.5 py-1 text-[11px] font-medium text-[#9A3412] bg-[#F5F2EB] hover:bg-stone-200 rounded cursor-pointer"
                              >
                                {quickCreateProductBlockId === block.id &&
                                !editingBlockProductId
                                  ? 'Close Form'
                                  : '+ Add Product'}
                              </button>
                              {allAccessibleDirectProductsMap[block.productId] && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cur =
                                        allAccessibleDirectProductsMap[
                                          block.productId
                                        ];
                                      if (!cur) return;
                                      setEditingBlockProductId(cur.id);
                                      setQuickProdTitle(cur.title);
                                      setQuickProdKind(cur.kind);
                                      setQuickProdPriceUsd(
                                        (cur.priceCents / 100).toFixed(2)
                                      );
                                      setQuickProdSku(cur.sku);
                                      setQuickProdImageKey(
                                        cur.imageKey || 'edition'
                                      );
                                      setQuickProdSummary(cur.summary);
                                      setQuickCreateProductBlockId(block.id);
                                    }}
                                    className="px-2 py-1 text-[11px] font-medium text-stone-700 bg-[#F5F2EB] hover:bg-stone-200 rounded cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  {confirmRemoveStoreBlockId === block.id ? (
                                    <span className="inline-flex items-center gap-1 text-[11px]">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const cur =
                                            allAccessibleDirectProductsMap[
                                              block.productId
                                            ];
                                          if (cur) {
                                            await deleteDirectProduct(cur.id);
                                          }
                                          setConfirmRemoveStoreBlockId(null);
                                        }}
                                        className="font-semibold text-red-700 hover:underline cursor-pointer"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmRemoveStoreBlockId(null)
                                        }
                                        className="text-stone-500 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmRemoveStoreBlockId(block.id)
                                      }
                                      className="px-2 py-1 text-[11px] text-stone-600 hover:text-red-700 bg-[#F5F2EB] rounded cursor-pointer"
                                    >
                                      Remove Item
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, -1)}
                                disabled={index === 0}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveBlock(block.id, 1)}
                                disabled={index === blocks.length - 1}
                                className="p-1 text-stone-400 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeBlock(block.id)}
                                className="p-1 text-stone-400 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {quickCreateProductBlockId === block.id ? (
                            <div className="p-4 bg-[#FBF9F5] border border-stone-200 rounded-lg space-y-3">
                              <div className="flex items-center justify-between text-xs font-semibold text-stone-900">
                                <span>
                                  {editingBlockProductId
                                    ? 'Edit Store Product'
                                    : 'Add New Store Product'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickCreateProductBlockId(null);
                                    setEditingBlockProductId(undefined);
                                  }}
                                  className="text-stone-400 hover:text-stone-700 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                  type="text"
                                  value={quickProdTitle}
                                  onChange={(e) =>
                                    setQuickProdTitle(e.target.value)
                                  }
                                  placeholder="Direct Product Title"
                                  className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                                />
                                <select
                                  value={quickProdKind}
                                  onChange={(e) =>
                                    setQuickProdKind(
                                      e.target.value as DirectProductKind
                                    )
                                  }
                                  className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                                >
                                  <option value="physical">
                                    Physical Product
                                  </option>
                                  <option value="digital">
                                    Instant Digital
                                  </option>
                                </select>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  value={quickProdPriceUsd}
                                  onChange={(e) =>
                                    setQuickProdPriceUsd(e.target.value)
                                  }
                                  placeholder="79.00"
                                  className="px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-md"
                                />
                                <input
                                  type="text"
                                  value={quickProdSku}
                                  onChange={(e) =>
                                    setQuickProdSku(e.target.value)
                                  }
                                  placeholder="SKU (e.g. PK-ED-01)"
                                  className="px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-md"
                                />
                              </div>

                              <ImageUploadPicker
                                value={quickProdImageKey}
                                onChange={setQuickProdImageKey}
                                label="Product Image"
                                showPreview={false}
                                compact={true}
                              />

                              <textarea
                                rows={2}
                                value={quickProdSummary}
                                onChange={(e) =>
                                  setQuickProdSummary(e.target.value)
                                }
                                placeholder="Product summary & specs (at least 10 characters)..."
                                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                              />

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleQuickCreateProductForBlock(
                                      block.id
                                    )
                                  }
                                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-md cursor-pointer"
                                >
                                  {editingBlockProductId
                                    ? 'Update Store Product'
                                    : 'Save & Embed Store Product'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Choose Pickra Store Product
                              </label>
                              <select
                                value={block.productId}
                                onChange={(e) =>
                                  updateBlock(block.id, () => ({
                                    id: block.id,
                                    type: 'product',
                                    productId: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              >
                                {attachableDirectProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.sellerName || 'Pickra'} ({p.kind}) —{' '}
                                    {p.title} · {formatPriceCents(p.priceCents)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {allAccessibleDirectProductsMap[block.productId] && (
                            <DirectProductCard
                              product={
                                allAccessibleDirectProductsMap[block.productId]
                              }
                              variant="inline"
                              onChangeImage={(targetProd, nextImg) => {
                                void updateDirectProductImage(
                                  targetProd.id,
                                  nextImg
                                );
                              }}
                              onEdit={(targetProd) => {
                                setEditingBlockProductId(targetProd.id);
                                setQuickProdTitle(targetProd.title);
                                setQuickProdKind(targetProd.kind);
                                setQuickProdPriceUsd(
                                  (targetProd.priceCents / 100).toFixed(2)
                                );
                                setQuickProdSku(targetProd.sku);
                                setQuickProdImageKey(
                                  targetProd.imageKey || 'edition'
                                );
                                setQuickProdSummary(targetProd.summary);
                                setQuickCreateProductBlockId(block.id);
                              }}
                              onDelete={(targetProd) => {
                                void deleteDirectProduct(targetProd.id);
                              }}
                            />
                          )}
                        </div>
                      )}

                      {/* DIVIDER BLOCK */}
                      {block.type === 'divider' && (
                        <div className="py-3 flex items-center justify-between border border-transparent hover:border-stone-200 rounded-lg px-3">
                          <div className="flex-1 text-center text-stone-400 tracking-[0.6em] text-lg select-none">
                            · · ·
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="text-stone-400 hover:text-red-700 cursor-pointer"
                            title="Remove divider"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Medium '+' Expanded Block Insertion Tray */}
                      {isPlusOpen && (
                        <div className="mt-3 p-2.5 bg-white text-stone-900 border border-stone-300 rounded-xl shadow-xs flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-stone-500 px-2">
                            Insert block:
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('paragraph')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Type className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Paragraph</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('heading')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <span className="font-serif font-semibold text-[#9A3412]">
                              H
                            </span>
                            <span>Heading</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('image')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Image Upload</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('video')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Video className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Video</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('bookmark')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Link2 className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Link Card</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('callout')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Palette className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Color Callout</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('product')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Package className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Store Product</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('offer')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Affiliate Pick</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('quote')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Quote className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Quote</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(
                                block.id,
                                createBlockByKind('divider')
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Minus className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Divider</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Persistent Quick-Add Block Rail */}
          <div
            className={`mt-12 sm:pl-11 pt-6 border-t ${activePalette.borderClass}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs ${activePalette.mutedClass} mr-1`}>
                Add block:
              </span>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(null, createBlockByKind('paragraph'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Type className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(null, createBlockByKind('image'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Image Upload</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(null, createBlockByKind('video'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Video className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(null, createBlockByKind('bookmark'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Link2 className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Link</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(null, createBlockByKind('callout'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Palette className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Color Theme Box</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(null, createBlockByKind('product'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Package className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Store Product</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(null, createBlockByKind('offer'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Affiliate Link</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
