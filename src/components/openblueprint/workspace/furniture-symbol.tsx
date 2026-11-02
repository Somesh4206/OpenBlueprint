'use client';

import { FurnitureType } from '@/lib/types';

// Top-down architectural furniture symbols (SVG), rendered inside the 2D canvas.
// Each symbol is drawn in a 100×100 viewBox and scaled to the furniture's width×length.
export function FurnitureSymbol({
  type,
  color,
  className,
}: {
  type: FurnitureType;
  color: string;
  className?: string;
}) {
  const stroke = darken(color, 0.4);
  const fill = color;
  const accent = darken(color, 0.25);
  const glass = 'rgba(150,200,255,0.35)';

  const common = { stroke, strokeWidth: 1.5, fill };

  switch (type) {
    // ---- Beds ----
    case 'bed-single':
    case 'bed-double':
    case 'bed-king':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="2" y="2" width="96" height="96" rx="3" {...common} />
          <rect x="2" y="2" width="96" height="20" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="8" y="26" width="40" height="22" rx="3" fill="#fff" stroke={stroke} strokeWidth="1" opacity="0.85" />
          <rect x="52" y="26" width="40" height="22" rx="3" fill="#fff" stroke={stroke} strokeWidth="1" opacity="0.85" />
          <line x1="50" y1="50" x2="50" y2="98" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
        </svg>
      );
    case 'sofa-2':
    case 'sofa-3':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="2" y="30" width="96" height="68" rx="5" {...common} />
          <rect x="2" y="2" width="96" height="32" rx="5" fill={accent} stroke={stroke} strokeWidth="1.5" />
          <rect x="6" y="36" width="26" height="58" rx="3" fill="#fff" stroke={stroke} strokeWidth="0.8" opacity="0.5" />
          <rect x="37" y="36" width="26" height="58" rx="3" fill="#fff" stroke={stroke} strokeWidth="0.8" opacity="0.5" />
          <rect x="68" y="36" width="26" height="58" rx="3" fill="#fff" stroke={stroke} strokeWidth="0.8" opacity="0.5" />
        </svg>
      );
    case 'sofa-l':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <path d="M2 2 L98 2 L98 60 L40 60 L40 98 L2 98 Z" {...common} />
          <rect x="2" y="2" width="96" height="14" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="2" y="60" width="14" height="38" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="20" y="20" width="76" height="36" rx="2" fill="#fff" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
          <rect x="20" y="62" width="18" height="34" rx="2" fill="#fff" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
        </svg>
      );
    case 'armchair':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="10" y="35" width="80" height="63" rx="6" {...common} />
          <rect x="10" y="2" width="80" height="35" rx="6" fill={accent} stroke={stroke} strokeWidth="1.5" />
          <rect x="16" y="40" width="68" height="54" rx="3" fill="#fff" stroke={stroke} strokeWidth="0.8" opacity="0.5" />
        </svg>
      );
    // ---- Chairs ----
    case 'chair-dining':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="20" y="30" width="60" height="50" rx="3" {...common} />
          <rect x="20" y="5" width="60" height="28" rx="3" fill={accent} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'chair-office':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <circle cx="50" cy="60" r="32" {...common} />
          <rect x="20" y="20" width="60" height="30" rx="4" fill={accent} stroke={stroke} strokeWidth="1.5" />
          <line x1="50" y1="92" x2="50" y2="80" stroke={stroke} strokeWidth="2" />
          <line x1="20" y1="98" x2="80" y2="98" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'bar-stool':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <circle cx="50" cy="35" r="30" {...common} />
          <rect x="47" y="40" width="6" height="55" fill={stroke} />
          <ellipse cx="50" cy="95" rx="22" ry="4" fill="none" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    // ---- Tables ----
    case 'table-round':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <circle cx="50" cy="50" r="46" {...common} />
          <circle cx="50" cy="50" r="8" fill={accent} stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case 'table-rect':
    case 'table-coffee':
    case 'table-dining-6':
    case 'meeting-table':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="4" width="92" height="92" rx="4" {...common} />
          <rect x="10" y="10" width="80" height="80" rx="2" fill="none" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
        </svg>
      );
    case 'desk':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="4" width="92" height="92" rx="3" {...common} />
          <rect x="4" y="50" width="35" height="46" fill={accent} stroke={stroke} strokeWidth="1" />
          <line x1="4" y1="70" x2="39" y2="70" stroke={stroke} strokeWidth="0.8" />
          <circle cx="22" cy="84" r="2" fill={stroke} />
        </svg>
      );
    // ---- Storage ----
    case 'wardrobe':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="2" y="2" width="96" height="96" rx="2" {...common} />
          <line x1="50" y1="2" x2="50" y2="98" stroke={stroke} strokeWidth="1.5" />
          <line x1="2" y1="20" x2="98" y2="20" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
          <line x1="2" y1="40" x2="98" y2="40" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
          <line x1="2" y1="60" x2="98" y2="60" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
          <line x1="2" y1="80" x2="98" y2="80" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
          <circle cx="45" cy="50" r="1.5" fill={stroke} />
          <circle cx="55" cy="50" r="1.5" fill={stroke} />
        </svg>
      );
    case 'bookshelf':
    case 'shelf-wall':
    case 'display-shelf':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="2" y="2" width="96" height="96" rx="2" {...common} />
          <line x1="2" y1="25" x2="98" y2="25" stroke={stroke} strokeWidth="1" />
          <line x1="2" y1="50" x2="98" y2="50" stroke={stroke} strokeWidth="1" />
          <line x1="2" y1="75" x2="98" y2="75" stroke={stroke} strokeWidth="1" />
          <rect x="10" y="55" width="14" height="18" fill={accent} opacity="0.6" />
          <rect x="30" y="30" width="10" height="18" fill={accent} opacity="0.6" />
          <rect x="60" y="55" width="18" height="18" fill={accent} opacity="0.6" />
        </svg>
      );
    case 'tv-unit':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="2" y="20" width="96" height="78" rx="2" {...common} />
          <line x1="33" y1="20" x2="33" y2="98" stroke={stroke} strokeWidth="0.8" />
          <line x1="66" y1="20" x2="66" y2="98" stroke={stroke} strokeWidth="0.8" />
        </svg>
      );
    case 'tv-wall':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="5" y="30" width="90" height="50" rx="3" fill="#1a1a1a" stroke={stroke} strokeWidth="1.5" />
          <rect x="10" y="35" width="80" height="40" fill="#0a0a2a" opacity="0.6" />
          <rect x="45" y="80" width="10" height="18" fill={accent} />
        </svg>
      );
    // ---- Kitchen ----
    case 'kitchen-counter':
    case 'service-counter':
    case 'reception-desk':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="2" y="2" width="96" height="96" rx="2" {...common} />
          <rect x="2" y="2" width="96" height="22" fill={accent} stroke={stroke} strokeWidth="1" />
          <line x1="25" y1="2" x2="25" y2="98" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
          <line x1="50" y1="2" x2="50" y2="98" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
          <line x1="75" y1="2" x2="75" y2="98" stroke={stroke} strokeWidth="0.6" opacity="0.4" />
        </svg>
      );
    case 'kitchen-island':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="8" y="8" width="84" height="84" rx="3" {...common} />
          <rect x="2" y="2" width="96" height="96" rx="3" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );
    case 'stove':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="4" width="92" height="92" rx="2" {...common} />
          <circle cx="30" cy="30" r="14" fill="none" stroke={stroke} strokeWidth="2" />
          <circle cx="70" cy="30" r="14" fill="none" stroke={stroke} strokeWidth="2" />
          <circle cx="30" cy="70" r="14" fill="none" stroke={stroke} strokeWidth="2" />
          <circle cx="70" cy="70" r="14" fill="none" stroke={stroke} strokeWidth="2" />
          <circle cx="30" cy="30" r="5" fill={accent} />
          <circle cx="70" cy="30" r="5" fill={accent} />
          <circle cx="30" cy="70" r="5" fill={accent} />
          <circle cx="70" cy="70" r="5" fill={accent} />
        </svg>
      );
    case 'sink-kitchen':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="4" width="92" height="92" rx="2" {...common} />
          <rect x="18" y="18" width="64" height="50" rx="3" fill="#e8eef5" stroke={stroke} strokeWidth="1" />
          <line x1="50" y1="6" x2="50" y2="18" stroke={stroke} strokeWidth="2" />
          <circle cx="50" cy="6" r="4" fill={accent} stroke={stroke} strokeWidth="1" />
          <circle cx="50" cy="4" r="1.5" fill={stroke} />
        </svg>
      );
    case 'fridge':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="8" y="2" width="84" height="96" rx="3" {...common} />
          <line x1="8" y1="35" x2="92" y2="35" stroke={stroke} strokeWidth="1.5" />
          <rect x="84" y="12" width="3" height="18" fill={stroke} />
          <rect x="84" y="45" width="3" height="40" fill={stroke} />
        </svg>
      );
    // ---- Bathroom ----
    case 'toilet':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="25" y="2" width="50" height="30" rx="2" {...common} />
          <ellipse cx="50" cy="65" rx="38" ry="32" {...common} />
          <ellipse cx="50" cy="65" rx="26" ry="22" fill="#fff" stroke={stroke} strokeWidth="1" opacity="0.6" />
        </svg>
      );
    case 'bathtub':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="10" width="92" height="80" rx="18" {...common} />
          <rect x="12" y="18" width="76" height="64" rx="12" fill="#e8eef5" stroke={stroke} strokeWidth="1" />
          <circle cx="20" cy="50" r="3" fill={accent} stroke={stroke} strokeWidth="0.8" />
        </svg>
      );
    case 'shower':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="4" width="92" height="92" rx="2" fill={glass} stroke={stroke} strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx="50" cy="50" r="8" fill={accent} stroke={stroke} strokeWidth="1" />
          <line x1="50" y1="58" x2="50" y2="90" stroke={stroke} strokeWidth="1" opacity="0.4" />
          <line x1="42" y1="65" x2="58" y2="65" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
          <line x1="42" y1="75" x2="58" y2="75" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
        </svg>
      );
    case 'vanity':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="40" width="92" height="56" rx="2" {...common} />
          <ellipse cx="50" cy="28" rx="32" ry="18" fill="#e8eef5" stroke={stroke} strokeWidth="1.5" />
          <ellipse cx="50" cy="28" rx="22" ry="12" fill="#fff" stroke={stroke} strokeWidth="0.8" opacity="0.6" />
          <line x1="50" y1="6" x2="50" y2="16" stroke={stroke} strokeWidth="2" />
          <circle cx="50" cy="6" r="3" fill={accent} />
        </svg>
      );
    case 'washer':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="6" y="2" width="88" height="96" rx="3" {...common} />
          <circle cx="50" cy="58" r="34" fill="#e8eef5" stroke={stroke} strokeWidth="1.5" />
          <circle cx="50" cy="58" r="24" fill="#fff" stroke={stroke} strokeWidth="1" opacity="0.6" />
          <circle cx="20" cy="14" r="3" fill={accent} />
          <circle cx="30" cy="14" r="3" fill={accent} />
        </svg>
      );
    // ---- Decor ----
    case 'plant-small':
    case 'plant-large':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <path d="M30 75 L70 75 L62 98 L38 98 Z" fill={accent} stroke={stroke} strokeWidth="1.5" />
          <circle cx="50" cy="40" r="32" fill={color} stroke={darken(color, 0.3)} strokeWidth="1.5" />
          <circle cx="35" cy="35" r="14" fill={lighten(color, 0.1)} opacity="0.7" />
          <circle cx="65" cy="38" r="12" fill={lighten(color, 0.15)} opacity="0.7" />
          <circle cx="50" cy="25" r="11" fill={lighten(color, 0.2)} opacity="0.7" />
        </svg>
      );
    case 'rug':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="2" y="2" width="96" height="96" rx="2" fill={color} stroke={darken(color, 0.3)} strokeWidth="1" opacity="0.55" />
          <rect x="10" y="10" width="80" height="80" rx="1" fill="none" stroke={darken(color, 0.2)} strokeWidth="0.8" opacity="0.6" />
          <rect x="18" y="18" width="64" height="64" rx="1" fill="none" stroke={darken(color, 0.2)} strokeWidth="0.6" opacity="0.5" />
        </svg>
      );
    case 'lamp-floor':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <ellipse cx="50" cy="95" rx="20" ry="4" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="48" y="30" width="4" height="65" fill={stroke} />
          <path d="M30 8 L70 8 L62 32 L38 32 Z" fill={color} stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case 'pooja-altar':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="40" width="92" height="56" rx="2" {...common} />
          <path d="M20 40 Q50 10 80 40 Z" fill={accent} stroke={stroke} strokeWidth="1.5" />
          <circle cx="50" cy="30" r="6" fill="#d4a019" stroke={stroke} strokeWidth="1" />
          <line x1="20" y1="60" x2="80" y2="60" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
          <line x1="20" y1="80" x2="80" y2="80" stroke={stroke} strokeWidth="0.8" opacity="0.4" />
        </svg>
      );
    // ---- Composed sets ----
    case 'dining-set-4':
    case 'dining-set-6':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="25" y="25" width="50" height="50" rx="3" {...common} />
          <rect x="35" y="5" width="30" height="16" rx="2" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="35" y="79" width="30" height="16" rx="2" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="5" y="40" width="16" height="20" rx="2" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="79" y="40" width="16" height="20" rx="2" fill={accent} stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case 'office-cabin':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="5" y="10" width="60" height="30" rx="2" {...common} />
          <rect x="25" y="45" width="20" height="20" rx="2" fill={accent} stroke={stroke} strokeWidth="1" />
          <rect x="70" y="5" width="6" height="90" fill={accent} stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case 'clothing-rack':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="10" y="10" width="4" height="85" fill={stroke} />
          <rect x="86" y="10" width="4" height="85" fill={stroke} />
          <rect x="10" y="20" width="80" height="4" fill={stroke} />
          <path d="M25 24 L25 50 L21 54 L29 54 L25 50 Z" fill={accent} stroke={stroke} strokeWidth="0.8" />
          <path d="M45 24 L45 55 L41 59 L49 59 L45 55 Z" fill={accent} stroke={stroke} strokeWidth="0.8" />
          <path d="M65 24 L65 48 L61 52 L69 52 L65 48 Z" fill={accent} stroke={stroke} strokeWidth="0.8" />
        </svg>
      );
    case 'car':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          {/* Car body — top-down sedan */}
          <rect x="15" y="10" width="70" height="80" rx="14" fill={color} stroke={darken(color, 0.4)} strokeWidth="1.5" />
          {/* Roof / cabin */}
          <rect x="22" y="28" width="56" height="38" rx="6" fill={darken(color, 0.2)} stroke={darken(color, 0.5)} strokeWidth="1" />
          {/* Windshield front */}
          <path d="M22 28 L78 28 L72 22 L28 22 Z" fill="#9ec5ff" opacity="0.6" />
          {/* Windshield rear */}
          <path d="M22 66 L78 66 L72 72 L28 72 Z" fill="#9ec5ff" opacity="0.6" />
          {/* Hood line */}
          <line x1="22" y1="24" x2="78" y2="24" stroke={darken(color, 0.4)} strokeWidth="0.8" />
          {/* Wheels */}
          <rect x="8" y="22" width="8" height="14" rx="2" fill="#1a1a1a" />
          <rect x="84" y="22" width="8" height="14" rx="2" fill="#1a1a1a" />
          <rect x="8" y="64" width="8" height="14" rx="2" fill="#1a1a1a" />
          <rect x="84" y="64" width="8" height="14" rx="2" fill="#1a1a1a" />
          {/* Side mirrors */}
          <rect x="20" y="30" width="4" height="3" fill={darken(color, 0.3)} />
          <rect x="76" y="30" width="4" height="3" fill={darken(color, 0.3)} />
        </svg>
      );
    case 'bike':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          {/* Bike — top-down motorcycle */}
          <rect x="35" y="10" width="30" height="80" rx="8" fill={color} stroke={darken(color, 0.4)} strokeWidth="1.5" />
          {/* Seat */}
          <rect x="38" y="14" width="24" height="10" rx="3" fill="#3a2a1a" />
          {/* Fuel tank */}
          <rect x="36" y="30" width="28" height="20" rx="5" fill={accent} stroke={darken(color, 0.4)} strokeWidth="0.8" />
          {/* Engine */}
          <rect x="40" y="52" width="20" height="14" rx="2" fill={darken(color, 0.3)} />
          {/* Handlebar */}
          <rect x="28" y="76" width="44" height="4" rx="2" fill="#2a2a2a" />
          {/* Front wheel */}
          <rect x="42" y="80" width="16" height="12" rx="2" fill="#1a1a1a" />
          {/* Headlight */}
          <circle cx="50" cy="84" r="3" fill="#ffe08a" stroke={darken(color, 0.4)} strokeWidth="0.5" />
        </svg>
      );
    case 'staircase':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          {/* Staircase — steps + UP arrow, no walls */}
          {Array.from({ length: 8 }, (_, i) => {
            const stepY = 10 + i * 9;
            return <line key={i} x1={5} y1={stepY} x2={95} y2={stepY} stroke={stroke} strokeWidth={1.5} opacity={0.7} />;
          })}
          {/* UP arrow */}
          <path d="M 50 88 L 50 12 M 42 22 L 50 12 L 58 22" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
          <text x="50" y="96" textAnchor="middle" fontSize={7} fill={accent} fontWeight={700}>UP</text>
        </svg>
      );
    case 'spiral-staircase':
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          {/* Spiral staircase — concentric arcs + central column */}
          <circle cx="50" cy="50" r="45" fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.4} />
          <circle cx="50" cy="50" r="35" fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.5} />
          <circle cx="50" cy="50" r="25" fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.6} />
          <circle cx="50" cy="50" r="15" fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.7} />
          {/* Radial step lines */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const x2 = 50 + 45 * Math.cos(angle);
            const y2 = 50 + 45 * Math.sin(angle);
            return <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke={stroke} strokeWidth={1} opacity={0.5} />;
          })}
          {/* Central column */}
          <circle cx="50" cy="50" r="4" fill={accent} stroke={stroke} strokeWidth="1" />
          {/* UP arrow */}
          <path d="M 50 88 L 50 12 M 42 22 L 50 12 L 58 22" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
          <text x="50" y="96" textAnchor="middle" fontSize={7} fill={accent} fontWeight={700}>UP</text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" className={className} preserveAspectRatio="none">
          <rect x="4" y="4" width="92" height="92" rx="3" {...common} />
          <line x1="4" y1="4" x2="96" y2="96" stroke={stroke} strokeWidth="0.8" opacity="0.3" />
          <line x1="96" y1="4" x2="4" y2="96" stroke={stroke} strokeWidth="0.8" opacity="0.3" />
        </svg>
      );
  }
}

// Color utilities
function darken(hex: string, amount: number): string {
  const { r, g, b } = parse(hex);
  return rgbToHex(Math.round(r * (1 - amount)), Math.round(g * (1 - amount)), Math.round(b * (1 - amount)));
}
function lighten(hex: string, amount: number): string {
  const { r, g, b } = parse(hex);
  return rgbToHex(
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  );
}
function parse(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
