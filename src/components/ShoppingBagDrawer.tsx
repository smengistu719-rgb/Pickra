import React, { useEffect, useState } from 'react';
import {
  Check,
  CreditCard,
  Download,
  ExternalLink,
  LogIn,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useFirebaseApp } from '../context/FirebaseContext';
import { formatPriceCents, triggerDigitalAssetDownload } from '../firebase';
import {
  CustomerPaymentMethod,
  DeliveredDigitalAsset,
  DirectOrder,
  DirectProduct,
} from '../types';
import { AuthPanel } from './AuthModal';
import { ResilientImage } from './ResilientImage';

interface ShoppingBagDrawerProps {
  onNavigateToPurchases?: () => void;
  onOpenPrivacy?: () => void;
  onOpenContactSupport?: () => void;
}

const CUSTOMER_PAYMENT_OPTIONS: {
  value: CustomerPaymentMethod;
  label: string;
  refLabel: string;
  placeholder: string;
}[] = [
  {
    value: 'Card',
    label: 'Debit / Credit Card',
    refLabel: 'Card Last 4 Digits or Receipt Note (Never enter full card #)',
    placeholder: 'e.g., Visa ending in 4242',
  },
  {
    value: 'Telebirr',
    label: 'Telebirr',
    refLabel: 'Telebirr Transaction Reference / Last 4 Digits',
    placeholder: 'e.g., TLB-984120',
  },
  {
    value: 'CBEBirr',
    label: 'CBE Birr',
    refLabel: 'CBE Birr Transaction Reference',
    placeholder: 'e.g., CBE-551904',
  },
  {
    value: 'PayPal',
    label: 'PayPal',
    refLabel: 'PayPal Receipt ID or Payer Handle',
    placeholder: 'e.g., PP-804219',
  },
  {
    value: 'BankTransfer',
    label: 'Bank Transfer',
    refLabel: 'Bank Transfer Slip / Reference Code',
    placeholder: 'e.g., FT26298104',
  },
];

export const ShoppingBagDrawer: React.FC<ShoppingBagDrawerProps> = ({
  onNavigateToPurchases,
  onOpenPrivacy,
  onOpenContactSupport,
}) => {
  const {
    user,
    profile,
    isCartOpen,
    setIsCartOpen,
    cartItems,
    cartCount,
    cartSubtotalCents,
    appliedPromoCode,
    appliedCampaign,
    cartDiscountCents,
    cartShippingCents,
    cartTotalCents,
    cartRequiresShipping,
    allAccessibleDirectProductsMap,
    publishedCampaigns,
    deliveredDigitalCache,
    fetchProtectedDigitalSecret,
    updateCartQuantity,
    removeFromCart,
    applyPromoCode,
    clearPromoCode,
    placeDirectOrder,
    siteConfig,
    cartInitialStep,
    setCartInitialStep,
  } = useFirebaseApp();

  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [showOptionalSignIn, setShowOptionalSignIn] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoFeedback, setPromoFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<CustomerPaymentMethod>('Card');
  const [paymentReference, setPaymentReference] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<DirectOrder | null>(null);
  const [downloadingProductId, setDownloadingProductId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (profile?.displayName && !buyerName) {
      setBuyerName(profile.displayName);
    } else if (user?.displayName && !buyerName) {
      setBuyerName(user.displayName);
    }
    if (user?.email && !buyerEmail) {
      setBuyerEmail(user.email);
    }
  }, [user, profile, buyerName, buyerEmail]);

  useEffect(() => {
    if (user) {
      setShowOptionalSignIn(false);
    }
  }, [user]);

  useEffect(() => {
    if (appliedPromoCode) {
      setPromoInput(appliedPromoCode);
    }
  }, [appliedPromoCode]);

  useEffect(() => {
    if (!isCartOpen) return;
    if (
      cartInitialStep === 'checkout' &&
      cartItems.length > 0 &&
      siteConfig.storeCheckoutEnabled !== false
    ) {
      setStep('checkout');
      setCartInitialStep('bag');
    }
  }, [
    isCartOpen,
    cartInitialStep,
    cartItems.length,
    siteConfig.storeCheckoutEnabled,
    setCartInitialStep,
  ]);

  if (!isCartOpen) return null;

  const resolvedCartLines = cartItems
    .map((item) => {
      const product = allAccessibleDirectProductsMap[item.productId];
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const purchasedDigitalProducts: DirectProduct[] = confirmedOrder
    ? confirmedOrder.productIds
        .map((pid) => allAccessibleDirectProductsMap[pid])
        .filter((p): p is DirectProduct => Boolean(p && p.kind === 'digital'))
    : [];

  const activePaymentOption =
    CUSTOMER_PAYMENT_OPTIONS.find((opt) => opt.value === paymentMethod) ||
    CUSTOMER_PAYMENT_OPTIONS[0];

  function resolveDigitalAssetForOrder(
    prod: DirectProduct,
    order: DirectOrder
  ): DeliveredDigitalAsset | null {
    const fromOrder = order.deliveredDigitalAssets?.[prod.id];
    if (fromOrder?.url) return fromOrder;
    const fromCache = deliveredDigitalCache[prod.id];
    if (fromCache?.url) return fromCache;
    if (prod.digitalFileUrl) {
      return {
        url: prod.digitalFileUrl,
        fileName: prod.digitalFileName || `${prod.sku}.download`,
        fileType: prod.digitalFileType || 'Digital Download',
      };
    }
    return null;
  }

  async function handleConfirmedDigitalDownload(
    prod: DirectProduct,
    order: DirectOrder
  ) {
    const immediate = resolveDigitalAssetForOrder(prod, order);
    if (immediate?.url) {
      triggerDigitalAssetDownload(
        immediate.url,
        immediate.fileName || prod.digitalFileName || `${prod.sku}.download`
      );
      return;
    }
    setDownloadingProductId(prod.id);
    try {
      const unlocked = await fetchProtectedDigitalSecret(prod.id, order.id);
      if (unlocked?.url) {
        triggerDigitalAssetDownload(
          unlocked.url,
          unlocked.fileName || prod.digitalFileName || `${prod.sku}.download`
        );
      }
    } finally {
      setDownloadingProductId(null);
    }
  }

  function handleClose() {
    setIsCartOpen(false);
    setCartInitialStep('bag');
    if (step === 'confirmed') {
      setStep('bag');
      setConfirmedOrder(null);
    }
  }

  function handleApplyPromo(e: React.FormEvent) {
    e.preventDefault();
    const res = applyPromoCode(promoInput);
    setPromoFeedback({ ok: res.ok, text: res.message });
  }

  async function handleCompleteOrder(e: React.FormEvent) {
    e.preventDefault();
    setCheckoutError(null);

    // Block accidental full 13-19 digit PAN entry in reference field
    const digitsOnly = paymentReference.replace(/\D/g, '');
    if (paymentMethod === 'Card' && digitsOnly.length >= 12) {
      setCheckoutError(
        'For security, please enter only the last 4 digits or a short receipt label—never a full card number.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const order = await placeDirectOrder({
        buyerName,
        buyerEmail,
        shippingAddress,
        paymentMethod,
        paymentReference:
          paymentReference.trim() || `${paymentMethod} Authorized`,
      });
      setConfirmedOrder(order);
      setStep('confirmed');
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Unable to complete direct order.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Pickras Direct Shopping Bag"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg bg-[#FBF9F5] h-full flex flex-col border-l border-stone-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#9A3412]" />
            <h2 className="font-serif text-lg font-medium text-stone-900">
              {step === 'confirmed'
                ? 'Order Confirmed'
                : step === 'checkout'
                ? 'Direct Checkout (Guest Friendly)'
                : `Shopping Bag (${cartCount})`}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close shopping bag"
            className="p-2 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 'confirmed' && confirmedOrder ? (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-stone-200 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <Check className="w-4 h-4" />
                  <span>Direct Purchase Completed</span>
                </div>
                <h3 className="mt-2 font-serif text-2xl font-medium text-stone-900">
                  Thank you, {confirmedOrder.buyerName}.
                </h3>
                <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">
                  Order reference{' '}
                  <span className="font-mono font-semibold text-stone-900">
                    {confirmedOrder.orderNumber}
                  </span>{' '}
                  is confirmed and saved under My Purchases.
                </p>

                <div className="mt-5 pt-4 border-t border-stone-200 space-y-2 text-xs text-stone-600">
                  <div className="flex justify-between gap-4">
                    <span>Items</span>
                    <span className="text-stone-900 font-medium text-right">
                      {confirmedOrder.itemsSummary}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Receipt Email</span>
                    <span className="font-mono text-stone-900">
                      {confirmedOrder.buyerEmail}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Payment Method</span>
                    <span className="text-stone-900 font-medium text-right">
                      {confirmedOrder.paymentMethod || 'Card'}
                      {confirmedOrder.paymentReference
                        ? ` · ${confirmedOrder.paymentReference}`
                        : ''}
                    </span>
                  </div>
                  {confirmedOrder.shippingAddress && (
                    <div className="flex justify-between gap-4">
                      <span>Shipping Destination</span>
                      <span className="text-stone-900 text-right">
                        {confirmedOrder.shippingAddress}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 pt-2 border-t border-stone-100 text-sm font-semibold text-stone-900">
                    <span>Total Paid</span>
                    <span className="font-mono tabular-nums">
                      {formatPriceCents(confirmedOrder.totalCents)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instant Digital Product Downloads on Confirmation */}
              {purchasedDigitalProducts.length > 0 && (
                <div className="p-5 bg-white border border-stone-300 rounded-xl space-y-3">
                  <div className="text-xs font-semibold text-[#9A3412]">
                    Instant Digital Deliverables Unlocked
                  </div>
                  {purchasedDigitalProducts.map((prod) => {
                    const resolved = resolveDigitalAssetForOrder(
                      prod,
                      confirmedOrder
                    );
                    const canFetchVault = Boolean(
                      resolved?.url || prod.hasDigitalAsset
                    );
                    return (
                      <div
                        key={prod.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#FBF9F5] border border-stone-200 rounded-lg"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-stone-900 truncate">
                            {prod.title}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {resolved?.fileType ||
                              prod.digitalFileType ||
                              'Digital Edition'}
                            {resolved?.fileName || prod.digitalFileName
                              ? ` · ${resolved?.fileName || prod.digitalFileName}`
                              : ''}
                          </div>
                        </div>
                        {canFetchVault ? (
                          <button
                            type="button"
                            disabled={downloadingProductId === prod.id}
                            onClick={() =>
                              void handleConfirmedDigitalDownload(
                                prod,
                                confirmedOrder
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:bg-stone-400 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            {resolved?.url?.startsWith('https://') ? (
                              <>
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Access Digital Product</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>
                                  {downloadingProductId === prod.id
                                    ? 'Preparing...'
                                    : 'Download File'}
                                </span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-800 font-medium">
                            Receipt recorded for {confirmedOrder.buyerEmail}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-4 bg-[#F5F2EB] border border-stone-200/90 rounded-xl text-xs text-stone-700 leading-relaxed">
                <span className="font-semibold text-stone-900 block mb-1">
                  Fulfillment Status
                </span>
                {confirmedOrder.fulfillmentNote}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {onNavigateToPurchases && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onNavigateToPurchases();
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Package className="w-4 h-4" />
                    <span>View My Purchases</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Continue Shopping
                </button>
              </div>

              {onOpenContactSupport && (
                <div className="text-[11px] text-stone-500 flex items-center justify-between gap-2 pt-1">
                  <span>Need help with delivery or a private order issue?</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onOpenContactSupport();
                    }}
                    className="font-medium text-[#9A3412] hover:underline cursor-pointer shrink-0"
                  >
                    Contact Order Support →
                  </button>
                </div>
              )}
            </div>
          ) : resolvedCartLines.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="w-8 h-8 text-stone-300 mx-auto" />
              <h3 className="mt-3 font-serif text-xl font-medium text-stone-900">
                Your Pickras bag is empty
              </h3>
              <p className="mt-1.5 text-sm text-stone-600 max-w-xs mx-auto leading-relaxed">
                Browse creator products and purchase physical or digital items
                directly — no account required.
              </p>

              {publishedCampaigns.length > 0 && (
                <div className="mt-8 p-4 bg-white border border-stone-200 rounded-xl text-left">
                  <div className="text-xs font-medium text-[#9A3412]">
                    Active Storefront Offer ·{' '}
                    {publishedCampaigns[0].discountPercent}% Off
                  </div>
                  <p className="mt-1 text-xs text-stone-700 leading-relaxed">
                    {publishedCampaigns[0].title} — use code{' '}
                    <span className="font-mono font-semibold text-stone-900">
                      {publishedCampaigns[0].promoCode}
                    </span>{' '}
                    at checkout.
                  </p>
                </div>
              )}
            </div>
          ) : step === 'bag' ? (
            <div className="space-y-6">
              {!siteConfig.storeCheckoutEnabled && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                  Direct Store checkout is temporarily paused by the creator for
                  inventory maintenance. Items remain saved in your bag.
                </div>
              )}

              {/* Free shipping threshold progress */}
              {cartRequiresShipping &&
                siteConfig.freeShippingThresholdCents > 0 && (
                  <div className="p-3.5 bg-[#F5F2EB] border border-stone-200/90 rounded-lg text-xs text-stone-700">
                    {cartShippingCents === 0 ? (
                      <span>
                        Complimentary tracked studio shipping unlocked on this
                        order.
                      </span>
                    ) : (
                      <span>
                        Add{' '}
                        <strong className="font-mono text-stone-900 tabular-nums">
                          {formatPriceCents(
                            Math.max(
                              0,
                              siteConfig.freeShippingThresholdCents -
                                Math.max(
                                  0,
                                  cartSubtotalCents - cartDiscountCents
                                )
                            )
                          )}
                        </strong>{' '}
                        more for complimentary tracked shipping (orders over{' '}
                        <span className="font-mono tabular-nums">
                          {formatPriceCents(
                            siteConfig.freeShippingThresholdCents
                          )}
                        </span>
                        ).
                      </span>
                    )}
                  </div>
                )}

              {/* Line Items */}
              <div className="divide-y divide-stone-200 bg-white border border-stone-200 rounded-xl px-4">
                {resolvedCartLines.map(({ product, quantity }) => (
                  <div
                    key={product.id}
                    className="py-4 flex items-start gap-3.5"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#F3EFE8] shrink-0">
                      <ResilientImage
                        imageKey={product.imageKey}
                        alt={product.title}
                        fallbackLabel={product.sku}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-stone-500">
                        {product.kind === 'digital'
                          ? product.digitalFileType || 'Instant Digital'
                          : 'Physical Edition'}{' '}
                        · {product.sku}
                      </div>
                      <h4 className="mt-0.5 text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
                        {product.title}
                      </h4>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center border border-stone-200 rounded-lg bg-[#FBF9F5]">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() =>
                              updateCartQuantity(product.id, quantity - 1)
                            }
                            className="p-1.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2.5 font-mono text-xs font-medium text-stone-900 tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() =>
                              updateCartQuantity(product.id, quantity + 1)
                            }
                            className="p-1.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-stone-900 tabular-nums">
                            {formatPriceCents(product.priceCents * quantity)}
                          </span>
                          <button
                            type="button"
                            aria-label="Remove item"
                            onClick={() => removeFromCart(product.id)}
                            className="text-stone-400 hover:text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Marketing Promo / Coupon Engine */}
              <div className="p-4 bg-white border border-stone-200 rounded-xl">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#9A3412]" />
                    <span>Promotional Code</span>
                  </label>
                  {appliedCampaign && (
                    <button
                      type="button"
                      onClick={() => {
                        clearPromoCode();
                        setPromoInput('');
                        setPromoFeedback(null);
                      }}
                      className="text-[11px] text-stone-500 hover:text-stone-900 underline cursor-pointer"
                    >
                      Remove {appliedCampaign.promoCode}
                    </button>
                  )}
                </div>

                <form
                  onSubmit={handleApplyPromo}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) =>
                      setPromoInput(e.target.value.toUpperCase())
                    }
                    placeholder="e.g., PICKRAS15"
                    maxLength={24}
                    className="flex-1 px-3 py-2 text-xs font-mono uppercase bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 text-xs font-semibold text-stone-900 bg-[#F3EFE8] hover:bg-stone-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Apply
                  </button>
                </form>

                {promoFeedback && (
                  <p
                    className={`mt-2 text-xs ${
                      promoFeedback.ok ? 'text-emerald-800' : 'text-red-700'
                    }`}
                  >
                    {promoFeedback.text}
                  </p>
                )}

                {!appliedCampaign && publishedCampaigns.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                    <span>Available offers:</span>
                    {publishedCampaigns.slice(0, 2).map((camp) => (
                      <button
                        key={camp.id}
                        type="button"
                        onClick={() => {
                          setPromoInput(camp.promoCode);
                          const res = applyPromoCode(camp.promoCode);
                          setPromoFeedback({ ok: res.ok, text: res.message });
                        }}
                        className="font-mono font-medium text-[#9A3412] hover:underline cursor-pointer"
                      >
                        {camp.promoCode} ({camp.discountPercent}% off)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Step === 'checkout' — Direct Guest Checkout Enabled (No Sign-In Required!) */
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('bag');
                    setCheckoutError(null);
                  }}
                  className="text-xs font-medium text-stone-600 hover:text-stone-900 underline cursor-pointer"
                >
                  ← Edit items or promo code
                </button>

                {!user && (
                  <button
                    type="button"
                    onClick={() => setShowOptionalSignIn((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9A3412] hover:underline cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>
                      {showOptionalSignIn
                        ? 'Checkout as Guest instead'
                        : 'Optional: Sign in to account'}
                    </span>
                  </button>
                )}
              </div>

              {checkoutError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  {checkoutError}
                </div>
              )}

              {!user && showOptionalSignIn ? (
                <AuthPanel
                  defaultMode="signin"
                  defaultAsSeller={false}
                  heading="Sign in or continue as guest"
                  subheading="Sign in with Google or Email to sync purchases across devices, or click 'Checkout as Guest instead' above."
                  onSuccess={() => setShowOptionalSignIn(false)}
                />
              ) : (
                <form
                  id="direct-checkout-form"
                  onSubmit={(e) => void handleCompleteOrder(e)}
                  className="p-5 bg-white border border-stone-200 rounded-xl space-y-4"
                >
                  {!user && (
                    <div className="pb-3 border-b border-stone-100 text-xs text-stone-600 leading-relaxed">
                      <span className="font-semibold text-stone-900">
                        Guest Express Checkout
                      </span>{' '}
                      — purchase directly without creating an account. Digital
                      downloads unlock immediately upon confirmation.
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Receipt &amp; Digital Delivery Email
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={254}
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>

                  {cartRequiresShipping ? (
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Courier Shipping Address
                      </label>
                      <textarea
                        rows={3}
                        required
                        minLength={6}
                        maxLength={300}
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        placeholder="Street address, apartment/suite, city, state/region, postal code, country"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      />
                    </div>
                  ) : (
                    <div className="p-3 bg-[#F5F2EB] rounded-lg text-xs text-stone-700">
                      Digital-only order — instant download access unlocks
                      immediately upon confirmation with $0 shipping.
                    </div>
                  )}

                  {/* Payment Method & Safe Payment Reference */}
                  <div className="pt-2 border-t border-stone-100 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
                      <CreditCard className="w-3.5 h-3.5 text-[#9A3412]" />
                      <span>Payment Method</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CUSTOMER_PAYMENT_OPTIONS.map((opt) => {
                        const selected = paymentMethod === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPaymentMethod(opt.value)}
                            className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left transition-colors cursor-pointer ${
                              selected
                                ? 'bg-[#FDF3EC] border-[#9A3412] text-[#9A3412] font-semibold'
                                : 'bg-[#FBF9F5] border-stone-300 text-stone-700 hover:border-stone-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        {activePaymentOption.refLabel}
                      </label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={80}
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder={activePaymentOption.placeholder}
                        className="w-full px-3 py-2 text-xs font-mono bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                      />
                    </div>

                    <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 leading-relaxed flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Receipt email and shipping details are restricted strictly to order fulfillment; payment references are stored in masked form.
                      </span>
                      {(onOpenPrivacy || onOpenContactSupport) && (
                        <span className="inline-flex items-center gap-2 shrink-0">
                          {onOpenPrivacy && (
                            <button
                              type="button"
                              onClick={() => {
                                handleClose();
                                onOpenPrivacy();
                              }}
                              className="font-medium text-stone-700 hover:text-[#9A3412] underline underline-offset-2 cursor-pointer"
                            >
                              Privacy Policy
                            </button>
                          )}
                          {onOpenPrivacy && onOpenContactSupport && (
                            <span aria-hidden="true">·</span>
                          )}
                          {onOpenContactSupport && (
                            <button
                              type="button"
                              onClick={() => {
                                handleClose();
                                onOpenContactSupport();
                              }}
                              className="font-medium text-stone-700 hover:text-[#9A3412] underline underline-offset-2 cursor-pointer"
                            >
                              Order Help
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Sticky Summary Footer */}
        {step !== 'confirmed' && resolvedCartLines.length > 0 && (
          <div className="px-6 py-5 border-t border-stone-200 bg-white space-y-4">
            <div className="space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono text-stone-900 tabular-nums">
                  {formatPriceCents(cartSubtotalCents)}
                </span>
              </div>
              {cartDiscountCents > 0 && appliedCampaign && (
                <div className="flex justify-between text-emerald-800 font-medium">
                  <span>
                    Promo ({appliedCampaign.promoCode} · −
                    {appliedCampaign.discountPercent}%)
                  </span>
                  <span className="font-mono tabular-nums">
                    −{formatPriceCents(cartDiscountCents)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>
                  {cartRequiresShipping
                    ? 'Tracked Studio Shipping'
                    : 'Digital Delivery'}
                </span>
                <span className="font-mono text-stone-900 tabular-nums">
                  {cartShippingCents === 0
                    ? 'Free'
                    : formatPriceCents(cartShippingCents)}
                </span>
              </div>
              <div className="pt-2 border-t border-stone-200 flex justify-between text-sm font-semibold text-stone-900">
                <span>Total</span>
                <span className="font-mono text-base tabular-nums">
                  {formatPriceCents(cartTotalCents)}
                </span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                disabled={!siteConfig.storeCheckoutEnabled}
                onClick={() => setStep('checkout')}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#1C1917] hover:bg-[#9A3412] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {siteConfig.storeCheckoutEnabled
                  ? `Proceed to Direct Checkout · ${formatPriceCents(
                      cartTotalCents
                    )}`
                  : 'Direct Checkout Temporarily Paused'}
              </button>
            ) : !user && showOptionalSignIn ? null : (
              <button
                type="submit"
                form="direct-checkout-form"
                disabled={submitting || !siteConfig.storeCheckoutEnabled}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {!siteConfig.storeCheckoutEnabled
                  ? 'Direct Checkout Paused'
                  : submitting
                  ? 'Placing Direct Order...'
                  : `Complete Direct Purchase · ${formatPriceCents(
                      cartTotalCents
                    )}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
