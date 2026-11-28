/**
 * Highlight required / invalid form fields across the whole app.
 *
 * Works with the browser's own constraint validation: any input, select or textarea
 * with `required`, `type="email"`, `minLength`, `pattern`, … that fails when a form is
 * submitted (or when `reportInvalidFieldsWithin` runs) gets:
 *   - `aria-invalid="true"` on the control (styled red, announced by screen readers),
 *   - a short message under the field via `data-invalid-msg` on its `.form-row`,
 *   - focus + scroll on the first invalid field of that attempt.
 * The mark is removed as soon as the field becomes valid.
 *
 * Attributes (not classes) are used on purpose: React rewrites `className` on every
 * render but leaves attributes it does not own alone.
 */
import { tx, txf } from '../i18n';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const CONTAINER = '.form-row, .checkbox-row, .reg-field-group, fieldset';

function isControl(el: EventTarget | null): el is Control {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

function messageFor(el: Control): string {
  const v = el.validity;
  if (v.valueMissing) {
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      return tx('กรุณาเลือกหรือยืนยันช่องนี้');
    }
    if (el instanceof HTMLSelectElement) return tx('กรุณาเลือกข้อมูลช่องนี้');
    return tx('กรุณากรอกข้อมูลช่องนี้');
  }
  if (v.typeMismatch && el instanceof HTMLInputElement && el.type === 'email') {
    return tx('รูปแบบอีเมลไม่ถูกต้อง');
  }
  if (v.tooShort && 'minLength' in el) return txf('ต้องมีอย่างน้อย {0} ตัวอักษร', el.minLength);
  if (v.rangeUnderflow || v.rangeOverflow) return tx('ค่าที่กรอกอยู่นอกช่วงที่กำหนด');
  if (v.patternMismatch || v.typeMismatch || v.badInput) return tx('รูปแบบข้อมูลไม่ถูกต้อง');
  return el.validationMessage;
}

function containerOf(el: Control): HTMLElement | null {
  return el.closest<HTMLElement>(CONTAINER);
}

function mark(el: Control) {
  el.setAttribute('aria-invalid', 'true');
  const box = containerOf(el);
  if (box) box.setAttribute('data-invalid-msg', messageFor(el));
}

function unmarkIfValid(el: Control) {
  if (el.getAttribute('aria-invalid') !== 'true' || !el.validity.valid) return;
  el.removeAttribute('aria-invalid');
  const box = containerOf(el);
  // keep the box message while another control in the same box is still invalid
  if (box && !box.querySelector('[aria-invalid="true"]')) box.removeAttribute('data-invalid-msg');
}

let batch: Control[] = [];
let batchTimer: number | null = null;

function flushBatch() {
  batchTimer = null;
  const first = batch
    .filter((el) => el.isConnected)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))[0];
  batch = [];
  if (!first) return;
  first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  first.focus({ preventScroll: true });
}

/** Installs the document-level listeners once. Returns a cleanup function. */
export function installInvalidFieldHighlight(): () => void {
  const onInvalid = (e: Event) => {
    if (!isControl(e.target)) return;
    // our inline message replaces the browser bubble
    e.preventDefault();
    mark(e.target);
    batch.push(e.target);
    if (batchTimer === null) batchTimer = window.setTimeout(flushBatch, 0);
  };
  const onEdit = (e: Event) => {
    if (!isControl(e.target)) return;
    if (e.target.getAttribute('aria-invalid') === 'true') {
      if (e.target.validity.valid) unmarkIfValid(e.target);
      else {
        // still invalid, but the reason may have changed (e.g. empty -> bad email)
        const box = containerOf(e.target);
        if (box) box.setAttribute('data-invalid-msg', messageFor(e.target));
      }
    }
  };
  document.addEventListener('invalid', onInvalid, true);
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);
  return () => {
    document.removeEventListener('invalid', onInvalid, true);
    document.removeEventListener('input', onEdit, true);
    document.removeEventListener('change', onEdit, true);
  };
}

/**
 * For steps that are not a <form> submit (buttons with type="button"): validates every
 * control inside `root`, highlights the invalid ones and focuses the first.
 * Returns true when everything is valid.
 */
export function reportInvalidFieldsWithin(root: Element | null | undefined): boolean {
  if (!root) return true;
  let ok = true;
  root.querySelectorAll<Control>('input, select, textarea').forEach((el) => {
    if (el.disabled || el.validity.valid) return;
    ok = false;
    el.checkValidity(); // fires "invalid" -> marked by the global listener
  });
  return ok;
}
