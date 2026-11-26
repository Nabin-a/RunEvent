import React from 'react';
import { tx, txf } from '../i18n';
import { IconAlert, IconCheckCircle } from './Icons';

interface MeterProps {
  pct: number;
  completedCount: number;
  total: number;
  /** Accessible name, e.g. "ความครบถ้วนของข้อมูลส่วนตัว". */
  label: string;
}

const clampPct = (pct: number) => Math.min(100, Math.max(0, Math.round(pct)));

const valueText = (completedCount: number, total: number, pct: number) =>
  txf('ครบ {0} จาก {1} รายการ ({2}%)', completedCount, total, pct);

/** Horizontal progress bar (amber while incomplete, forest once complete). */
export const ProfileCompletionBar: React.FC<MeterProps> = ({
  pct,
  completedCount,
  total,
  label,
}) => {
  const value = clampPct(pct);
  const done = completedCount >= total;
  return (
    <div
      className={`completion-meter-bar ${done ? 'is-complete' : 'is-incomplete'}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={valueText(completedCount, total, value)}
    >
      <div
        className="completion-meter-bar-fill"
        style={{ transform: `scaleX(${value / 100})` }}
      />
    </div>
  );
};

/**
 * Circular (pie) progress ring with the percentage in the centre. `tone` picks the colour
 * (red under 50 %, amber to 84 %, green from 85 %; see completionTone).
 */
export const ProfileCompletionRing: React.FC<
  MeterProps & { size?: number; decorative?: boolean; tone?: 'low' | 'mid' | 'high' }
> = ({ pct, completedCount, total, label, size = 48, decorative = false, tone }) => {
  const value = clampPct(pct);
  const done = completedCount >= total;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': value,
        'aria-valuetext': valueText(completedCount, total, value),
      };
  return (
    <span
      className={`completion-ring ${done ? 'is-complete' : 'is-incomplete'} ${tone ? `tone-${tone}` : ''}`}
      style={{ width: size, height: size }}
      {...a11y}
    >
      <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true">
        <circle className="completion-ring-track" cx="22" cy="22" r={radius} />
        <circle
          className="completion-ring-fill"
          cx="22"
          cy="22"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="completion-ring-center">
        {done && !tone ? (
          <IconCheckCircle size={Math.round(size * 0.42)} />
        ) : (
          <span className="completion-ring-pct">
            {value}
            <small>%</small>
          </span>
        )}
      </span>
    </span>
  );
};

/** Icon + text status line used in compact places (profile dropdown). */
export const ProfileCompletionStatusText: React.FC<{
  isComplete: boolean;
  pct: number;
}> = ({ isComplete, pct }) =>
  isComplete ? (
    <>
      <IconCheckCircle size={16} />
      <span>{tx('โปรไฟล์ครบถ้วน')}</span>
    </>
  ) : (
    <>
      <IconAlert size={16} />
      <span>{txf('โปรไฟล์ยังไม่ครบ ({0}%)', clampPct(pct))}</span>
    </>
  );
