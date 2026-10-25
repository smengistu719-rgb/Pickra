import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  Bookmark,
  Check,
  Image as ImageIcon,
  Italic,
  Link2,
  LogIn,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Quote,
  ShoppingBag,
  Trash2,
  Type,
  Video,
  X,
} from 'lucide-react';
import {
  OfferDraftInput,
  PostDraftInput,
  useFirebaseApp,
} from '../context/FirebaseContext';
import {
  AffiliateOffer,
  AffiliatePlatform,
  BlogPost,
  OfferKind,
  PostCategory,
  PublishStatus,
} from '../types';
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
  StoryBlocksRenderer,
  VideoEmbedFigure,
} from './EditorialRichBlocks';
import { OfferCard } from './OfferCard';
import { ResilientImage } from './ResilientImage';

interface MediumBlockEditorProps {
  initialPost?: BlogPost | null;
  onBack: () => void;
  onPublished: (savedPostId: string) => void;
}

const LOCAL_DRAFT_STORAGE_KEY = 'fieldfolio_medium_story_draft_v1';

const PLATFORMS: AffiliatePlatform[] = [
  'Amazon',
  'Digistore24',
  'Upwork',
  'Fiverr',
  'Gumroad',
  'ClickBank',
  'Custom',
];

const POST_CATEGORIES: PostCategory[] = [
  'Field Guides',
  'Hardware & Gear',
  'Digital Systems',
  'Freelance Talent',
];

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
    user,
    studioOffers,
    publishedOffers,
    allAccessibleOffersMap,
    signInWithGoogle,
    savePost,
    saveOffer,
  } = useFirebaseApp();

  const [editingPostId, setEditingPostId] = useState<string | undefined>(
    initialPost && !initialPost.isSeed ? initialPost.id : undefined
  );
  const [title, setTitle] = useState<string>(initialPost?.title || '');
  const [subtitle, setSubtitle] = useState<string>(initialPost?.subtitle || '');
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

  // Load saved title/subtitle if creating fresh draft
  useEffect(() => {
    if (initialPost) {
      setEditingPostId(initialPost.isSeed ? undefined : initialPost.id);
      setTitle(initialPost.title);
      setSubtitle(initialPost.subtitle);
      setBlocks(markdownToBlocks(initialPost.content));
      setCategory(initialPost.category);
      const isPreset = PRESET_IMAGES.some((p) => p.key === initialPost.coverImageKey);
      if (isPreset) {
        setCoverImageKey(initialPost.coverImageKey);
        setCustomCoverUrl('');
      } else {
        setCoverImageKey('custom');
        setCustomCoverUrl(initialPost.coverImageKey);
      }
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
      }
    } catch {
      // ignore
    }
  }, [initialPost]);

  // Story Publish Settings Drawer State
  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const [category, setCategory] = useState<PostCategory>(
    initialPost?.category || 'Field Guides'
  );
  const [coverImageKey, setCoverImageKey] = useState<string>(() => {
    if (!initialPost) return 'workspace';
    return PRESET_IMAGES.some((p) => p.key === initialPost.coverImageKey)
      ? initialPost.coverImageKey
      : 'custom';
  });
  const [customCoverUrl, setCustomCoverUrl] = useState<string>(() => {
    if (!initialPost) return '';
    return PRESET_IMAGES.some((p) => p.key === initialPost.coverImageKey)
      ? ''
      : initialPost.coverImageKey;
  });
  const [extraAttachedIds, setExtraAttachedIds] = useState<string[]>(
    initialPost?.attachedOfferIds || []
  );
  const [disclosureText, setDisclosureText] = useState<string>(
    initialPost?.disclosureText || DEFAULT_DISCLOSURE
  );
  const [featured, setFeatured] = useState<boolean>(
    initialPost?.featured || false
  );
  const [publishStatus, setPublishStatus] = useState<PublishStatus>(
    initialPost?.status === 'draft' ? 'draft' : 'published'
  );

  // Active Block & Inserter UI State
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [openPlusMenuBlockId, setOpenPlusMenuBlockId] = useState<string | null>(null);

  // Inline Link Popover State for Text Blocks
  const [linkPopoverBlockId, setLinkPopoverBlockId] = useState<string | null>(null);
  const [inlineLinkLabel, setInlineLinkLabel] = useState('');
  const [inlineLinkUrl, setInlineLinkUrl] = useState('');
  const [selectionOffsets, setSelectionOffsets] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 0 });

  // Quick-Create Affiliate Offer Inline Modal inside Offer Block
  const [quickCreateOfferBlockId, setQuickCreateOfferBlockId] = useState<
    string | null
  >(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickKind, setQuickKind] = useState<OfferKind>('physical');
  const [quickPlatform, setQuickPlatform] = useState<AffiliatePlatform>('Amazon');
  const [quickPrice, setQuickPrice] = useState('$99.00');
  const [quickUrl, setQuickUrl] = useState('');
  const [quickImageKey, setQuickImageKey] = useState('audio');
  const [quickSummary, setQuickSummary] = useState('');

  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  const blockTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Auto-save working draft locally when creating a new story
  useEffect(() => {
    if (initialPost) return;
    try {
      localStorage.setItem(
        LOCAL_DRAFT_STORAGE_KEY,
        JSON.stringify({ title, subtitle, blocks })
      );
    } catch {
      // ignore storage errors
    }
  }, [title, subtitle, blocks, initialPost]);

  const attachableOffers: AffiliateOffer[] = useMemo(() => {
    const map = new Map<string, AffiliateOffer>();
    for (const item of studioOffers) map.set(item.id, item);
    for (const item of publishedOffers) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [studioOffers, publishedOffers]);

  const { words, minutes } = useMemo(
    () => computeWordCountAndReadTime(blocks),
    [blocks]
  );

  // Combine inline [[offer:ID]] blocks with manually checked sidebar offers (up to 8)
  const combinedAttachedOfferIds = useMemo(() => {
    const fromBlocks = extractOfferIdsFromBlocks(blocks);
    const merged = Array.from(new Set([...fromBlocks, ...extraAttachedIds]));
    return merged.slice(0, 8);
  }, [blocks, extraAttachedIds]);

  function focusBlockSoon(blockId: string) {
    setFocusedBlockId(blockId);
    requestAnimationFrame(() => {
      const el = blockTextareaRefs.current[blockId];
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }

  function updateBlock(blockId: string, updater: (prev: StoryBlock) => StoryBlock) {
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
    const el = blockTextareaRefs.current[blockId];
    const target = blocks.find((b) => b.id === blockId);
    if (
      !target ||
      (target.type !== 'paragraph' &&
        target.type !== 'heading' &&
        target.type !== 'subheading' &&
        target.type !== 'quote')
    ) {
      return;
    }

    const start = el?.selectionStart ?? target.text.length;
    const end = el?.selectionEnd ?? target.text.length;
    const selected = target.text.slice(start, end) || 'text';
    const nextText =
      target.text.slice(0, start) +
      `${wrapper}${selected}${wrapper}` +
      target.text.slice(end);

    updateBlock(blockId, (prev) => ({ ...prev, text: nextText } as StoryBlock));
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(
          start + wrapper.length,
          start + wrapper.length + selected.length
        );
      }
    });
  }

  function openInlineLinkPopover(blockId: string) {
    const el = blockTextareaRefs.current[blockId];
    const target = blocks.find((b) => b.id === blockId);
    if (
      !target ||
      (target.type !== 'paragraph' &&
        target.type !== 'heading' &&
        target.type !== 'subheading' &&
        target.type !== 'quote')
    ) {
      return;
    }

    const start = el?.selectionStart ?? target.text.length;
    const end = el?.selectionEnd ?? target.text.length;
    const selectedText = target.text.slice(start, end).trim();

    setSelectionOffsets({ start, end });
    setInlineLinkLabel(selectedText || '');
    setInlineLinkUrl('');
    setLinkPopoverBlockId(blockId);
  }

  function applyInlineLinkToBlock(blockId: string) {
    const target = blocks.find((b) => b.id === blockId);
    if (
      !target ||
      (target.type !== 'paragraph' &&
        target.type !== 'heading' &&
        target.type !== 'subheading' &&
        target.type !== 'quote')
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
    const { start, end } = selectionOffsets;
    const prefix =
      start > 0 && end === start && !target.text.slice(0, start).endsWith(' ')
        ? ' '
        : '';
    const nextText =
      target.text.slice(0, start) +
      prefix +
      markdownLink +
      target.text.slice(end);

    updateBlock(blockId, (prev) => ({ ...prev, text: nextText } as StoryBlock));
    setLinkPopoverBlockId(null);
    setInlineLinkLabel('');
    setInlineLinkUrl('');
    focusBlockSoon(blockId);
  }

  function handleTextBlockKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    block: Extract<
      StoryBlock,
      { type: 'paragraph' | 'heading' | 'subheading' | 'quote' }
    >
  ) {
    // Ctrl/Cmd + K opens Inline Link popover (just like Medium!)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openInlineLinkPopover(block.id);
      return;
    }

    // Enter without Shift creates a new paragraph block right below
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = block.text.trim().toLowerCase();

      // Slash quick commands on Enter
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
      if (trimmed === '/product' || trimmed === '/offer') {
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

    // Backspace on an empty block removes it and focuses the previous block
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
      | 'image'
      | 'video'
      | 'bookmark'
      | 'offer'
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
      case 'divider':
        return { id, type: 'divider' };
    }
  }

  function clearDraftCanvas() {
    setEditingPostId(undefined);
    setTitle('');
    setSubtitle('');
    setBlocks([createEmptyParagraphBlock('')]);
    setExtraAttachedIds([]);
    try {
      localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function handleQuickCreateOfferForBlock(targetBlockId: string) {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setBusy(true);
    setStatusMessage(null);
    try {
      const input: OfferDraftInput = {
        title: quickTitle,
        kind: quickKind,
        platform: quickPlatform,
        category: quickKind === 'service' ? 'Specialist Service' : 'Featured Pick',
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
        text: 'Created affiliate product/service and embedded it into your story.',
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

  async function handleSaveOrPublish(targetStatus: PublishStatus) {
    if (!user) {
      try {
        await signInWithGoogle();
      } catch {
        setStatusMessage({
          tone: 'err',
          text: 'Google Sign-In was cancelled. Your story remains safely saved in this browser draft.',
        });
      }
      return;
    }

    const compiledMarkdown = blocksToMarkdown(blocks);
    if (title.trim().length < 4) {
      setStatusMessage({
        tone: 'err',
        text: 'Please add a story title of at least 4 characters.',
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

    const resolvedCover =
      coverImageKey === 'custom'
        ? customCoverUrl.trim() || 'workspace'
        : coverImageKey;

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
        coverImageKey: resolvedCover,
        content: compiledMarkdown,
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
          text: 'Draft saved to your Studio workspace.',
        });
      }
    } catch (err) {
      setStatusMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Unable to publish story.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[82vh] bg-[#FBF9F5]">
      {/* Medium-Style Minimal Story Bar */}
      <div className="border-b border-stone-200/80 bg-[#FBF9F5]">
        <div className="max-w-[960px] mx-auto px-5 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-500">
              <span>{editingPostId ? 'Editing story' : 'Draft in progress'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{words} words</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{minutes} min read</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

            {!initialPost && (title || blocks.length > 1 || (blocks[0]?.type === 'paragraph' && blocks[0].text)) && (
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
        <div className="max-w-[760px] mx-auto px-5 sm:px-8 pt-5">
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
        <div className="border-b border-stone-200 bg-white">
          <div className="max-w-[960px] mx-auto px-5 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Story Card Preview & Cover */}
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-serif text-lg font-medium text-stone-900">
                Story Preview &amp; Cover Image
              </h2>
              <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200">
                <ResilientImage
                  imageKey={
                    coverImageKey === 'custom'
                      ? customCoverUrl || 'workspace'
                      : coverImageKey
                  }
                  alt={title || 'Story cover'}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Cover Photography
                  </label>
                  <select
                    value={coverImageKey}
                    onChange={(e) => setCoverImageKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  >
                    {PRESET_IMAGES.map((img) => (
                      <option key={img.key} value={img.key}>
                        {img.label}
                      </option>
                    ))}
                    <option value="custom">Custom HTTPS Image URL...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Editorial Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PostCategory)}
                    className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                  >
                    {POST_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {coverImageKey === 'custom' && (
                <input
                  type="url"
                  value={customCoverUrl}
                  onChange={(e) => setCustomCoverUrl(e.target.value)}
                  placeholder="https://example.com/story-cover.jpg"
                  className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                />
              )}

              <label className="flex items-center gap-2.5 text-xs font-medium text-stone-800 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="accent-[#9A3412] w-4 h-4"
                />
                <span>Feature as Lead Story on Homepage Hero</span>
              </label>
            </div>

            {/* Sidebar Attached Links & Final Publish Buttons */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg font-medium text-stone-900">
                    Sidebar Affiliate Picks ({combinedAttachedOfferIds.length}/8)
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Any Affiliate Pick blocks in your story are included automatically. You can also attach extra catalog items to the sticky article rail:
                  </p>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-stone-200/80 border border-stone-200 rounded-lg bg-[#FBF9F5]">
                  {attachableOffers.map((offer) => {
                    const checked = combinedAttachedOfferIds.includes(offer.id);
                    return (
                      <label
                        key={offer.id}
                        className="px-3 py-2 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-white"
                      >
                        <span className="flex items-center gap-2 min-w-0">
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
                        </span>
                        <span className="text-stone-500 whitespace-nowrap shrink-0">
                          {offer.platform} · {offer.priceLabel}
                        </span>
                      </label>
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
                {!user ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                    <span className="text-xs text-stone-600">
                      Sign in with Google to publish this story live to Pickra.
                    </span>
                    <button
                      type="button"
                      onClick={() => void signInWithGoogle()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In with Google to Publish</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSaveOrPublish('draft')}
                      className="px-4 py-2.5 text-xs font-medium text-stone-700 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Save as Private Draft
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
                        {editingPostId ? 'Update & Publish Story' : 'Publish Story Now'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WRITING CANVAS OR READER PREVIEW */}
      {editorMode === 'preview' ? (
        <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-12">
          <div className="text-xs text-stone-500">
            <span className="font-medium text-[#9A3412]">{category}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums">{minutes} min read</span>
          </div>

          <h1 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-medium text-stone-900 leading-[1.15]">
            {title || 'Untitled Story'}
          </h1>

          {subtitle && (
            <p className="mt-4 text-lg sm:text-xl text-stone-600 leading-relaxed">
              {subtitle}
            </p>
          )}

          <div className="my-8 aspect-[16/9] rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80">
            <ResilientImage
              imageKey={
                coverImageKey === 'custom'
                  ? customCoverUrl || 'workspace'
                  : coverImageKey
              }
              alt={title || 'Story cover'}
              className="w-full h-full object-cover"
            />
          </div>

          <StoryBlocksRenderer
            blocks={blocks}
            offersMap={allAccessibleOffersMap}
            enableDropCap={true}
          />
        </div>
      ) : (
        <div className="max-w-[780px] mx-auto px-5 sm:px-10 py-10 sm:py-14">
          {/* Medium-Style Title & Standfirst */}
          <div className="sm:pl-11">
            <AutoResizeTextarea
              value={title}
              onChange={setTitle}
              placeholder="Title"
              className="font-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-medium text-stone-900 placeholder:text-stone-300 leading-[1.16] tracking-tight"
            />

            <div className="mt-3 pb-6 border-b border-stone-200/70">
              <AutoResizeTextarea
                value={subtitle}
                onChange={setSubtitle}
                placeholder="Tell a concise subtitle or standfirst..."
                className="text-lg sm:text-xl text-stone-600 placeholder:text-stone-300 leading-relaxed"
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

              // Extract inline links inside current block to show subtle link verification bar
              const inlineLinksInBlock: { label: string; url: string }[] = [];
              if (isTextKind && block.text.includes('](')) {
                const regex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
                let m: RegExpExecArray | null;
                while ((m = regex.exec(block.text)) !== null) {
                  inlineLinksInBlock.push({ label: m[1], url: m[2] });
                }
              }

              return (
                <div key={block.id} className="group relative">
                  <div className="flex items-start gap-2 sm:gap-3">
                    {/* Left Gutter Medium '+' Button */}
                    <button
                      type="button"
                      title="Insert block below"
                      aria-label="Insert block below"
                      onClick={() =>
                        setOpenPlusMenuBlockId((prev) =>
                          prev === block.id ? null : block.id
                        )
                      }
                      className={`mt-1 w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        isPlusOpen
                          ? 'border-stone-900 bg-stone-900 text-white rotate-45'
                          : 'border-stone-300 text-stone-500 hover:border-stone-800 hover:text-stone-900 bg-white/80'
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

                      {/* Inline Link Insertion Popover */}
                      {linkPopoverBlockId === block.id && (
                        <div className="mb-3 p-4 bg-white border border-stone-300 rounded-xl shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-900">
                              Insert Inline Hyperlink or Affiliate Link
                            </span>
                            <button
                              type="button"
                              onClick={() => setLinkPopoverBlockId(null)}
                              className="text-stone-400 hover:text-stone-700 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Link Text
                              </label>
                              <input
                                type="text"
                                value={inlineLinkLabel}
                                onChange={(e) => setInlineLinkLabel(e.target.value)}
                                placeholder="e.g., Check price on Amazon"
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Quick-Fill from Saved Affiliate Catalog
                              </label>
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  const picked = attachableOffers.find(
                                    (o) => o.id === e.target.value
                                  );
                                  if (picked) {
                                    if (!inlineLinkLabel.trim()) {
                                      setInlineLinkLabel(picked.title);
                                    }
                                    setInlineLinkUrl(picked.affiliateUrl);
                                  }
                                }}
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              >
                                <option value="">Or choose a saved product/service...</option>
                                {attachableOffers.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.platform}: {o.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="url"
                              value={inlineLinkUrl}
                              onChange={(e) => setInlineLinkUrl(e.target.value)}
                              placeholder="https://www.amazon.com/... or https://www.upwork.com/..."
                              className="flex-1 px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => applyInlineLinkToBlock(block.id)}
                              className="px-4 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Apply Link
                            </button>
                          </div>
                        </div>
                      )}

                      {/* RENDER EACH BLOCK EDITOR TYPE */}
                      {block.type === 'paragraph' && (
                        <div>
                          <AutoResizeTextarea
                            textareaRef={(el) => {
                              blockTextareaRefs.current[block.id] = el;
                            }}
                            value={block.text}
                            onFocus={() => setFocusedBlockId(block.id)}
                            onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                            onChange={(val) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                text: val,
                              }))
                            }
                            placeholder={
                              index === 0
                                ? 'Tell your story... (Click + on the left to add images, videos, links, or affiliate products)'
                                : 'Write paragraph, or press + to insert media...'
                            }
                            className="text-base sm:text-[17px] text-stone-800 placeholder:text-stone-400 leading-[1.8]"
                          />
                          {inlineLinksInBlock.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
                              {inlineLinksInBlock.map((lnk, i) => (
                                <a
                                  key={i}
                                  href={lnk.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#9A3412] hover:underline"
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span>
                                    {lnk.label} ({extractHostnameLabel(lnk.url)})
                                  </span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {block.type === 'heading' && (
                        <AutoResizeTextarea
                          textareaRef={(el) => {
                            blockTextareaRefs.current[block.id] = el;
                          }}
                          value={block.text}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                          onChange={(val) =>
                            updateBlock(block.id, (prev) => ({
                              ...(prev as typeof block),
                              text: val,
                            }))
                          }
                          placeholder="Section heading..."
                          className="pt-2 font-serif text-2xl sm:text-[1.65rem] font-medium text-stone-900 placeholder:text-stone-300 leading-snug"
                        />
                      )}

                      {block.type === 'subheading' && (
                        <AutoResizeTextarea
                          textareaRef={(el) => {
                            blockTextareaRefs.current[block.id] = el;
                          }}
                          value={block.text}
                          onFocus={() => setFocusedBlockId(block.id)}
                          onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                          onChange={(val) =>
                            updateBlock(block.id, (prev) => ({
                              ...(prev as typeof block),
                              text: val,
                            }))
                          }
                          placeholder="Subheading..."
                          className="pt-1 font-serif text-xl font-medium text-stone-800 placeholder:text-stone-300 leading-snug"
                        />
                      )}

                      {block.type === 'quote' && (
                        <div className="py-4 border-y border-stone-300/80">
                          <AutoResizeTextarea
                            textareaRef={(el) => {
                              blockTextareaRefs.current[block.id] = el;
                            }}
                            value={block.text}
                            onFocus={() => setFocusedBlockId(block.id)}
                            onKeyDown={(e) => handleTextBlockKeyDown(e, block)}
                            onChange={(val) =>
                              updateBlock(block.id, (prev) => ({
                                ...(prev as typeof block),
                                text: val,
                              }))
                            }
                            placeholder="Write a memorable pull quote..."
                            className="font-serif italic text-xl sm:text-2xl text-stone-800 placeholder:text-stone-300 leading-relaxed"
                          />
                        </div>
                      )}

                      {/* IMAGE BLOCK */}
                      {block.type === 'image' && (
                        <div className="my-2 p-4 sm:p-5 bg-white border border-stone-200/90 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-[#9A3412]" />
                              <span>Image Block</span>
                            </span>

                            <div className="flex items-center gap-1.5">
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

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Paste Image URL (https://)
                              </label>
                              <input
                                type="url"
                                value={
                                  block.src.startsWith('https://') ? block.src : ''
                                }
                                onChange={(e) =>
                                  updateBlock(block.id, (prev) => ({
                                    ...(prev as typeof block),
                                    src: e.target.value || 'workspace',
                                  }))
                                }
                                placeholder="https://example.com/photo.jpg"
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Or Pick From Studio Photography
                              </label>
                              <select
                                value={
                                  PRESET_IMAGES.some((p) => p.key === block.src)
                                    ? block.src
                                    : ''
                                }
                                onChange={(e) => {
                                  if (e.target.value) {
                                    updateBlock(block.id, (prev) => ({
                                      ...(prev as typeof block),
                                      src: e.target.value,
                                    }));
                                  }
                                }}
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              >
                                <option value="">Custom URL active</option>
                                {PRESET_IMAGES.map((img) => (
                                  <option key={img.key} value={img.key}>
                                    {img.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

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
                        <div className="my-2 p-4 sm:p-5 bg-white border border-stone-200/90 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <Video className="w-4 h-4 text-[#9A3412]" />
                              <span>Video Embed (YouTube, Vimeo, Loom, or MP4)</span>
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

                          <div>
                            <label className="block text-[11px] text-stone-500 mb-1">
                              Paste Video Link (YouTube watch/shorts, Vimeo, Loom, or direct https:// .mp4)
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
                              placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                              className="w-full px-3.5 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                            />
                          </div>

                          {block.url.trim() ? (
                            <VideoEmbedFigure url={block.url} />
                          ) : (
                            <div className="py-10 px-4 text-center rounded-lg bg-[#F5F2EB] border border-dashed border-stone-300 text-xs text-stone-500">
                              Paste a YouTube, Vimeo, Loom, or direct .mp4 video URL above to embed a responsive 16:9 video player in your story.
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
                        <div className="my-2 p-4 sm:p-5 bg-white border border-stone-200/90 rounded-xl space-y-3">
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

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Or Auto-Fill From Saved Catalog
                              </label>
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  const picked = attachableOffers.find(
                                    (o) => o.id === e.target.value
                                  );
                                  if (picked) {
                                    updateBlock(block.id, () => ({
                                      id: block.id,
                                      type: 'bookmark',
                                      url: picked.affiliateUrl,
                                      title: `${picked.title} (${picked.priceLabel})`,
                                      description: picked.summary,
                                      ctaLabel: `View on ${picked.platform}`,
                                    }));
                                  }
                                }}
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              >
                                <option value="">Select saved product or service...</option>
                                {attachableOffers.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.platform}: {o.title}
                                  </option>
                                ))}
                              </select>
                            </div>
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
                            placeholder="Short description shown on the bookmark card..."
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
                        <div className="my-2 p-4 sm:p-5 bg-white border border-stone-200/90 rounded-xl space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                            <span className="text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5">
                              <ShoppingBag className="w-4 h-4 text-[#9A3412]" />
                              <span>Affiliate Product / Service Conversion Block</span>
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickCreateOfferBlockId((prev) =>
                                    prev === block.id ? null : block.id
                                  )
                                }
                                className="px-2.5 py-1 text-[11px] font-medium text-[#9A3412] bg-[#F5F2EB] hover:bg-stone-200 rounded cursor-pointer"
                              >
                                {quickCreateOfferBlockId === block.id
                                  ? 'Close New Form'
                                  : '+ Create New Offer'}
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

                          {quickCreateOfferBlockId === block.id ? (
                            <div className="p-4 bg-[#FBF9F5] border border-stone-200 rounded-lg space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                  type="text"
                                  value={quickTitle}
                                  onChange={(e) => setQuickTitle(e.target.value)}
                                  placeholder="Product or Service Name"
                                  className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                                />
                                <select
                                  value={quickKind}
                                  onChange={(e) =>
                                    setQuickKind(e.target.value as OfferKind)
                                  }
                                  className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                                >
                                  <option value="physical">Physical Product</option>
                                  <option value="digital">Digital Product</option>
                                  <option value="service">Freelance Service</option>
                                </select>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <select
                                  value={quickPlatform}
                                  onChange={(e) =>
                                    setQuickPlatform(
                                      e.target.value as AffiliatePlatform
                                    )
                                  }
                                  className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                                >
                                  {PLATFORMS.map((p) => (
                                    <option key={p} value={p}>
                                      {p}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={quickPrice}
                                  onChange={(e) => setQuickPrice(e.target.value)}
                                  placeholder="$149.00 or From $85/hr"
                                  className="px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-md"
                                />
                                <select
                                  value={quickImageKey}
                                  onChange={(e) => setQuickImageKey(e.target.value)}
                                  className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                                >
                                  {PRESET_IMAGES.map((img) => (
                                    <option key={img.key} value={img.key}>
                                      {img.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <input
                                type="url"
                                value={quickUrl}
                                onChange={(e) => setQuickUrl(e.target.value)}
                                placeholder="https://www.amazon.com/... or https://www.upwork.com/..."
                                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                              />
                              <textarea
                                rows={2}
                                value={quickSummary}
                                onChange={(e) => setQuickSummary(e.target.value)}
                                placeholder="Editorial summary (at least 10 characters)..."
                                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-md"
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void handleQuickCreateOfferForBlock(block.id)
                                  }
                                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-md cursor-pointer"
                                >
                                  {user
                                    ? 'Save & Embed Offer'
                                    : 'Sign In with Google to Save Offer'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Choose Saved Product or Freelance Service
                              </label>
                              <select
                                value={block.offerId}
                                onChange={(e) =>
                                  updateBlock(block.id, () => ({
                                    id: block.id,
                                    type: 'offer',
                                    offerId: e.target.value,
                                  }))
                                }
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              >
                                {attachableOffers.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.platform} ({o.kind}) — {o.title} · {o.priceLabel}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {allAccessibleOffersMap[block.offerId] && (
                            <OfferCard
                              offer={allAccessibleOffersMap[block.offerId]}
                              variant="inline"
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
                        <div className="mt-3 p-2.5 bg-white border border-stone-300 rounded-xl shadow-xs flex flex-wrap items-center gap-1.5">
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
                              insertBlockAfter(block.id, createBlockByKind('heading'))
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
                              insertBlockAfter(block.id, createBlockByKind('image'))
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Image</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(block.id, createBlockByKind('video'))
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
                              insertBlockAfter(block.id, createBlockByKind('offer'))
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Affiliate Pick</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(block.id, createBlockByKind('quote'))
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#F3EFE8] rounded-lg cursor-pointer whitespace-nowrap"
                          >
                            <Quote className="w-3.5 h-3.5 text-[#9A3412]" />
                            <span>Quote</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertBlockAfter(block.id, createBlockByKind('divider'))
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
          <div className="mt-12 sm:pl-11 pt-6 border-t border-stone-200/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-500 mr-1">Add block:</span>
              <button
                type="button"
                onClick={() => insertBlockAfter(null, createBlockByKind('paragraph'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Type className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => insertBlockAfter(null, createBlockByKind('heading'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <span className="font-serif font-semibold text-[#9A3412]">H</span>
                <span>Heading</span>
              </button>
              <button
                type="button"
                onClick={() => insertBlockAfter(null, createBlockByKind('image'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Image</span>
              </button>
              <button
                type="button"
                onClick={() => insertBlockAfter(null, createBlockByKind('video'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Video className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Video</span>
              </button>
              <button
                type="button"
                onClick={() => insertBlockAfter(null, createBlockByKind('bookmark'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Link2 className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Link Card</span>
              </button>
              <button
                type="button"
                onClick={() => insertBlockAfter(null, createBlockByKind('offer'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Affiliate Pick</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
