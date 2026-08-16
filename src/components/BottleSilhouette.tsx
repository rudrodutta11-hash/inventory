import { useEffect, useRef, useState } from 'react';
import type { Bottle, Category } from '../db';
import { fillFraction } from '../lib/format';

/**
 * The signature element. An SVG bottle — shoulder, neck, cap — with the
 * liquid as a rect clipped to the body path. Liquid colour is the only
 * warm colour in the interface.
 *
 * Bottles are not all the same shape: each category draws from a pool of
 * profiles (a bourbon is stout, a gin is tall, a brandy slopes) and the
 * serial picks deterministically within the pool, so every bottle keeps
 * the same silhouette forever without storing anything.
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

interface Shape {
  path: string;      // symmetric about x=30, viewBox 0 0 60 140
  top: number;       // liquid ceiling, inside the neck
  bottom: number;    // liquid floor
  neckEnd: number;   // y where the neck meets the shoulder
  shoulder: number;  // y where the shoulder meets the full-width body
  neckRx: number;    // meniscus half-width in the neck
  bodyRx: number;    // meniscus half-width in the body
  capX: number;      // cap geometry for sealed bottles
  capW: number;
}

const CLASSIC: Shape = {
  path: 'M24 16 L36 16 L36 42 C36 50 52 52 52 64 L52 128 Q52 134 46 134 L14 134 Q8 134 8 128 L8 64 C8 52 24 50 24 42 Z',
  top: 24, bottom: 132, neckEnd: 42, shoulder: 64, neckRx: 5.5, bodyRx: 21, capX: 22, capW: 16,
};

const TALL: Shape = {
  path: 'M24 12 L36 12 L36 40 C36 48 48 50 48 60 L48 129 Q48 134 43 134 L17 134 Q12 134 12 129 L12 60 C12 50 24 48 24 40 Z',
  top: 20, bottom: 132, neckEnd: 40, shoulder: 60, neckRx: 5.5, bodyRx: 17, capX: 22, capW: 16,
};

const STOUT: Shape = {
  path: 'M23 22 L37 22 L37 46 C37 54 54 56 54 70 L54 127 Q54 134 47 134 L13 134 Q6 134 6 127 L6 70 C6 56 23 54 23 46 Z',
  top: 30, bottom: 132, neckEnd: 46, shoulder: 70, neckRx: 6.5, bodyRx: 23, capX: 21, capW: 18,
};

const DECANTER: Shape = {
  path: 'M24 18 L36 18 L36 44 L50 52 L50 130 Q50 134 46 134 L14 134 Q10 134 10 130 L10 52 L24 44 Z',
  top: 26, bottom: 132, neckEnd: 44, shoulder: 52, neckRx: 5.5, bodyRx: 19, capX: 22, capW: 16,
};

const SLOPED: Shape = {
  path: 'M25 12 L35 12 L35 34 C35 54 50 68 50 90 L50 128 Q50 134 45 134 L15 134 Q10 134 10 128 L10 90 C10 68 25 54 25 34 Z',
  top: 20, bottom: 132, neckEnd: 34, shoulder: 90, neckRx: 4.5, bodyRx: 19, capX: 23, capW: 14,
};

const SHAPE_POOLS: Record<Category, Shape[]> = {
  single_malt: [CLASSIC, TALL],
  blended_scotch: [CLASSIC],
  irish: [CLASSIC, STOUT],
  japanese: [TALL, DECANTER],
  bourbon: [STOUT, DECANTER],
  rye: [DECANTER, STOUT],
  rum: [STOUT, SLOPED],
  gin: [TALL, STOUT],
  vodka: [TALL],
  tequila: [DECANTER, STOUT],
  brandy: [SLOPED],
  liqueur: [SLOPED, DECANTER],
  other: [CLASSIC, TALL, STOUT],
};

export function shapeFor(bottle: Bottle): Shape {
  const pool = SHAPE_POOLS[bottle.category];
  const n = parseInt(bottle.serial, 10);
  return pool[(Number.isFinite(n) ? n : 0) % pool.length];
}

function meniscusRx(shape: Shape, levelY: number): number {
  if (levelY <= shape.neckEnd) return shape.neckRx;
  if (levelY >= shape.shoulder) return shape.bodyRx;
  const t = (levelY - shape.neckEnd) / (shape.shoulder - shape.neckEnd);
  return shape.neckRx + (shape.bodyRx - shape.neckRx) * (t * t * (3 - 2 * t));
}

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

  const shape = shapeFor(bottle);
  const levelY = shape.bottom - frac * (shape.bottom - shape.top);
  const rx = meniscusRx(shape, levelY);

  const clipId = useRef(`bclip-${++clipSeq}`).current;
  const spirit = SPIRIT_VAR[bottle.category];

  // premium cues come from the bottle's own record, not a brand list:
  // a long age statement wears a double collar, cask strength a wax cap
  const aged = (bottle.ageStatement ?? 0) >= 15;
  const wax = bottle.caskStrength === true;

  // wobble the meniscus once per level change
  const [wobbleKey, setWobbleKey] = useState(0);
  const prevLevel = useRef(frac);
  useEffect(() => {
    if (animate && prevLevel.current !== frac) setWobbleKey((k) => k + 1);
    prevLevel.current = frac;
  }, [frac, animate]);

  const height = Math.round((width * 140) / 60);
  const capY = shape.path.match(/M\d+ (\d+)/);
  const neckTop = capY ? parseInt(capY[1], 10) : 16;

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
          <path d={shape.path} />
        </clipPath>
      </defs>

      {/* liquid */}
      {!finished && frac > 0 && (
        <g clipPath={`url(#${clipId})`}>
          <rect className="bottle-liquid" x="4" y={levelY} width="52" height={shape.bottom - levelY + 4} fill={spirit} />
          <ellipse
            key={wobbleKey}
            className={wobbleKey > 0 ? 'bottle-meniscus bottle-meniscus--wobble' : 'bottle-meniscus'}
            cx="30"
            cy={levelY}
            rx={rx}
            ry="2.2"
            fill={spirit}
            stroke={low ? 'var(--stencil)' : 'none'}
            strokeWidth={low ? 1.5 : 0}
          />
        </g>
      )}

      {/* glass outline */}
      <path
        d={shape.path}
        fill="none"
        stroke={finished ? 'var(--glass)' : 'var(--ink-soft)'}
        strokeWidth="1.5"
      />

      {/* age >= 18: a double collar band at the neck */}
      {aged && !finished && (
        <>
          <line x1={30 - shape.neckRx - 1.5} y1={shape.neckEnd - 8} x2={30 + shape.neckRx + 1.5} y2={shape.neckEnd - 8} stroke="var(--ink-soft)" strokeWidth="1.5" />
          <line x1={30 - shape.neckRx - 1.5} y1={shape.neckEnd - 4} x2={30 + shape.neckRx + 1.5} y2={shape.neckEnd - 4} stroke="var(--ink-soft)" strokeWidth="1" />
        </>
      )}

      {/* sealed: cap (wax-dipped in stencil for cask strength) + edge highlight */}
      {sealed && (
        <>
          <rect x={shape.capX} y={neckTop - 7} width={shape.capW} height="9" fill={wax ? 'var(--stencil)' : 'var(--ink)'} />
          {wax && (
            <rect x={shape.capX + 1} y={neckTop + 2} width={shape.capW - 2} height="4" fill="var(--stencil)" opacity="0.8" />
          )}
          <line x1={30 - shape.bodyRx + 2} y1={shape.shoulder + 2} x2={30 - shape.bodyRx + 2} y2={shape.bottom - 6} stroke="var(--card)" strokeWidth="1.5" opacity="0.8" />
        </>
      )}

      {/* open cask strength still shows its wax collar */}
      {!sealed && !finished && wax && (
        <rect x={shape.capX + 2} y={neckTop} width={shape.capW - 4} height="4" fill="var(--stencil)" opacity="0.9" />
      )}

      {/* under 15%: a thin stencilled rule at the shoulder */}
      {low && (
        <line x1={30 - shape.bodyRx - 2} y1={shape.shoulder} x2={30 + shape.bodyRx + 2} y2={shape.shoulder} stroke="var(--stencil)" strokeWidth="1" strokeDasharray="3 3" />
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
