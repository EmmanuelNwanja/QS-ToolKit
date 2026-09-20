import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/gifting', label: 'Gift a Subscription' },
];

/**
 * Public marketing navbar - used on standalone public pages (e.g. /gifting).
 * Sticky (not fixed) so pages need no top-padding compensation.
 */
export default function PublicNav() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-primary-900 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img src="/qs-toolkit-logo.png" alt="QSToolkit" className="h-12 w-auto max-w-[180px]" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4">
            {LINKS.map((l) => {
              const active = router.pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm transition-colors ${active ? 'text-gold-400 font-semibold' : 'text-white/60 hover:text-white'}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
          <Link href="/auth/login" className="text-sm text-white/80 hover:text-white px-3 py-1.5 hidden sm:inline transition-colors">
            Sign In
          </Link>
          <Link href="/auth/register" className="btn-gold text-sm px-4 py-2 hidden sm:inline-flex">
            Get Started
          </Link>
          <button
            className="md:hidden text-white p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-primary-900">
          <div className="px-4 py-4 space-y-2">
            {LINKS.map((l) => {
              const active = router.pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block py-3 px-4 rounded-lg text-base transition-colors min-h-[44px] flex items-center ${active ? 'text-gold-400 font-semibold bg-white/5' : 'text-white/80 hover:bg-white/5'}`}
                >
                  {l.label}
                </Link>
              );
            })}
            <div className="border-t border-white/10 pt-3 mt-3 space-y-2">
              <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="block py-3 px-4 rounded-lg text-base text-white/80 hover:bg-white/5 min-h-[44px] flex items-center">
                Sign In
              </Link>
              <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="btn-gold text-center py-3 px-4 text-base min-h-[44px] flex items-center justify-center">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
