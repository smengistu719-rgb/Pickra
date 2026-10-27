import React from 'react';
import { ArrowUpRight, ExternalLink, Play } from 'lucide-react';
import {
  AffiliateOffer,
  BlogColorTheme,
  BLOG_THEME_PALETTES,
  CalloutColorTheme,
  DirectProduct,
} from '../types';
import {
  extractHostnameLabel,
  parseVideoEmbedUrl,
  StoryBlock,
} from '../utils/editorialBlocks';
import { ResilientImage } from './ResilientImage';
import { OfferCard } from './OfferCard';
import { DirectProductCard } from './DirectProductCard';

export const CALLOUT_STYLES: Record<
  CalloutColorTheme,
  { label: string; boxClass: string; titleClass: string; bodyClass: string; swatch: string }
> = {
  amber: {
    label: 'Warm Amber',
    swatch: '#FEF3C7',
    boxClass: 'bg-[#FFFBEB] border border-amber-200/90',
    titleClass: 'text-amber-950',
    bodyClass: 'text-amber-900/90',
  },
  sage: {
    label: 'Botanical Sage',
    swatch: '#DCFCE7',
    boxClass: 'bg-[#F1F7F3] border border-[#C6DEC9]',
    titleClass: 'text-[#14301D]',
    bodyClass: 'text-[#284733]',
  },
  terracotta: {
    label: 'Terracotta Clay',
    swatch: '#FFEDD5',
    boxClass: 'bg-[#FDF3EC] border border-[#EBCBB8]',
    titleClass: 'text-[#5C1F0B]',
    bodyClass: 'text-[#73321C]',
  },
  slate: {
    label: 'Editorial Slate',
    swatch: '#E2E8F0',
    boxClass: 'bg-slate-50 border border-slate-200',
    titleClass: 'text-slate-900',
    bodyClass: 'text-slate-700',
  },
  midnight: {
    label: 'Midnight Ink',
    swatch: '#1E293B',
    boxClass: 'bg-[#181B20] border border-stone-700',
    titleClass: 'text-stone-100',
    bodyClass: 'text-stone-300',
  },
};

/**
 * Safely renders inline links [label](https://...), **bold**, and *italic* without dangerouslySetInnerHTML.
 */
export const InlineFormattedText: React.FC<{
  text: string;
  isDarkSurface?: boolean;
}> = ({ text, isDarkSurface = false }) => {
  const tokenRegex =
    /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|https?:\/\/[^\s<>)"]+)/g;
  const parts = text.split(tokenRegex);

  const linkClass = isDarkSurface
    ? 'text-amber-300 underline decoration-amber-400/70 decoration-[1.5px] underline-offset-4 hover:text-amber-200 transition-colors'
    : 'text-stone-900 underline decoration-[#9A3412]/70 decoration-[1.5px] underline-offset-4 hover:text-[#9A3412] hover:decoration-[#9A3412] transition-colors';

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;

        const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
        if (linkMatch) {
          const label = linkMatch[1];
          const href = linkMatch[2];
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className={linkClass}
            >
              {label}
            </a>
          );
        }

        if (/^https?:\/\/[^\s<>)"]+$/.test(part)) {
          const trailingMatch = part.match(/^(.*?)([.,;:!?]+)?$/);
          const cleanHref = trailingMatch ? trailingMatch[1] : part;
          const trailingPunct = trailingMatch?.[2] || '';
          return (
            <React.Fragment key={index}>
              <a
                href={cleanHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className={`${linkClass} break-all`}
              >
                {cleanHref}
              </a>
              {trailingPunct}
            </React.Fragment>
          );
        }

        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong
              key={index}
              className={`font-semibold ${
                isDarkSurface ? 'text-white' : 'text-stone-950'
              }`}
            >
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <em key={index} className="italic">
              {part.slice(1, -1)}
            </em>
          );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};

export const VideoEmbedFigure: React.FC<{
  url: string;
  caption?: string;
  isDarkSurface?: boolean;
  compact?: boolean;
}> = ({ url, caption, isDarkSurface = false, compact = false }) => {
  const descriptor = parseVideoEmbedUrl(url);

  if (!descriptor) {
    return null;
  }

  return (
    <figure className={compact ? 'my-3' : 'my-8'}>
      {descriptor.kind === 'iframe' ? (
        <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-stone-900 border border-stone-200/90">
          <iframe
            src={descriptor.embedSrc}
            title={caption || `${descriptor.provider} video player`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : descriptor.kind === 'video' ? (
        <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-stone-950 border border-stone-200/90">
          <video
            src={descriptor.embedSrc}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
          >
            Your browser does not support embedded video playback.
          </video>
        </div>
      ) : (
        <a
          href={descriptor.embedSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-4 p-6 rounded-xl bg-[#F5F2EB] border border-stone-200/90 hover:border-stone-400 transition-colors"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[#1C1917] group-hover:bg-[#9A3412] text-white flex items-center justify-center transition-colors shrink-0">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-stone-500">
                External Video · {descriptor.provider}
              </span>
              <p className="mt-0.5 text-sm font-semibold text-stone-900 truncate">
                {caption || descriptor.embedSrc}
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-stone-500 group-hover:text-stone-900 shrink-0" />
        </a>
      )}

      {caption && (
        <figcaption
          className={`mt-2.5 text-center text-xs font-serif italic ${
            isDarkSurface ? 'text-stone-400' : 'text-stone-500'
          }`}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export const BookmarkLinkCard: React.FC<{
  url: string;
  title: string;
  description?: string;
  ctaLabel?: string;
}> = ({ url, title, description, ctaLabel }) => {
  const domain = extractHostnameLabel(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group my-7 block bg-white hover:bg-[#F5F2EB]/70 border border-stone-200/90 hover:border-stone-300 rounded-xl p-5 transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-stone-500">{domain}</div>
          <h4 className="mt-1 font-serif text-lg font-medium text-stone-900 group-hover:text-[#9A3412] transition-colors leading-snug">
            {title || domain}
          </h4>
          {description && (
            <p className="mt-1.5 text-sm text-stone-600 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </div>

        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-900 bg-[#F3EFE8] group-hover:bg-[#1C1917] group-hover:text-white rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center">
          <span>{ctaLabel || 'Visit Link'}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </a>
  );
};

export const EditorialImageFigure: React.FC<{
  src: string;
  caption?: string;
  linkUrl?: string;
  wide?: boolean;
  isDarkSurface?: boolean;
}> = ({ src, caption, linkUrl, wide, isDarkSurface = false }) => {
  const imageNode = (
    <div
      className={`overflow-hidden rounded-xl bg-[#F3EFE8] border border-stone-200/80 ${
        wide ? 'lg:-mx-8' : ''
      }`}
    >
      <ResilientImage
        imageKey={src}
        alt={caption || 'Editorial story visual'}
        fallbackLabel={caption || 'Story Image'}
        className="w-full max-h-[540px] object-cover"
      />
    </div>
  );

  return (
    <figure className="my-8">
      {linkUrl && linkUrl.startsWith('https://') ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block group relative"
        >
          {imageNode}
          <span
            className={`mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline ${
              isDarkSurface ? 'text-amber-300' : 'text-[#9A3412]'
            }`}
          >
            <span>{extractHostnameLabel(linkUrl)}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </a>
      ) : (
        imageNode
      )}

      {caption && (
        <figcaption
          className={`mt-2.5 text-center text-xs font-serif italic ${
            isDarkSurface ? 'text-stone-400' : 'text-stone-500'
          }`}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export const EditorialCalloutBox: React.FC<{
  theme: CalloutColorTheme;
  title: string;
  text: string;
}> = ({ theme, title, text }) => {
  const style = CALLOUT_STYLES[theme] || CALLOUT_STYLES.amber;
  const isDarkCallout = theme === 'midnight';

  return (
    <aside className={`my-7 rounded-xl p-5 sm:p-6 ${style.boxClass}`}>
      {title && (
        <h4 className={`font-serif text-lg font-medium leading-snug ${style.titleClass}`}>
          <InlineFormattedText text={title} isDarkSurface={isDarkCallout} />
        </h4>
      )}
      {text && (
        <p className={`mt-2 text-sm sm:text-[15px] leading-relaxed ${style.bodyClass}`}>
          <InlineFormattedText text={text} isDarkSurface={isDarkCallout} />
        </p>
      )}
    </aside>
  );
};

export const StoryBlocksRenderer: React.FC<{
  blocks: StoryBlock[];
  offersMap: Record<string, AffiliateOffer>;
  directProductsMap?: Record<string, DirectProduct>;
  enableDropCap?: boolean;
  articleTheme?: BlogColorTheme;
}> = ({
  blocks,
  offersMap,
  directProductsMap = {},
  enableDropCap = true,
  articleTheme = 'classic',
}) => {
  let firstParagraphRendered = false;
  const palette = BLOG_THEME_PALETTES[articleTheme] || BLOG_THEME_PALETTES.classic;
  const isDark = palette.isDark;

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h2
                key={block.id || index}
                className={`pt-6 font-serif text-2xl sm:text-[1.65rem] font-medium leading-snug ${palette.textClass}`}
              >
                <InlineFormattedText text={block.text} isDarkSurface={isDark} />
              </h2>
            );

          case 'subheading':
            return (
              <h3
                key={block.id || index}
                className={`pt-4 font-serif text-xl font-medium leading-snug ${palette.textClass}`}
              >
                <InlineFormattedText text={block.text} isDarkSurface={isDark} />
              </h3>
            );

          case 'quote':
            return (
              <blockquote
                key={block.id || index}
                className={`my-8 py-6 border-y ${palette.borderClass} font-serif italic text-xl sm:text-2xl ${palette.textClass} leading-relaxed`}
              >
                “<InlineFormattedText text={block.text} isDarkSurface={isDark} />”
              </blockquote>
            );

          case 'callout':
            return (
              <EditorialCalloutBox
                key={block.id || index}
                theme={block.theme}
                title={block.title}
                text={block.text}
              />
            );

          case 'divider':
            return (
              <div
                key={block.id || index}
                role="separator"
                className={`py-6 text-center tracking-[0.6em] text-lg select-none ${
                  isDark ? 'text-stone-600' : 'text-stone-400'
                }`}
              >
                · · ·
              </div>
            );

          case 'image':
            return (
              <EditorialImageFigure
                key={block.id || index}
                src={block.src}
                caption={block.caption}
                linkUrl={block.linkUrl}
                wide={block.wide}
                isDarkSurface={isDark}
              />
            );

          case 'video':
            return (
              <VideoEmbedFigure
                key={block.id || index}
                url={block.url}
                caption={block.caption}
                isDarkSurface={isDark}
              />
            );

          case 'bookmark':
            return (
              <BookmarkLinkCard
                key={block.id || index}
                url={block.url}
                title={block.title}
                description={block.description}
                ctaLabel={block.ctaLabel}
              />
            );

          case 'offer': {
            const found = offersMap[block.offerId];
            if (!found) return null;
            return (
              <OfferCard
                key={`${block.offerId}-${index}`}
                offer={found}
                variant="inline"
              />
            );
          }

          case 'product': {
            const foundProd = directProductsMap[block.productId];
            if (!foundProd) return null;
            return (
              <DirectProductCard
                key={`${block.productId}-${index}`}
                product={foundProd}
                variant="inline"
              />
            );
          }

          case 'paragraph': {
            const isOpening = enableDropCap && !firstParagraphRendered;
            firstParagraphRendered = true;
            return (
              <p
                key={block.id || index}
                className={`text-base sm:text-[17px] leading-[1.82] ${
                  isDark ? 'text-stone-200 tracking-[0.01em]' : palette.textClass
                } ${
                  isOpening
                    ? `first-letter:font-serif first-letter:text-5xl first-letter:font-medium first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none ${palette.textClass}`
                    : ''
                }`}
              >
                <InlineFormattedText text={block.text} isDarkSurface={isDark} />
              </p>
            );
          }
        }
      })}
    </div>
  );
};
