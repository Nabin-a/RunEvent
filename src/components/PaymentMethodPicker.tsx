import { useEffect } from 'react';
import { tx } from '../i18n';
import { IconCard, IconCheckCircle, IconQr } from './Icons';

export type PaymentChannel = 'promptpay' | 'card';

const METHODS: { id: PaymentChannel; title: string; sub: string; Icon: typeof IconQr }[] = [
  { id: 'promptpay', title: 'QR PromptPay', sub: 'สแกนจ่ายผ่านแอปธนาคาร', Icon: IconQr },
  { id: 'card', title: 'บัตรเครดิต / เดบิต', sub: 'Visa · Mastercard · JCB', Icon: IconCard },
];

/**
 * Methods kept out of sight for now (25 Nov 2026, user request "ซ่อนไว้ก่อน"): the card option is
 * hidden on every payment step (registration and storefront). Remove it from this list to bring
 * it back; the rest of the card flow is untouched.
 */
const HIDDEN_METHODS: PaymentChannel[] = ['card'];
const SHOWN = METHODS.filter((m) => !HIDDEN_METHODS.includes(m.id));

/**
 * Payment method choice with an icon per method (registration forms A and B, storefront cart).
 * Payments are simulated in this build, so the legend says so.
 */
export function PaymentMethodPicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  /** '' = nothing picked yet (the registration form starts empty, 27 Nov 2026) */
  value: PaymentChannel | '';
  onChange: (next: PaymentChannel) => void;
  disabled?: boolean;
}) {
  // a draft that still says "card" falls back to the first method on show; empty stays empty
  useEffect(() => {
    if (value && !SHOWN.some((m) => m.id === value) && SHOWN[0]) onChange(SHOWN[0].id);
  }, [value, onChange]);

  return (
    <fieldset className="pay-methods" disabled={disabled}>
      <legend>{tx('เลือกช่องทางชำระเงิน')}</legend>
      {SHOWN.map(({ id, title, sub, Icon }) => (
        <label key={id} className={`pay-method ${value === id ? 'is-selected' : ''}`}>
          <input type="radio" name={name} checked={value === id} onChange={() => onChange(id)} />
          <span className="pay-method-icon" aria-hidden="true">
            <Icon size={24} />
          </span>
          <span className="pay-method-copy">
            <strong>{tx(title)}</strong>
            <span>{tx(sub)}</span>
          </span>
          {value === id && (
            <span className="pay-method-check" aria-hidden="true">
              <IconCheckCircle size={20} />
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}
