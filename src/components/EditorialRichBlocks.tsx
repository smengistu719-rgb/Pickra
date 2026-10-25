import React from 'react';
import { ArrowUpRight, ExternalLink, Play } from 'lucide-react';
import { AffiliateOffer } from '../types';
import {
  extractHostnameLabel,
  parseVideoEmbedUrl,
  StoryBlock,
} from '../utils/editorialBlocks';
import { ResilientImage } from './ResilientImage';
import { OfferCard } from './OfferCard';

/**
 * Safely renders inline links [label](https://...), **bold**, and *italic* without dangerouslySetInnerHTML.
 */
export const InlineFormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Tokenize [label](https://...), **bold**, and *italic*
  const tokenRegex = /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  const parts = text.split(tokenRegex);

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
              className="text-stone-900 underline decoration-[#9A3412]/70 decoration-[1.5px] underline-offset-4 hover:text-[#9A3412] hover:decoration-[#9A3412] transition-colors"
            >
              {label}
            </a>
          );
        }

        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={index} className="font-semibold text-stone-950">
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
}> = ({ url, caption }) => {
  const descriptor = parseVideoEmbedUrl(url);

  if (!descriptor) {
    return null;
  }

  return (
    <figure className="my-8">
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
        <figcaption className="mt-2.5 text-center text-xs font-serif italic text-stone-500">
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
}> = ({ src, caption, linkUrl, wide }) => {
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
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#9A3412] hover:underline">
            <span>{extractHostnameLabel(linkUrl)}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </a>
      ) : (
        imageNode
      )}

      {caption && (
        <figcaption className="mt-2.5 text-center text-xs font-serif italic text-stone-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export const StoryBlocksRenderer: React.FC<{
  blocks: StoryBlock[];
  offersMap: Record<string, AffiliateOffer>;
  enableDropCap?: boolean;
}> = ({ blocks, offersMap, enableDropCap = true }) => {
  let firstParagraphRendered = false;

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h2
                key={block.id || index}
                className="pt-6 font-serif text-2xl sm:text-[1.65rem] font-medium text-stone-900 leading-snug"
              >
                <InlineFormattedText text={block.text} />
              </h2>
            );

          case 'subheading':
            return (
              <h3
                key={block.id || index}
                className="pt-4 font-serif text-xl font-medium text-stone-800 leading-snug"
              >
                <InlineFormattedText text={block.text} />
              </h3>
            );

          case 'quote':
            return (
              <blockquote
                key={block.id || index}
                className="my-8 py-6 border-y border-stone-300/80 font-serif italic text-xl sm:text-2xl text-stone-800 leading-relaxed"
              >
                “<InlineFormattedText text={block.text} />”
              </blockquote>
            );

          case 'divider':
            return (
              <div
                key={block.id || index}
                role="separator"
                className="py-6 text-center text-stone-400 tracking-[0.6em] text-lg select-none"
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
              />
            );

          case 'video':
            return (
              <VideoEmbedFigure
                key={block.id || index}
                url={block.url}
                caption={block.caption}
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

          case 'paragraph': {
            const isOpening = enableDropCap && !firstParagraphRendered;
            firstParagraphRendered = true;
            return (
              <p
                key={block.id || index}
                className={`text-base sm:text-[17px] text-stone-800 leading-[1.82] ${
                  isOpening
                    ? 'first-letter:font-serif first-letter:text-5xl first-letter:font-medium first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none first-letter:text-stone-900'
                    : ''
                }`}
              >
                <InlineFormattedText text={block.text} />
              </p>
            );
          }
        }
      })}
    </div>
  );
};
