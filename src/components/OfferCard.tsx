import React, { useState } from 'react';
import { ArrowUpRight, Check, PenLine, Play, Trash2, Video } from 'lucide-react';
import { AffiliateOffer } from '../types';
import { ResilientImage } from './ResilientImage';
import { InlineFormattedText, VideoEmbedFigure } from './EditorialRichBlocks';
import { useFirebaseApp } from '../context/FirebaseContext';

interface OfferCardProps {
  offer: AffiliateOffer;
  variant?: 'grid' | 'inline' | 'rail';
  onEdit?: (offer: AffiliateOffer) => void;
  onDelete?: (offer: AffiliateOffer) => Promise<void> | void;
}

function getKindLabel(kind: AffiliateOffer['kind']): string {
  switch (kind) {
    case 'physical':
      return 'Physical Product';
    case 'digital':
      return 'Digital Product';
    case 'service':
      return 'Professional Service';
  }
}

function getActionLabel(offer: AffiliateOffer): string {
  if (offer.kind === 'service') {
    if (offer.platform === 'Fiverr') return 'Commission on Fiverr';
    if (offer.platform === 'Upwork') return 'Hire on Upwork';
    if (offer.platform === 'Toptal') return 'Hire via Toptal';
    if (offer.platform === '99designs') return 'View on 99designs';
    if (offer.platform === 'Contra') return 'Hire on Contra';
    if (offer.platform === 'PeoplePerHour') return 'Book on PeoplePerHour';
    if (offer.platform === 'Custom') return 'Visit Service Page';
    return `View Service on ${offer.platform}`;
  }
  if (offer.kind === 'digital') {
    if (offer.platform === 'Digistore24') return 'Get via Digistore24';
    if (offer.platform === 'ClickBank') return 'Access via ClickBank';
    if (offer.platform === 'Gumroad') return 'Get on Gumroad';
    if (offer.platform === 'Custom') return 'Open Digital Offer';
    return `Get on ${offer.platform}`;
  }
  if (offer.platform === 'Amazon') return 'Buy on Amazon';
  if (offer.platform === 'Digistore24') return 'Order via Digistore24';
  if (offer.platform === 'Custom') return 'Open Partner Page';
  return `Shop on ${offer.platform}`;
}

export const OfferCard: React.FC<OfferCardProps> = ({
  offer,
  variant = 'grid',
  onEdit,
  onDelete,
}) => {
  const { recordOutboundClick } = useFirebaseApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const hasVideo = Boolean(offer.videoUrl && offer.videoUrl.trim());

  if (variant === 'rail') {
    return (
      <div className="py-4 first:pt-0 last:pb-0 border-b border-stone-200/80 last:border-b-0">
        <div className="flex items-start gap-3.5">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#F3EFE8] shrink-0">
            <ResilientImage
              imageKey={offer.imageKey}
              alt={offer.title}
              fallbackLabel={offer.platform}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
              <span>{offer.platform}</span>
              <span aria-hidden="true">·</span>
              <span>{getKindLabel(offer.kind)}</span>
            </div>
            <h4 className="mt-0.5 text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
              {offer.title}
            </h4>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-medium text-stone-800 tabular-nums">
                {offer.priceLabel}
              </span>
              <a
                href={offer.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => recordOutboundClick(offer.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A3412] hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{getActionLabel(offer)}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <aside
        aria-label={`Recommended ${getKindLabel(offer.kind)}: ${offer.title}`}
        className="my-8 bg-[#F5F2EB] border border-stone-200/90 rounded-xl p-5 sm:p-6 text-stone-900"
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          <div className="sm:col-span-4 aspect-[4/3] rounded-lg overflow-hidden bg-stone-200/60">
            <ResilientImage
              imageKey={offer.imageKey}
              alt={offer.title}
              fallbackLabel={offer.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="sm:col-span-8">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
              <span className="font-medium text-stone-700">{offer.platform}</span>
              <span aria-hidden="true">·</span>
              <span>{getKindLabel(offer.kind)}</span>
              <span aria-hidden="true">·</span>
              <span>{offer.category}</span>
            </div>

            <h3 className="mt-1.5 font-serif text-lg sm:text-xl font-medium text-stone-900 leading-snug">
              {offer.title}
            </h3>

            <p className="mt-2 text-sm text-stone-600 leading-relaxed whitespace-pre-line">
              <InlineFormattedText text={offer.summary} />
            </p>

            {hasVideo && offer.videoUrl && (
              <VideoEmbedFigure url={offer.videoUrl} compact />
            )}

            {offer.highlights.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {offer.highlights.slice(0, 3).map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-stone-700 leading-relaxed"
                  >
                    <Check className="w-3.5 h-3.5 text-[#9A3412] shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 pt-4 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="block text-[11px] text-stone-500">
                  Partner platform price / rate
                </span>
                <span className="font-mono text-base font-medium text-stone-900 tabular-nums">
                  {offer.priceLabel}
                </span>
              </div>

              <a
                href={offer.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => recordOutboundClick(offer.id)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>{getActionLabel(offer)}</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Default: 'grid' storefront/directory card
  return (
    <article className="group flex flex-col bg-white border border-stone-200/90 rounded-xl overflow-hidden transition-transform duration-150 hover:-translate-y-0.5">
      {showVideo && hasVideo && offer.videoUrl ? (
        <div className="w-full bg-stone-950 px-3 py-1">
          <VideoEmbedFigure url={offer.videoUrl} compact />
        </div>
      ) : (
        <a
          href={offer.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => recordOutboundClick(offer.id)}
          className="block aspect-[4/3] w-full bg-[#F3EFE8] overflow-hidden"
        >
          <ResilientImage
            imageKey={offer.imageKey}
            alt={offer.title}
            fallbackLabel={offer.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </a>
      )}

      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <span className="font-medium text-[#9A3412]">{offer.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{getKindLabel(offer.kind)}</span>
            {hasVideo && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setShowVideo((v) => !v)}
                  className="inline-flex items-center gap-1 font-medium text-stone-700 hover:text-[#9A3412] underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {showVideo ? (
                    <>
                      <Video className="w-3 h-3" />
                      <span>Hide Video</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Watch Video</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(offer)}
                  title="Edit listing"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-700 hover:text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded cursor-pointer whitespace-nowrap"
                >
                  <PenLine className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
              {onDelete && (
                confirmDelete ? (
                  <div className="inline-flex items-center gap-1 text-[11px] bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                    <button
                      type="button"
                      onClick={() => {
                        void onDelete(offer);
                        setConfirmDelete(false);
                      }}
                      className="font-semibold text-red-700 hover:underline cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-stone-500 hover:text-stone-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    title="Delete listing"
                    aria-label={`Delete ${offer.title}`}
                    className="p-1 text-stone-400 hover:text-red-700 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
          )}
        </div>

        <h3 className="mt-2 text-base font-semibold text-stone-900 leading-snug line-clamp-2">
          <a
            href={offer.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => recordOutboundClick(offer.id)}
            className="hover:text-[#9A3412] transition-colors"
          >
            {offer.title}
          </a>
        </h3>

        <p className="mt-2 text-sm text-stone-600 leading-relaxed whitespace-pre-line line-clamp-4 flex-1">
          <InlineFormattedText text={offer.summary} />
        </p>

        {offer.highlights.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 line-clamp-1">
            {offer.highlights[0]}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-stone-200/80 flex items-center justify-between gap-3">
          <span className="font-mono text-[15px] font-medium text-stone-900 tabular-nums">
            {offer.priceLabel}
          </span>

          <a
            href={offer.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => recordOutboundClick(offer.id)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>{getActionLabel(offer)}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
};
