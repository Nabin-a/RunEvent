import { tx } from '../i18n';
import { IconCard, IconCheckCircle, IconQr } from './Icons';

export type PaymentChannel = 'promptpay' | 'card';

const METHODS: { id: PaymentChannel; title: string; sub: string; Icon: typeof IconQr }[] = [
  { id: 'promptpay', title: 'QR PromptPay', sub: 'สแกนจ่ายผ่านแอปธนาคาร', Icon: IconQr },
  { id: 'card', title: 'บัตรเครดิต / เดบิต', sub: 'Visa · Mastercard · JCB', Icon: IconCard },
];

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
  value: PaymentChannel;
  onChange: (next: PaymentChannel) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="pay-methods" disabled={disabled}>
      <legend>{tx('เลือกช่องทางชำระเงิน (จำลอง)')}</legend>
      {METHODS.map(({ id, title, sub, Icon }) => (
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
