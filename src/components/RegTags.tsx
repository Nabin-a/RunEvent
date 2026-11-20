import React from 'react';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import { IconAlert, IconCheckCircle, IconClose } from './Icons';

/**
 * Price / availability tags for the registration wizard.
 * Availability uses colour AND an icon + words, never colour alone:
 *   ok   (> 20% left)  green  "ว่าง 47 ที่"
 *   low  (<= 20% left) amber  "เหลือ 4 ที่"
 *   full (0 left)      red    "เต็มแล้ว"
 */
export const LOW_STOCK_RATIO = 0.2;

export type SeatLevel = 'ok' | 'low' | 'full';

export function seatLevel(left: number, total: number): SeatLevel {
  if (left <= 0) return 'full';
  if (total > 0 && left / total <= LOW_STOCK_RATIO) return 'low';
  return 'ok';
}

export const PriceTag: React.FC<{ satang: number; prefix?: string; onDark?: boolean }> = ({
  satang,
  prefix = '',
  onDark = false,
}) => (
  <span className={`reg-tag ${onDark ? 'reg-tag-on-dark' : 'reg-tag-price'}`}>
    {prefix}
    {formatThb(satang, true)}
  </span>
);

export const SeatTag: React.FC<{ left: number; total: number; unit: string }> = ({ left, total, unit }) => {
  const level = seatLevel(left, total);
  return (
    <span className={`reg-tag reg-tag-${level}`}>
      {level === 'full' ? <IconClose size={12} /> : level === 'low' ? <IconAlert size={12} /> : <IconCheckCircle size={12} />}
      {level === 'full'
        ? tx('เต็มแล้ว')
        : level === 'low'
          ? txf('เหลือ {0} {1}', left, tx(unit))
          : txf('ว่าง {0} {1}', left, tx(unit))}
    </span>
  );
};

export const NoteTag: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'ok' }> = ({
  children,
  tone = 'neutral',
}) => <span className={`reg-tag reg-tag-${tone === 'ok' ? 'ok' : 'neutral'}`}>{children}</span>;
