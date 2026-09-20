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
          <Link href="/auth/register" className="btn-gold text-sm px-4 py-2">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
