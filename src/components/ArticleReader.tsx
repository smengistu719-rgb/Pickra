import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PenLine } from 'lucide-react';
import { AffiliateOffer, BlogPost } from '../types';
import { ResilientImage } from './ResilientImage';
import { OfferCard } from './OfferCard';
import {
  extractOfferIdsFromBlocks,
  markdownToBlocks,
} from '../utils/editorialBlocks';
import { StoryBlocksRenderer } from './EditorialRichBlocks';

interface ArticleReaderProps {
  post: BlogPost;
  offersMap: Record<string, AffiliateOffer>;
  onBack: () => void;
  onEditInEditor?: (post: BlogPost) => void;
}

export const ArticleReader: React.FC<ArticleReaderProps> = ({
  post,
  offersMap,
  onBack,
  onEditInEditor,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [post.id]);

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

  const blocks = useMemo(() => markdownToBlocks(post.content), [post.content]);

  const attachedOffers = useMemo(() => {
    const inlineIds = extractOfferIdsFromBlocks(blocks);
    const ids = Array.from(new Set([...post.attachedOfferIds, ...inlineIds]));
    return ids
      .map((id) => offersMap[id])
      .filter((item): item is AffiliateOffer => Boolean(item));
  }, [post.attachedOfferIds, blocks, offersMap]);

  return (
    <div className="relative">
      {/* Subtle compositor-only reading progress line */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-transparent z-40 pointer-events-none">
        <div
          className="h-full bg-[#9A3412] origin-left transition-transform duration-100"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      </div>

      <article className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Top Utility Navigation */}
        <div className="flex items-center justify-between gap-4 pb-8 border-b border-stone-200/80">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Journal</span>
          </button>

          {onEditInEditor && (
            <button
              type="button"
              onClick={() => onEditInEditor(post)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-800 bg-[#F3EFE8] hover:bg-stone-200/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>
                {post.isSeed ? 'Customize in Block Editor' : 'Edit Story in Block Editor'}
              </span>
            </button>
          )}
        </div>

        {/* Editorial Header */}
        <header className="mt-8 sm:mt-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className="font-medium text-[#9A3412]">{post.category}</span>
            <span aria-hidden="true">·</span>
            <span>{post.publishedLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{post.readTimeMinutes} min read</span>
            <span aria-hidden="true">·</span>
            <span>By {post.authorName}</span>
          </div>

          <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-medium text-stone-900 leading-[1.15] tracking-tight">
            {post.title}
          </h1>

          <p className="mt-4 text-lg sm:text-xl text-stone-600 leading-relaxed">
            {post.subtitle}
          </p>
        </header>

        {/* Hero Visual */}
        <figure className="mt-8 sm:mt-10">
          <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-[#F3EFE8] border border-stone-200/80">
            <ResilientImage
              imageKey={post.coverImageKey}
              alt={post.title}
              fallbackLabel={post.title}
              className="w-full h-full object-cover"
            />
          </div>
          <figcaption className="mt-2.5 text-xs font-serif italic text-stone-500">
            Editorial field documentation — {post.category} · {attachedOffers.length}{' '}
            vetted {attachedOffers.length === 1 ? 'offering' : 'offerings'} attached
          </figcaption>
        </figure>

        {/* Asymmetric Reading Grid: 70% Essay / 30% Sticky Attached Picks Rail */}
        <div className="mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Main Essay Column */}
          <div className="lg:col-span-8 max-w-2xl">
            {/* Explicit Affiliate Disclosure */}
            <div className="mb-8 py-3.5 px-4 bg-[#F3EFE8]/70 border border-stone-200/80 rounded-lg text-xs text-stone-600 leading-relaxed">
              <span className="font-semibold text-stone-800">
                Affiliate Disclosure:{' '}
              </span>
              {post.disclosureText}
            </div>

            <StoryBlocksRenderer
              blocks={blocks}
              offersMap={offersMap}
              enableDropCap={true}
            />
          </div>

          {/* Sticky Margin Rail: Attached Products & Services */}
          <aside className="lg:col-span-4 lg:sticky lg:top-8 bg-white border border-stone-200/90 rounded-xl p-6">
            <div className="pb-4 border-b border-stone-200/80">
              <span className="text-xs font-medium text-stone-500">
                Attached Links ({attachedOffers.length})
              </span>
              <h3 className="mt-1 font-serif text-lg font-medium text-stone-900">
                Featured in This Dispatch
              </h3>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                Direct partner links to physical gear, digital blueprints, and specialist services reviewed in this essay.
              </p>
            </div>

            {attachedOffers.length === 0 ? (
              <p className="py-6 text-xs text-stone-500">
                No external product or service links attached to this dispatch.
              </p>
            ) : (
              <div className="mt-4">
                {attachedOffers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} variant="rail" />
                ))}
              </div>
            )}
          </aside>
        </div>
      </article>
    </div>
  );
};
