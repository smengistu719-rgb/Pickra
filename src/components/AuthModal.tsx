import React, { useEffect, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Mail,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import { AuthModalMode, useFirebaseApp } from '../context/FirebaseContext';
import { SellerPayoutMethod } from '../types';

const PAYOUT_OPTIONS: { value: SellerPayoutMethod; label: string }[] = [
  { value: 'Stripe', label: 'Stripe Connect' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Wise', label: 'Wise Multi-Currency' },
  { value: 'BankTransfer', label: 'Direct Bank Wire / ACH' },
];

interface AuthPanelProps {
  defaultMode?: AuthModalMode;
  defaultAsSeller?: boolean;
  heading?: string;
  subheading?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  defaultMode = 'signup',
  defaultAsSeller = false,
  heading,
  subheading,
  onSuccess,
  onClose,
}) => {
  const {
    authBusy,
    authError,
    clearAuthError,
    signInWithGoogle,
    registerWithEmailPassword,
    signInWithEmailPassword,
    sendPasswordReset,
  } = useFirebaseApp();

  const [mode, setMode] = useState<AuthModalMode>(defaultMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [asSeller, setAsSeller] = useState(defaultAsSeller);
  const [storeName, setStoreName] = useState('');
  const [payoutMethod, setPayoutMethod] =
    useState<SellerPayoutMethod>('Stripe');
  const [payoutAccount, setPayoutAccount] = useState('');

  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    setAsSeller(defaultAsSeller);
  }, [defaultAsSeller]);

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetMessage(null);
    clearAuthError();

    if (mode === 'signup') {
      const ok = await registerWithEmailPassword({
        fullName,
        email,
        password,
        asSeller,
        storeName: storeName.trim() || fullName.trim(),
        payoutMethod,
        payoutAccount: payoutAccount.trim() || email.trim(),
      });
      if (ok && onSuccess) {
        onSuccess();
      }
    } else {
      const ok = await signInWithEmailPassword(email, password);
      if (ok && onSuccess) {
        onSuccess();
      }
    }
  }

  async function handleGoogleClick() {
    setResetMessage(null);
    clearAuthError();
    const ok = await signInWithGoogle();
    if (ok && onSuccess) {
      onSuccess();
    }
  }

  async function handleForgotPassword() {
    setResetMessage(null);
    clearAuthError();
    try {
      await sendPasswordReset(email);
      setResetMessage(
        `Password reset link sent to ${email.trim()}. Check your inbox.`
      );
    } catch {
      // authError is already populated in context
    }
  }

  return (
    <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-stone-200/80">
        <div>
          <div className="text-xs font-medium text-[#9A3412]">
            Pickra Account &amp; Creator Commerce
          </div>
          <h2 className="mt-1 font-serif text-2xl font-medium text-stone-900">
            {heading ||
              (mode === 'signup'
                ? 'Create your Pickra account'
                : 'Sign in to Pickra')}
          </h2>
          <p className="mt-1 text-xs text-stone-600 leading-relaxed max-w-lg">
            {subheading ||
              (mode === 'signup'
                ? 'Register in seconds with Email & Password or Google to publish products, receive 90% creator payouts, or track direct orders.'
                : 'Sign in with your Email & Password or Google account to access your storefront, orders, or owner backend.')}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication dialog"
            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mode Switcher: Create Account vs Sign In */}
      <div className="mt-5 grid grid-cols-2 gap-1 p-1 bg-[#F3EFE8] rounded-lg">
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            clearAuthError();
            setResetMessage(null);
          }}
          className={`inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            mode === 'signup'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-[#9A3412]" />
          <span>Create Account</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('signin');
            clearAuthError();
            setResetMessage(null);
          }}
          className={`inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            mode === 'signin'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <LogIn className="w-3.5 h-3.5 text-[#9A3412]" />
          <span>Sign In</span>
        </button>
      </div>

      {/* Error / Reset Status Feedback */}
      {authError && (
        <div
          role="alert"
          className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 leading-relaxed flex items-start justify-between gap-3"
        >
          <span>{authError}</span>
          <button
            type="button"
            onClick={clearAuthError}
            className="text-red-700 hover:text-red-950 font-semibold shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {resetMessage && (
        <div
          role="status"
          className="mt-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{resetMessage}</span>
        </div>
      )}

      {/* Email & Password Form (Works inside every browser & iframe with zero popup blockers) */}
      <form onSubmit={(e) => void handleFormSubmit(e)} className="mt-5 space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Elena Vance"
              className="w-full px-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="block text-xs font-medium text-stone-700">
              Password
            </label>
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                className="text-[11px] font-medium text-[#9A3412] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === 'signup'
                  ? 'At least 6 characters'
                  : 'Enter your password'
              }
              className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-[#FBF9F5] border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* One-Step Creator Storefront Activation on Sign Up */}
        {mode === 'signup' && (
          <div className="pt-2 border-t border-stone-200/80 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={asSeller}
                onChange={(e) => setAsSeller(e.target.checked)}
                className="mt-0.5 accent-[#9A3412] w-4 h-4"
              />
              <span className="text-xs text-stone-700 leading-relaxed">
                <strong className="text-stone-900">
                  Activate Creator Seller Storefront
                </strong>{' '}
                — publish physical or digital products on Pickra Store and
                receive 90% net payouts on every sale.
              </span>
            </label>

            {asSeller && (
              <div className="p-4 bg-[#FBF9F5] border border-stone-200 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900">
                  <Store className="w-3.5 h-3.5 text-[#9A3412]" />
                  <span>Creator Storefront &amp; Payout Destination</span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-700 mb-1">
                    Creator / Brand Store Name
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g., Atelier Kibo Studio"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      Payout Method
                    </label>
                    <select
                      value={payoutMethod}
                      onChange={(e) =>
                        setPayoutMethod(e.target.value as SellerPayoutMethod)
                      }
                      className="w-full px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                    >
                      {PAYOUT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      Payout Account (Email / ID)
                    </label>
                    <input
                      type="text"
                      maxLength={160}
                      value={payoutAccount}
                      onChange={(e) => setPayoutAccount(e.target.value)}
                      placeholder="payouts@domain.com or acct_..."
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9A3412]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={authBusy}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-xs font-semibold text-white bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          {authBusy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {mode === 'signup' ? 'Creating Account...' : 'Signing In...'}
              </span>
            </>
          ) : mode === 'signup' ? (
            <>
              <UserPlus className="w-4 h-4" />
              <span>
                {asSeller
                  ? 'Create Creator Seller Account'
                  : 'Create Pickra Account'}
              </span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In with Email</span>
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3 text-[11px] text-stone-400">
        <div className="flex-1 h-px bg-stone-200" />
        <span>or continue with Google</span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>

      {/* Google OAuth Button */}
      <button
        type="button"
        disabled={authBusy}
        onClick={() => void handleGoogleClick()}
        className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-4 text-xs font-semibold text-stone-900 bg-[#FBF9F5] hover:bg-[#F3EFE8] border border-stone-300 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.98-3.09z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.98 3.09c.95-2.85 3.6-4.94 6.73-4.94z"
          />
        </svg>
        <span>Continue with Google</span>
      </button>
    </div>
  );
};

export const AuthModal: React.FC = () => {
  const {
    user,
    isAuthModalOpen,
    authModalMode,
    authModalSellerPreset,
    closeAuthModal,
  } = useFirebaseApp();

  if (!isAuthModalOpen || user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Create Account or Sign In"
      onClick={closeAuthModal}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <AuthPanel
          defaultMode={authModalMode}
          defaultAsSeller={authModalSellerPreset}
          onSuccess={closeAuthModal}
          onClose={closeAuthModal}
        />
      </div>
    </div>
  );
};
