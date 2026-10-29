import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  Bookmark,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Italic,
  Link2,
  Lock,
  Maximize2,
  Minimize2,
  Minus,
  Palette,
  Plus,
  Quote,
  Trash2,
  Type,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  isAuthorizedOwnerEmail,
  PostDraftInput,
  useFirebaseApp,
} from '../context/FirebaseContext';
import {
  BLOG_THEME_PALETTES,
  BlogColorTheme,
  BlogPost,
  CalloutColorTheme,
  PostCategory,
  PublishStatus,
} from '../types';
import {
  compressImageFileToDataUrl,
  readCompactVideoFileToDataUrl,
} from '../firebase';
import { DEFAULT_DISCLOSURE } from '../data/editorialSeed';
import {
  blocksToMarkdown,
  computeWordCountAndReadTime,
  createBlockId,
  createEmptyParagraphBlock,
  extractHostnameLabel,
  markdownToBlocks,
  StoryBlock,
} from '../utils/editorialBlocks';
import {
  BookmarkLinkCard,
  CALLOUT_STYLES,
  StoryBlocksRenderer,
  VideoEmbedFigure,
} from './EditorialRichBlocks';
import { ResilientImage } from './ResilientImage';
import { ImageUploadPicker } from './ImageUploadPicker';
import { EditableDropdownSelect } from './EditableDropdownSelect';

interface MediumBlockEditorProps {
  initialPost?: BlogPost | null;
  onBack: () => void;
  onPublished: (savedPostId: string) => void;
}

const LOCAL_DRAFT_STORAGE_KEY = 'pickra_medium_story_draft_v2';

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

function parseSavedBlogLinkEntry(entry: string): {
  label: string;
  url: string;
} {
  const trimmed = entry.trim();
  if (!trimmed) return { label: '', url: '' };
  const sepIdx = trimmed.indexOf('::');
  if (sepIdx !== -1) {
    const label = trimmed.slice(0, sepIdx).trim();
    let url = trimmed.slice(sepIdx + 2).trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return {
      label: label || (url ? extractHostnameLabel(url) : ''),
      url,
    };
  }
  let url = trimmed;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return {
    label: extractHostnameLabel(url),
    url,
  };
}

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
    isCreatorAdmin,
    siteConfig,
    savePost,
    deletePost,
    openAuthModal,
    dropdownOptions,
    addDropdownOption,
    renameDropdownOption,
    deleteDropdownOption,
  } = useFirebaseApp();

  const canWriteBlog = Boolean(
    user &&
      !user.isAnonymous &&
      (isCreatorAdmin ||
        (isAuthorizedOwnerEmail(user.email) && user.emailVerified))
  );

  const [confirmDeleteStory, setConfirmDeleteStory] = useState(false);

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
      return markdownToBlocks(initialPost.content).filter(
        (b) => b.type !== 'offer' && b.type !== 'product'
      );
    }
    try {
      const saved = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
          const clean = (parsed.blocks as StoryBlock[]).filter(
            (b) => b.type !== 'offer' && b.type !== 'product'
          );
          if (clean.length > 0) return clean;
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
      const cleanBlocks = markdownToBlocks(initialPost.content).filter(
        (b) => b.type !== 'offer' && b.type !== 'product'
      );
      setBlocks(
        cleanBlocks.length > 0 ? cleanBlocks : [createEmptyParagraphBlock('')]
      );
      setCategory(initialPost.category);
      setCoverImageValue(initialPost.coverImageKey || 'workspace');
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
  const [selectedSavedBlogLink, setSelectedSavedBlogLink] = useState('');
  const [bookmarkSavedLinkSelection, setBookmarkSavedLinkSelection] = useState<
    Record<string, string>
  >({});
  const [editingInlineLinkIndex, setEditingInlineLinkIndex] = useState<
    number | null
  >(null);
  const savedSelectionRangeRef = useRef<{
    blockId: string;
    range: Range;
  } | null>(null);

  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  const blockEditableRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-save working draft locally when creating a new story
  useEffect(() => {
    if (initialPost || !canWriteBlog) return;
    try {
      localStorage.setItem(
        LOCAL_DRAFT_STORAGE_KEY,
        JSON.stringify({ title, subtitle, blocks, blogTheme, coverImageValue })
      );
    } catch {
      // ignore storage errors
    }
  }, [
    title,
    subtitle,
    blocks,
    blogTheme,
    coverImageValue,
    initialPost,
    canWriteBlog,
  ]);

  const activePalette =
    BLOG_THEME_PALETTES[blogTheme] || BLOG_THEME_PALETTES.classic;

  const { words, minutes } = useMemo(
    () => computeWordCountAndReadTime(blocks),
    [blocks]
  );

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

    setSelectedSavedBlogLink('');

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
    if (
      el &&
      saved &&
      saved.blockId === blockId &&
      el.contains(saved.range.startContainer)
    ) {
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

  async function handleSaveOrPublish(targetStatus: PublishStatus) {
    const cleanBlocks = blocks.filter(
      (b) => b.type !== 'offer' && b.type !== 'product'
    );
    const compiledMarkdown = blocksToMarkdown(cleanBlocks);
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
            : `${title.trim()} — independent Pickras editorial story.`,
        category,
        readTimeMinutes: minutes,
        coverImageKey: coverImageValue || 'workspace',
        content: compiledMarkdown,
        theme: blogTheme,
        attachedOfferIds: [],
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
          text: 'Blog draft saved to your editorial workspace.',
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

  // Admin-Only Guard: Only the Website Owner / Authorized Admin can write or edit Blog posts
  if (!canWriteBlog) {
    return (
      <section className="max-w-[780px] mx-auto px-5 sm:px-8 py-16">
        <div className="bg-white border border-stone-200/90 rounded-2xl p-8 sm:p-10 space-y-5">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#9A3412]">
            <Lock className="w-3.5 h-3.5" />
            <span>Editorial Composer Restricted</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-stone-900">
            Blog publishing is reserved for the Pickras website owner
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            Readers can browse all published Blog dispatches freely. Sign in
            with the verified website owner account to compose, edit, or publish
            articles.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Blog</span>
            </button>
            {!user && (
              <button
                type="button"
                onClick={() => openAuthModal('signin', false)}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg cursor-pointer"
              >
                Owner Sign In
              </button>
            )}
          </div>
        </div>
      </section>
    );
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

            {editingPostId &&
              (confirmDeleteStory ? (
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
              ))}

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

      {/* Medium-Style Story Settings & Publish Panel (Independent Blog Module) */}
      {showPublishSheet && (
        <div className="border-b border-stone-200 bg-white text-stone-900">
          <div className="max-w-[1040px] mx-auto px-5 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Story Card Preview, Local Cover Upload & Theme */}
            <div className="lg:col-span-6 space-y-4">
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
                    canEdit={true}
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

            {/* Editorial Note & Final Publish Controls */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div>
                  <h3 className="font-serif text-lg font-medium text-stone-900">
                    Editorial Note &amp; Saved Reference Links
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Manage your saved Blog reference bookmarks and optional
                    end-of-article editorial note.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Saved Blog Reference Links (Format:{' '}
                    <span className="font-mono">Title :: https://...</span>)
                  </label>
                  <EditableDropdownSelect
                    ariaLabel="Saved Blog Reference Links"
                    value={selectedSavedBlogLink}
                    options={dropdownOptions.blogSavedLinks}
                    prefixOptions={[
                      {
                        value: '',
                        label: 'Manage saved blog reference links...',
                      },
                    ]}
                    onChange={setSelectedSavedBlogLink}
                    onAddOption={(opt) =>
                      addDropdownOption('blogSavedLinks', opt)
                    }
                    onRenameOption={(oldOpt, nextOpt) =>
                      renameDropdownOption('blogSavedLinks', oldOpt, nextOpt)
                    }
                    onDeleteOption={(opt) =>
                      deleteDropdownOption('blogSavedLinks', opt)
                    }
                    placeholder="Title :: https://example.com"
                    compact
                    canEdit={true}
                    selectClassName="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Editorial Note / Attribution Footer
                  </label>
                  <textarea
                    rows={3}
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
                      title="Insert paragraph, heading, image, video, link card, color callout, or quote"
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

                      {/* Inline Link Insertion & Edit Popover (Saved Blog Reference Dropdown with Add/Edit/Delete) */}
                      {linkPopoverBlockId === block.id && (
                        <div className="mb-3 p-4 bg-white text-stone-900 border border-stone-300 rounded-xl shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-900">
                              {editingInlineLinkIndex !== null
                                ? 'Edit or Remove Embedded Hyperlink'
                                : 'Insert Inline Hyperlink'}
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
                                placeholder="e.g., HTML or Read reference guide"
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Quick-Fill from Saved Blog Links (Add / Edit /
                                Remove)
                              </label>
                              <EditableDropdownSelect
                                ariaLabel="Saved Blog Reference Links"
                                value={selectedSavedBlogLink}
                                options={dropdownOptions.blogSavedLinks}
                                prefixOptions={[
                                  {
                                    value: '',
                                    label: 'Or choose a saved reference link...',
                                  },
                                ]}
                                onChange={(val) => {
                                  setSelectedSavedBlogLink(val);
                                  if (!val) return;
                                  const parsed = parseSavedBlogLinkEntry(val);
                                  if (!inlineLinkLabel.trim() && parsed.label) {
                                    setInlineLinkLabel(parsed.label);
                                  }
                                  if (parsed.url) {
                                    setInlineLinkUrl(parsed.url);
                                  }
                                }}
                                onAddOption={(opt) =>
                                  addDropdownOption('blogSavedLinks', opt)
                                }
                                onRenameOption={(oldOpt, nextOpt) =>
                                  renameDropdownOption(
                                    'blogSavedLinks',
                                    oldOpt,
                                    nextOpt
                                  )
                                }
                                onDeleteOption={(opt) =>
                                  deleteDropdownOption('blogSavedLinks', opt)
                                }
                                placeholder="Title :: https://..."
                                compact
                                canEdit={true}
                                selectClassName="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-900"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="url"
                              value={inlineLinkUrl}
                              onChange={(e) => setInlineLinkUrl(e.target.value)}
                              placeholder="https://drive.google.com/... or https://example.com/..."
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
                                ? 'Tell your story... (Click + on the left to upload images, embed videos, add link cards, or color callouts)'
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
                            placeholder="Callout title (e.g., Field Note, Key Takeaway)..."
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
                              Optional Reference Link on Image (https://)
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
                              placeholder="https://example.com/... (clicking the image opens this link)"
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
                              <span>
                                Video Embed or Upload (YouTube, Vimeo, Loom, MP4)
                              </span>
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
                              Paste Video Link (YouTube watch/shorts, Vimeo,
                              Loom, or direct https:// .mp4)
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
                              Upload a compact video clip or paste a YouTube,
                              Vimeo, Loom, or direct .mp4 video URL above to
                              embed a responsive 16:9 video player in your blog.
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
                              <span>Editorial Link Card / Reference Bookmark</span>
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
                                placeholder="https://example.com/... or https://drive.google.com/..."
                                className="w-full px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-stone-500 mb-1">
                                Or Auto-Fill From Saved Blog Links (Add / Edit /
                                Remove)
                              </label>
                              <EditableDropdownSelect
                                ariaLabel="Saved Blog Reference Links"
                                value={
                                  bookmarkSavedLinkSelection[block.id] || ''
                                }
                                options={dropdownOptions.blogSavedLinks}
                                prefixOptions={[
                                  {
                                    value: '',
                                    label: 'Select saved blog reference link...',
                                  },
                                ]}
                                onChange={(val) => {
                                  setBookmarkSavedLinkSelection((prev) => ({
                                    ...prev,
                                    [block.id]: val,
                                  }));
                                  if (!val) return;
                                  const parsed = parseSavedBlogLinkEntry(val);
                                  updateBlock(block.id, (prev) => {
                                    if (prev.type !== 'bookmark') return prev;
                                    return {
                                      ...prev,
                                      url: parsed.url || prev.url,
                                      title:
                                        prev.title.trim() ||
                                        parsed.label ||
                                        'Reference Link',
                                      ctaLabel:
                                        prev.ctaLabel.trim() || 'Visit Link',
                                    };
                                  });
                                }}
                                onAddOption={(opt) =>
                                  addDropdownOption('blogSavedLinks', opt)
                                }
                                onRenameOption={(oldOpt, nextOpt) =>
                                  renameDropdownOption(
                                    'blogSavedLinks',
                                    oldOpt,
                                    nextOpt
                                  )
                                }
                                onDeleteOption={(opt) =>
                                  deleteDropdownOption('blogSavedLinks', opt)
                                }
                                placeholder="Title :: https://..."
                                compact
                                canEdit={true}
                                selectClassName="px-3 py-2 text-xs bg-[#FBF9F5] border border-stone-300 rounded-lg text-stone-900"
                              />
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

                      {/* Medium '+' Expanded Block Insertion Tray (Pure Blog Editorial Blocks Only) */}
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

          {/* Bottom Persistent Quick-Add Block Rail (Pure Blog Editorial Blocks Only) */}
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
                <span>Link Card</span>
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
                  insertBlockAfter(null, createBlockByKind('quote'))
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-800 bg-white border border-stone-200 hover:border-stone-400 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Quote className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Quote</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
