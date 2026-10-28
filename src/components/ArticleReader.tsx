import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Camera,
  Palette,
  PenLine,
  Trash2,
} from 'lucide-react';
import {
  AffiliateOffer,
  BLOG_THEME_PALETTES,
  BlogColorTheme,
  BlogPost,
  DirectProduct,
} from '../types';
import { ResilientImage } from './ResilientImage';
import { markdownToBlocks } from '../utils/editorialBlocks';
import { StoryBlocksRenderer } from './EditorialRichBlocks';
import { useFirebaseApp } from '../context/FirebaseContext';
import { compressImageFileToDataUrl } from '../firebase';

interface ArticleReaderProps {
  post: BlogPost;
  offersMap?: Record<string, AffiliateOffer>;
  directProductsMap?: Record<string, DirectProduct>;
  onBack: () => void;
  onSelectPost?: (post: BlogPost) => void;
  onEditInEditor?: (post: BlogPost) => void;
  onDeletePost?: (post: BlogPost) => Promise<void> | void;
  onChangeCoverImage?: (
    post: BlogPost,
    nextCoverImageKey: string
  ) => Promise<void> | void;
}

const THEME_ORDER: BlogColorTheme[] = [
  'classic',
  'sage',
  'terracotta',
  'slate',
  'midnight',
];

export const ArticleReader: React.FC<ArticleReaderProps> = ({
  post,
  onBack,
  onSelectPost,
  onEditInEditor,
  onDeletePost,
  onChangeCoverImage,
}) => {
  const { publishedPosts, recordPostView } = useFirebaseApp();
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeTheme, setActiveTheme] = useState<BlogColorTheme>(
    post.theme || 'classic'
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  useEffect(() => {
    setActiveTheme(post.theme || 'classic');
    setConfirmDelete(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    recordPostView(post);
  }, [post.id, post.theme]);

  useEffect(() => {
    function handleScroll() {
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      const ratio = Math.min(1, Math.max(0, window.scrollY / docHeight));
      setScrollProgress(ratio);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onChangeCoverImage) return;
    setCoverBusy(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      await onChangeCoverImage(post, compressed);
    } catch {
      // ignore invalid file errors
    } finally {
      setCoverBusy(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  }

  const palette =
    BLOG_THEME_PALETTES[activeTheme] || BLOG_THEME_PALETTES.classic;

  const blocks = useMemo(() => markdownToBlocks(post.content), [post.content]);

  const relatedPosts = useMemo(() => {
    const others = publishedPosts.filter((p) => p.id !== post.id);
    const sameCategory = others.filter((p) => p.category === post.category);
    const diffCategory = others.filter((p) => p.category !== post.category);
    return [...sameCategory, ...diffCategory].slice(0, 4);
  }, [publishedPosts, post.id, post.category]);

  const sectionHeadings = useMemo(
    () =>
      blocks
        .filter(
          (b): b is Extract<typeof b, { type: 'heading' }> =>
            b.type === 'heading' && Boolean(b.text.trim())
        )
        .map((b) => b.text.trim()),
    [blocks]
  );

  return (
    <div
      className={`relative transition-colors duration-200 ${palette.canvasClass}`}
    >
      {onChangeCoverImage && (
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handleCoverUpload(e)}
          className="hidden"
        />
      )}

      {/* Subtle compositor-only reading progress line */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-transparent z-40 pointer-events-none">
        <div
          className="h-full bg-[#9A3412] origin-left transition-transform duration-100"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      </div>

      <article className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Top Utility Navigation */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 pb-8 border-b ${palette.borderClass}`}
        >
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-2 text-sm font-medium ${palette.mutedClass} hover:${palette.textClass} transition-colors cursor-pointer whitespace-nowrap shrink-0`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Blog</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Reader Color Theme Switcher */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${palette.borderClass} ${palette.surfaceClass}`}
              title="Reading color theme"
            >
              <Palette className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              {THEME_ORDER.map((tId) => {
                const cfg = BLOG_THEME_PALETTES[tId];
                const selected = activeTheme === tId;
                return (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => setActiveTheme(tId)}
                    aria-label={`Switch reading theme to ${cfg.label}`}
                    title={cfg.label}
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

            {onChangeCoverImage && (
              <button
                type="button"
                disabled={coverBusy}
                onClick={() => coverInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-900 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>{coverBusy ? 'Saving...' : 'Change Cover Photo'}</span>
              </button>
            )}

            {onEditInEditor && (
              <button
                type="button"
                onClick={() => onEditInEditor(post)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <PenLine className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>Edit Blog</span>
              </button>
            )}

            {onDeletePost &&
              (confirmDelete ? (
                <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => void onDeletePost(post)}
                    className="font-semibold text-red-700 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Confirm Delete
                  </button>
                  <span className="text-red-300">·</span>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-stone-600 hover:text-stone-900 cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-stone-600 hover:text-red-700 bg-white border border-stone-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              ))}
          </div>
        </div>

        {/* Editorial Header */}
        <header className="mt-8 sm:mt-10 max-w-3xl">
          <div
            className={`flex flex-wrap items-center gap-2 text-xs ${palette.mutedClass}`}
          >
            <span className="font-medium text-[#9A3412]">{post.category}</span>
            <span aria-hidden="true">·</span>
            <span>{post.publishedLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {post.readTimeMinutes} min read
            </span>
            <span aria-hidden="true">·</span>
            <span>By {post.authorName}</span>
            <span aria-hidden="true">·</span>
            <span>Theme: {palette.label}</span>
          </div>

          <h1
            className={`mt-4 font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-medium ${palette.textClass} leading-[1.15] tracking-tight`}
          >
            {post.title}
          </h1>

          <p
            className={`mt-4 text-lg sm:text-xl ${palette.mutedClass} leading-relaxed`}
          >
            {post.subtitle}
          </p>
        </header>

        {/* Hero Visual */}
        <figure className="mt-8 sm:mt-10">
          <div
            className={`aspect-[16/9] w-full rounded-xl overflow-hidden bg-[#F3EFE8] border ${palette.borderClass} relative`}
          >
            <ResilientImage
              imageKey={post.coverImageKey}
              alt={post.title}
              fallbackLabel={post.title}
              className="w-full h-full object-cover"
            />
            {onChangeCoverImage && (
              <button
                type="button"
                disabled={coverBusy}
                onClick={() => coverInputRef.current?.click()}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-900 bg-white/95 hover:bg-white border border-stone-300 rounded-lg shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5 text-[#9A3412]" />
                <span>{coverBusy ? 'Saving...' : 'Change Photo'}</span>
              </button>
            )}
          </div>
          <figcaption
            className={`mt-2.5 text-xs font-serif italic ${palette.mutedClass}`}
          >
            Editorial field documentation — {post.category} · {post.publishedLabel}
          </figcaption>
        </figure>

        {/* Asymmetric Reading Grid: 70% Essay / 30% Sticky Blog Reading Rail */}
        <div className="mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Main Essay Column */}
          <div className="lg:col-span-8 max-w-2xl">
            {post.disclosureText && (
              <div
                className={`mb-8 py-3.5 px-4 rounded-lg border text-xs leading-relaxed ${
                  palette.isDark
                    ? 'bg-[#1E2126] border-stone-800 text-stone-300'
                    : 'bg-white/80 border-stone-200/80 text-stone-600'
                }`}
              >
                <span
                  className={`font-semibold ${
                    palette.isDark ? 'text-stone-100' : 'text-stone-800'
                  }`}
                >
                  Editorial Note:{' '}
                </span>
                {post.disclosureText}
              </div>
            )}

            <StoryBlocksRenderer
              blocks={blocks}
              enableDropCap={true}
              articleTheme={activeTheme}
            />
          </div>

          {/* Sticky Margin Rail: Pure Blog Outline + More From the Blog */}
          <aside className="lg:col-span-4 lg:sticky lg:top-20 bg-white border border-stone-200/90 rounded-xl p-6 space-y-6 text-stone-900">
            {sectionHeadings.length > 0 && (
              <div className="pb-5 border-b border-stone-200/80">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#9A3412]">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>In This Dispatch</span>
                </div>
                <ol className="mt-3 space-y-2 text-xs text-stone-700 list-decimal list-inside">
                  {sectionHeadings.map((heading, idx) => (
                    <li key={idx} className="leading-snug">
                      {heading}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div>
              <div className="pb-3 border-b border-stone-200/80">
                <span className="text-xs font-medium text-stone-500">
                  Pickra Blog Archive
                </span>
                <h3 className="mt-0.5 font-serif text-lg font-medium text-stone-900">
                  More From the Blog
                </h3>
              </div>

              {relatedPosts.length === 0 ? (
                <p className="py-5 text-xs text-stone-500">
                  Explore more essays and dispatches from the main Blog index.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-stone-200/80">
                  {relatedPosts.map((rel) => (
                    <div key={rel.id} className="py-3.5 first:pt-1 last:pb-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                        <span className="font-medium text-[#9A3412]">
                          {rel.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {rel.readTimeMinutes} min read
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectPost ? onSelectPost(rel) : onBack()
                        }
                        className="mt-1 text-left group inline-flex items-start justify-between gap-2 w-full cursor-pointer"
                      >
                        <span className="text-sm font-semibold text-stone-900 group-hover:text-[#9A3412] transition-colors leading-snug line-clamp-2">
                          {rel.title}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#9A3412] shrink-0 mt-0.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
};
