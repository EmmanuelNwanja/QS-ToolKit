'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { STRENGTH_META } from '../utils/passwordPolicy';

/* ══ PasswordInput ═════════════════════════════════════════
   A password field that is masked by default with an eye
   toggle to reveal what is being typed.

   QSToolkit use: every password entry point — login,
   registration, force-change, settings change-password and
   the forgot-password flow. Accepts the same props as a
   native <input> plus an optional `strength` object
   ({ valid, errors, score }) to render a live meter. */

export default function PasswordInput({
  value,
  onChange,
  className = 'input',
  strength,
  showStrengthHint = false,
  ...rest
}) {
  const [visible, setVisible] = useState(false);
  const strengthMeta = STRENGTH_META[strength?.score ?? 0] || STRENGTH_META[0];

  return (
    <div className="relative w-full">
      <input
        type={visible ? 'text' : 'password'}
        className={className}
        value={value}
        onChange={onChange}
        style={{ paddingRight: '2.75rem' }}
        autoComplete={rest.autoComplete}
        {...rest}
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      {strength && (
        <div className="mt-1.5" aria-live="polite">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden bg-gray-100">
              <div
                className={`h-full transition-all duration-300 ${strengthMeta.color}`}
                style={{ width: `${(strength.score / 4) * 100}%` }}
              />
            </div>
            {strengthMeta.label && (
              <span
                className={`text-[11px] font-semibold whitespace-nowrap ${
                  strength.valid ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {strengthMeta.label}
              </span>
            )}
          </div>
          {showStrengthHint && !strength.valid && (
            <p className="text-[11px] text-gray-400 mt-1">{strength.errors[0]}</p>
          )}
        </div>
      )}
    </div>
  );
}
