import { useEffect, useRef, useState } from 'react';
import type { Bottle, Category } from '../db';
import { fillFraction } from '../lib/format';

/**
 * The signature element. An SVG bottle — shoulder, neck, cap — with the
 * liquid as a rect clipped to the body path. Liquid colour is the only
 * warm colour in the interface.
 */

const SPIRIT_VAR: Record<Category, string> = {
  single_malt: 'var(--spirit-gold)',
  blended_scotch: 'var(--spirit-gold)',
  irish: 'var(--spirit-gold)',
  japanese: 'var(--spirit-gold)',
  bourbon: 'var(--spirit-deep)',
  rye: 'var(--spirit-deep)',
  rum: 'var(--spirit-dark)',
  brandy: 'var(--spirit-dark)',
  liqueur: 'var(--spirit-dark)',
  gin: 'var(--spirit-pale)',
  vodka: 'var(--spirit-pale)',
  tequila: 'var(--spirit-pale)',
  other: 'var(--spirit-gold)',
};

// viewBox geometry
const TOP = 26;      // liquid ceiling (inside the neck)
const BOTTOM = 134;  // liquid floor
const SHOULDER = 62; // where the body meets the shoulder curve
const BODY_PATH =
  'M24 16 L36 16 L36 42 C36 50 52 52 52 64 L52 128 Q52 134 46 134 L14 134 Q8 134 8 128 L8 64 C8 52 24 50 24 42 Z';

let clipSeq = 0;

export interface SilhouetteProps {
  bottle: Bottle;
  width?: number;
  animate?: boolean;   // pour animation on level change
}

export function bottleAriaLabel(b: Bottle): string {
  if (b.status === 'finished') return `${b.name}, finished`;
  if (!b.isOpen) return `${b.name}, sealed`;
  const pct = Math.round(fillFraction(b.remainingMl, b.sizeMl) * 100);
  return `${b.name}, ${pct}% full, ${Math.round(b.remainingMl)} millilitres left`;
}

export default function BottleSilhouette({ bottle, width = 72, animate = false }: SilhouetteProps) {
  const finished = bottle.status === 'finished';
  const sealed = !finished && !bottle.isOpen;
  const frac = finished ? 0 : sealed ? 1 : fillFraction(bottle.remainingMl, bottle.sizeMl);
  const low = !finished && !sealed && frac < 0.15;

  const levelY = BOTTOM - frac * (BOTTOM - TOP);
  const inNeck = levelY < 50;
  const meniscusRx = inNeck ? 5.5 : levelY < SHOULDER ? 14 : 21;

  const clipId = useRef(`bclip-${++clipSeq}`).current;
  const spirit = SPIRIT_VAR[bottle.category];

  // wobble the meniscus once per level change
  const [wobbleKey, setWobbleKey] = useState(0);
  const prevLevel = useRef(frac);
  useEffect(() => {
    if (animate && prevLevel.current !== frac) setWobbleKey((k) => k + 1);
    prevLevel.current = frac;
  }, [frac, animate]);

  const height = Math.round((width * 140) / 60);

  return (
    <svg
      className={`bottle${animate ? ' bottle--animate' : ''}`}
      width={width}
      height={height}
      viewBox="0 0 60 140"
      role="img"
      aria-label={bottleAriaLabel(bottle)}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      {/* liquid */}
      {!finished && frac > 0 && (
        <g clipPath={`url(#${clipId})`}>
          <rect className="bottle-liquid" x="8" y={levelY} width="44" height={BOTTOM - levelY + 2} fill={spirit} />
          <ellipse
            key={wobbleKey}
            className={wobbleKey > 0 ? 'bottle-meniscus bottle-meniscus--wobble' : 'bottle-meniscus'}
            cx="30"
            cy={levelY}
            rx={meniscusRx}
            ry="2.2"
            fill={spirit}
            stroke={low ? 'var(--stencil)' : 'none'}
            strokeWidth={low ? 1.5 : 0}
          />
        </g>
      )}

      {/* glass outline */}
      <path
        d={BODY_PATH}
        fill="none"
        stroke={finished ? 'var(--glass)' : 'var(--ink-soft)'}
        strokeWidth="1.5"
      />

      {/* sealed: wax cap + hairline highlight down the left edge */}
      {sealed && (
        <>
          <rect x="22" y="9" width="16" height="9" fill="var(--ink)" />
          <line x1="12" y1="66" x2="12" y2="126" stroke="var(--card)" strokeWidth="1.5" opacity="0.8" />
        </>
      )}

      {/* under 15%: a thin stencilled rule at the shoulder */}
      {low && (
        <line x1="8" y1={SHOULDER} x2="52" y2={SHOULDER} stroke="var(--stencil)" strokeWidth="1" strokeDasharray="3 3" />
      )}

      {/* serial in the stencil face */}
      {!finished && (
        <text
          x="30"
          y="104"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize="20"
          fontWeight="700"
          fill={frac > 0.45 || sealed ? 'var(--paper)' : 'var(--ink-soft)'}
          opacity="0.9"
        >
          {bottle.serial}
        </text>
      )}
    </svg>
  );
}
