'use client';

import { cn } from '@/lib/utils';

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M3 11h26M11 3v26" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <path
        d="M9 23V13h6.5a3 3 0 0 1 0 6H12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="21" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Brand({
  className,
  size = 28,
  showText = true,
}: {
  className?: string;
  size?: number;
  showText?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 text-primary', className)}>
      <Logo size={size} />
      {showText && (
        <span
          className="font-bold tracking-tight"
          style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.62 }}
        >
          Open<span className="text-cyan">Blueprint</span>
        </span>
      )}
    </div>
  );
}
