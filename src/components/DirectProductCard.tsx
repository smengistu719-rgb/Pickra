import React, { useRef, useState } from 'react';
import { Camera, Check, PenLine, ShoppingBag, Trash2 } from 'lucide-react';
import { DirectProduct } from '../types';
import { compressImageFileToDataUrl, formatPriceCents } from '../firebase';
import { ResilientImage } from './ResilientImage';
import { useFirebaseApp } from '../context/FirebaseContext';

interface DirectProductCardProps {
  product: DirectProduct;
  variant?: 'grid' | 'inline' | 'rail';
  showApprovalBadge?: boolean;
  onInspectProduct?: (product: DirectProduct) => void;
  onEdit?: (product: DirectProduct) => void;
  onDelete?: (product: DirectProduct) => Promise<void> | void;
  onChangeImage?: (
    product: DirectProduct,
    nextImageKey: string
  ) => Promise<void> | void;
}

function getDirectKindLabel(product: DirectProduct): string {
  if (product.kind === 'digital') {
    return product.digitalFileType?.trim()
      ? `Digital · ${product.digitalFileType.trim()}`
      : 'Instant Digital';
  }
  return 'Physical Product';
}

export const DirectProductCard: React.FC<DirectProductCardProps> = ({
  product,
  variant = 'grid',
  showApprovalBadge = false,
  onInspectProduct,
  onEdit,
  onDelete,
  onChangeImage,
}) => {
  const { addToCart, buyNowProduct, siteConfig } = useFirebaseApp();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const isOutOfStock = product.stockCount <= 0;
  const checkoutDisabled = isOutOfStock || siteConfig.storeCheckoutEnabled === false;
  const hasMarkdown =
    product.compareAtCents > product.priceCents && product.compareAtCents > 0;
  const savingsPercent = hasMarkdown
    ? Math.round(
        ((product.compareAtCents - product.priceCents) / product.compareAtCents) *
          100
      )
    : 0;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product.id, 1, true);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.stopPropagation();
    if (isOutOfStock) return;
    if (siteConfig.storeCheckoutEnabled === false) {
      addToCart(product.id, 1, true);
      return;
    }
    buyNowProduct(product.id, 1);
  }

  function handleInspect(e: React.MouseEvent) {
    e.stopPropagation();
    onInspectProduct?.(product);
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onChangeImage) return;
    setPhotoBusy(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      await onChangeImage(product, compressed);
    } catch {
      // ignore invalid file errors
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  }

  const sharedPhotoInput = onChangeImage ? (
    <input
      ref={photoInputRef}
      type="file"
      accept="image/*"
      onChange={(e) => void handlePhotoFile(e)}
      onClick={(e) => e.stopPropagation()}
      className="hidden"
    />
  ) : null;

  if (variant === 'rail') {
    return (
      <div className="py-4 first:pt-0 last:pb-0 border-b border-stone-200/80 last:border-b-0">
        {sharedPhotoInput}
        <div className="flex items-start gap-3.5">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#F3EFE8] shrink-0">
            <ResilientImage
              imageKey={product.imageKey}
              alt={product.title}
              fallbackLabel={product.sku}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
              <span className="font-medium text-[#9A3412] truncate">
                {product.sellerName || 'Pickra Store'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{getDirectKindLabel(product)}</span>
            </div>
            <h4 className="mt-0.5 text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
              {product.title}
            </h4>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xs font-medium text-stone-900 tabular-nums">
                  {formatPriceCents(product.priceCents)}
                </span>
                {hasMarkdown && (
                  <span className="font-mono text-[11px] text-stone-400 line-through tabular-nums">
                    {formatPriceCents(product.compareAtCents)}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAdd}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A3412] hover:text-stone-900 disabled:text-stone-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{isOutOfStock ? 'Sold Out' : 'Add to Bag'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <aside
        aria-label={`Pickra Store Product: ${product.title}`}
        className="my-8 bg-white border border-stone-300/90 rounded-xl p-5 sm:p-6 text-stone-900"
      >
        {sharedPhotoInput}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          <div className="sm:col-span-4 aspect-[4/3] rounded-lg overflow-hidden bg-[#F3EFE8] relative group/inlineimg">
            <ResilientImage
              imageKey={product.imageKey}
              alt={product.title}
              fallbackLabel={product.title}
              className="w-full h-full object-cover"
            />
            {onChangeImage && (
              <button
                type="button"
                disabled={photoBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  photoInputRef.current?.click();
                }}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-900 bg-white/95 hover:bg-white border border-stone-300 rounded shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-3 h-3 text-[#9A3412]" />
                <span>{photoBusy ? 'Saving...' : 'Photo'}</span>
              </button>
            )}
          </div>
          <div className="sm:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                <span className="font-semibold text-[#9A3412]">
                  By {product.sellerName || 'Pickra Studio'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{getDirectKindLabel(product)}</span>
                {product.badgeLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-stone-700 font-medium">
                      {product.badgeLabel}
                    </span>
                  </>
                )}
              </div>

              {(onEdit || onDelete) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-700 hover:text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded cursor-pointer whitespace-nowrap"
                    >
                      <PenLine className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                  {onDelete &&
                    (confirmDelete ? (
                      <div className="inline-flex items-center gap-1 text-[11px] bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        <button
                          type="button"
                          onClick={() => {
                            void onDelete(product);
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
                        aria-label={`Delete ${product.title}`}
                        className="p-1 text-stone-400 hover:text-red-700 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ))}
                </div>
              )}
            </div>

            <h3 className="mt-1.5 font-serif text-lg sm:text-xl font-medium text-stone-900 leading-snug">
              {product.title}
            </h3>

            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              {product.summary}
            </p>

            {product.highlights.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {product.highlights.slice(0, 3).map((point, idx) => (
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
                  {product.deliveryNote}
                </span>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-mono text-base font-medium text-stone-900 tabular-nums">
                    {formatPriceCents(product.priceCents)}
                  </span>
                  {hasMarkdown && (
                    <>
                      <span className="font-mono text-xs text-stone-400 line-through tabular-nums">
                        {formatPriceCents(product.compareAtCents)}
                      </span>
                      <span className="text-xs font-medium text-[#9A3412] tabular-nums">
                        Save {savingsPercent}%
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={isOutOfStock}
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Bag</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {isOutOfStock
                        ? 'Sold Out'
                        : `Buy Direct · ${formatPriceCents(product.priceCents)}`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // Default: 'grid' Direct Storefront card
  return (
    <article
      onClick={() => onInspectProduct?.(product)}
      className={`group flex flex-col bg-white border border-stone-200/90 rounded-xl overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 ${
        onInspectProduct ? 'cursor-pointer' : ''
      }`}
    >
      {sharedPhotoInput}
      <div className="aspect-[4/3] w-full bg-[#F3EFE8] overflow-hidden relative">
        <ResilientImage
          imageKey={product.imageKey}
          alt={product.title}
          fallbackLabel={product.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {onChangeImage && (
          <button
            type="button"
            disabled={photoBusy}
            onClick={(e) => {
              e.stopPropagation();
              photoInputRef.current?.click();
            }}
            title="Upload a new product image"
            className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-900 bg-white/95 hover:bg-white border border-stone-300/90 rounded-lg shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-3 h-3 text-[#9A3412]" />
            <span>{photoBusy ? 'Saving...' : 'Photo'}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          {/* Clean unboxed editorial metadata — zero pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <span className="font-medium text-[#9A3412]">
              {getDirectKindLabel(product)}
            </span>
            {product.category && (
              <>
                <span aria-hidden="true">·</span>
                <span>{product.category}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>By {product.sellerName || 'Pickra Studio'}</span>
            {product.videoUrl?.trim() && (
              <>
                <span aria-hidden="true">·</span>
                <span>Video</span>
              </>
            )}
            {showApprovalBadge && product.approvalStatus && product.approvalStatus !== 'approved' && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    product.approvalStatus === 'rejected'
                      ? 'font-semibold text-red-700'
                      : 'font-semibold text-amber-800'
                  }
                >
                  {product.approvalStatus === 'rejected'
                    ? 'Changes Requested'
                    : 'Pending Review'}
                </span>
              </>
            )}
          </div>

          {(onEdit || onDelete) && (
            <div
              className="flex items-center gap-1.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-stone-700 hover:text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded cursor-pointer whitespace-nowrap"
                >
                  <PenLine className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
              {onDelete &&
                (confirmDelete ? (
                  <div className="inline-flex items-center gap-1 text-[11px] bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                    <button
                      type="button"
                      onClick={() => {
                        void onDelete(product);
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
                    aria-label={`Delete ${product.title}`}
                    title="Delete product"
                    className="p-1 text-stone-400 hover:text-red-700 rounded cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ))}
            </div>
          )}
        </div>

        <h3 className="mt-2 text-base font-semibold text-stone-900 leading-snug line-clamp-2 group-hover:text-[#9A3412] transition-colors">
          {product.title}
        </h3>

        <p className="mt-2 text-sm text-stone-600 leading-relaxed line-clamp-3 flex-1">
          {product.subtitle || product.summary}
        </p>

        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs text-stone-500">
          <span className="truncate">{product.deliveryNote}</span>
          <span className="font-mono tabular-nums shrink-0">
            {product.kind === 'digital'
              ? 'Instant'
              : product.stockCount > 0
              ? `${product.stockCount} left`
              : 'Out of stock'}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-stone-200/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-base font-semibold text-stone-900 tabular-nums">
                {formatPriceCents(product.priceCents)}
              </span>
              {hasMarkdown && (
                <span className="font-mono text-xs text-stone-400 line-through tabular-nums">
                  {formatPriceCents(product.compareAtCents)}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleAdd}
              title={isOutOfStock ? 'Sold out' : 'Add to shopping bag'}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-[#9A3412] disabled:text-stone-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-emerald-800 font-semibold">Added</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>+ Bag</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onInspectProduct && (
              <button
                type="button"
                onClick={handleInspect}
                className="flex-1 px-3 py-2 text-xs font-semibold text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-center"
              >
                View Details
              </button>
            )}

            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleBuyNow}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>
                {isOutOfStock
                  ? 'Sold Out'
                  : checkoutDisabled
                  ? 'Add to Bag'
                  : 'Buy Now'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
