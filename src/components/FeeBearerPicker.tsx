/**
 * Who pays the platform fee — moved from the old event overview to
 * "ระยะ ราคา และการรับสมัคร" (approved mockup, 24 Nov 2026).
 * Three options, each with the real split of one current price so the organizer
 * sees the effect before choosing. Applies to new registrations only.
 */
import React, { useId } from 'react';
import type { FeeBearerPolicy, RaceEvent } from '../types';
import { calculateFeeQuote, formatThb, getCurrentTier } from '../utils/pricing';
import { tx, txf } from '../i18n';
import '../event-home.css';

const OPTIONS: { value: FeeBearerPolicy; label: string }[] = [
  { value: 'runner_pays', label: 'นักวิ่งจ่าย' },
  { value: 'organizer_absorbs', label: 'ผู้จัดจ่าย' },
  { value: 'split_50_50', label: 'คนละครึ่ง' },
];

export const FeeBearerPicker: React.FC<{
  event: RaceEvent;
  canEdit: boolean;
  onChange: (policy: FeeBearerPolicy) => void;
}> = ({ event, canEdit, onChange }) => {
  const name = useId();
  const cat = event.categories[0];
  const tier = cat ? getCurrentTier(cat) : undefined;
  const base = tier?.priceSatang ?? 0;

  return (
    <section className="clean-panel fee-picker" aria-labelledby={`${name}-h`}>
      <div className="section-title-bar">
        <h2 id={`${name}-h`}>{tx('ใครจ่ายค่าบริการระบบ')}</h2>
      </div>
      <p className="page-purpose-desc">
        {cat
          ? txf('ตัวอย่างจากราคา {0} {1} · มีผลกับใบสมัครใหม่เท่านั้น', tx(cat.name), formatThb(base))
          : tx('มีผลกับใบสมัครใหม่เท่านั้น')}
      </p>
      <div className="fee-picker-legend" aria-hidden="true">
        <span>
          <i className="fee-sw fee-sw-org" />
          {tx('ผู้จัดได้รับ')}
        </span>
        <span>
          <i className="fee-sw fee-sw-fee" />
          {tx('ค่าบริการระบบ (อัตราสมมติ 5% + ฿15)')}
        </span>
      </div>
      <div className="fee-picker-options" role="radiogroup" aria-labelledby={`${name}-h`}>
        {OPTIONS.map((o) => {
          const q = calculateFeeQuote(base, o.value);
          const total = Math.max(q.runnerNetPaySatang, 1);
          const checked = event.feeBearerPolicy === o.value;
          return (
            <label key={o.value} className={`fee-option${checked ? ' is-checked' : ''}`}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={!canEdit}
                onChange={() => onChange(o.value)}
              />
              <span className="fee-option-title">{tx(o.label)}</span>
              {base > 0 && (
                <>
                  <span className="fee-bar" aria-hidden="true">
                    <span
                      className="fee-bar-org"
                      style={{ width: `${(q.organizerNetReceiveSatang / total) * 100}%` }}
                    />
                    <span
                      className="fee-bar-fee"
                      style={{ width: `${(q.platformFeeSatang / total) * 100}%` }}
                    />
                  </span>
                  <span className="fee-option-numbers">
                    {txf(
                      'นักวิ่งจ่าย {0} · ผู้จัดได้ {1}',
                      formatThb(q.runnerNetPaySatang, true),
                      formatThb(q.organizerNetReceiveSatang, true)
                    )}
                  </span>
                </>
              )}
            </label>
          );
        })}
      </div>
      {!canEdit && (
        <p className="muted-inline">{tx('บทบาทของคุณดูได้อย่างเดียว เปลี่ยนได้เฉพาะเจ้าขององค์กรและผู้จัดการงาน')}</p>
      )}
    </section>
  );
};
