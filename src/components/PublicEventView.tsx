import { useState } from 'react';
import { CustomRegistrationField, OrganizerFormStep } from '../types';
import { tx, txf } from '../i18n';
import {
  CORE_STEP,
  OTHER_PREFIX,
  evaluateConditionRule as evaluateRule,
  fieldShown,
  isContentField,
  joinMulti,
  splitMulti,
  stepOf,
} from '../data/registrationForm';

/** kept for callers that import it from here; the rule lives in data/registrationForm.ts */
export const evaluateConditionRule = evaluateRule;

/**
 * The organizer's questions as the runner answers them. `stepId` limits them to one step (the
 * "runner details" step by default when steps are given); `errors` shows the check result under
 * each question. Answers: text as typed, a multi-choice answer one choice per line, the "Other"
 * choice as "อื่น ๆ: <text>".
 */
export function RunnerCustomFieldsInputs({
  fields = [],
  answers,
  onAnswerChange,
  raceDistanceCode,
  shirtSize,
  publishedFormVersion,
  steps,
  stepId,
  errors,
  heading,
}: {
  fields?: CustomRegistrationField[];
  answers: Record<string, string | boolean>;
  onAnswerChange: (fieldId: string, value: string | boolean) => void;
  raceDistanceCode?: string;
  shirtSize?: string;
  publishedFormVersion?: string;
  /** the organizer's steps; with them, only the questions of \`stepId\` are drawn */
  steps?: OrganizerFormStep[];
  stepId?: string;
  errors?: Record<string, string>;
  /** title above the questions (default: "more details the organizer asks for") */
  heading?: string | null;
}) {
  const ctx = { raceDistance: raceDistanceCode, shirtSize };
  const inStep = (f: CustomRegistrationField) => !steps || stepOf(f, steps) === (stepId ?? CORE_STEP);
  const visibleFields = fields.filter((f) => inStep(f) && fieldShown(f, answers, ctx));
  const questionCount = visibleFields.filter((f) => !isContentField(f)).length;

  if (questionCount === 0) return null;

  return (
    <div className="runner-custom-fields">
      {heading !== null && (
        <div className="cta-inline-row" style={{ justifyContent: 'space-between', marginBottom: '0.55rem' }}>
          <h3>{heading ? tx(heading) : txf('ข้อมูลเพิ่มเติมที่ผู้จัดขอ ({0} ข้อ)', questionCount)}</h3>
          {publishedFormVersion && <span className="mono-code">Form Version: {tx(publishedFormVersion)}</span>}
        </div>
      )}

      <div className="form-grid-2">
        {visibleFields.map((field) => (
          <RunnerQuestion
            key={field.id}
            field={field}
            value={answers[field.id]}
            error={errors?.[field.id]}
            onChange={(v) => onAnswerChange(field.id, v)}
          />
        ))}
      </div>
    </div>
  );
}

export function RunnerQuestion({
  field,
  value,
  error,
  onChange,
}: {
  field: CustomRegistrationField;
  value: string | boolean | undefined;
  error?: string;
  onChange: (v: string | boolean) => void;
}) {
  const inputId = `runner-cf-${field.id}`;
  const errId = `${inputId}-err`;
  const strVal = typeof value === 'string' ? value : (field.defaultValue ?? '');
  const describedBy = error ? errId : undefined;
  const otherInit = strVal.startsWith(OTHER_PREFIX) ? strVal.slice(OTHER_PREFIX.length) : '';
  const [otherText, setOtherText] = useState(otherInit);

  if (field.type === 'heading') {
    return <h4 className="runner-cf-heading">{tx(field.label)}</h4>;
  }
  if (field.type === 'note') {
    return <p className="runner-cf-note">{tx(field.label)}</p>;
  }

  const label = (
    <>
      {tx(field.label)}{' '}
      {field.required ? (
        <span className="required-field-marker" aria-label={tx('จำเป็น')}>
          *
        </span>
      ) : (
        <span className="muted-inline">{tx('(ไม่บังคับ)')}</span>
      )}
    </>
  );
  const errorLine = error ? (
    <span id={errId} className="field-error" role="alert">
      {tx(error)}
    </span>
  ) : null;
  const options = field.options ?? [];

  if (field.type === 'checkbox') {
    return (
      <div className="form-row">
        <label className="checkbox-row" htmlFor={inputId}>
          <input
            id={inputId}
            type="checkbox"
            checked={value === true}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{label}</span>
        </label>
        {field.descriptionTh && <span className="muted-inline">{tx(field.descriptionTh)}</span>}
        {errorLine}
      </div>
    );
  }

  if (field.type === 'radio' || field.type === 'multiselect') {
    const multi = field.type === 'multiselect';
    const picked = multi ? splitMulti(strVal) : strVal ? [strVal] : [];
    const otherPicked = picked.find((p) => p.startsWith(OTHER_PREFIX));
    const toggle = (opt: string, on: boolean) => {
      if (!multi) return onChange(on ? opt : '');
      const rest = picked.filter((p) => p !== opt);
      onChange(joinMulti(on ? [...rest, opt] : rest));
    };
    const setOther = (text: string, on: boolean) => {
      setOtherText(text);
      const val = `${OTHER_PREFIX}${text}`;
      if (!multi) return onChange(on ? val : '');
      const rest = picked.filter((p) => !p.startsWith(OTHER_PREFIX));
      onChange(joinMulti(on ? [...rest, val] : rest));
    };
    return (
      <fieldset className="form-row runner-cf-choices" aria-invalid={!!error || undefined} aria-describedby={describedBy}>
        <legend>{label}</legend>
        {field.descriptionTh && <span className="muted-inline">{tx(field.descriptionTh)}</span>}
        {multi && (field.minChoices || field.maxChoices) && (
          <span className="muted-inline">
            {field.minChoices && field.maxChoices
              ? txf('เลือก {0}–{1} ข้อ', field.minChoices, field.maxChoices)
              : field.minChoices
                ? txf('เลือกอย่างน้อย {0} ข้อ', field.minChoices)
                : txf('เลือกได้ไม่เกิน {0} ข้อ', field.maxChoices)}
          </span>
        )}
        {options.map((opt) => (
          <label key={opt} className="checkbox-row">
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={inputId}
              checked={picked.includes(opt)}
              onChange={(e) => toggle(opt, e.target.checked)}
            />
            <span>{tx(opt)}</span>
          </label>
        ))}
        {field.allowOther && (
          <div className="runner-cf-other">
            <label className="checkbox-row">
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={inputId}
                checked={!!otherPicked}
                onChange={(e) => setOther(otherText, e.target.checked)}
              />
              <span>{tx('อื่น ๆ')}</span>
            </label>
            <input
              type="text"
              aria-label={txf('{0}: อื่น ๆ (ระบุ)', field.label)}
              placeholder={tx('ระบุ')}
              value={otherText}
              maxLength={200}
              onChange={(e) => setOther(e.target.value, e.target.value.trim() !== '')}
            />
          </div>
        )}
        {errorLine}
      </fieldset>
    );
  }

  const common = {
    id: inputId,
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy,
  };
  return (
    <div className="form-row">
      <label htmlFor={inputId}>{label}</label>
      {field.descriptionTh && <span className="muted-inline">{tx(field.descriptionTh)}</span>}
      {(field.type === 'select' || field.type === 'size_selector' || field.type === 'distance_selector' || field.type === 'image_choice') && (
        <select {...common} value={strVal} onChange={(e) => onChange(e.target.value)}>
          <option value="">{tx('-- เลือก --')}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {tx(opt)}
            </option>
          ))}
        </select>
      )}
      {(field.type === 'textarea' || field.type === 'address') && (
        <textarea
          {...common}
          rows={3}
          value={strVal}
          maxLength={field.maxLength}
          placeholder={field.placeholderTh ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {(field.type === 'text' ||
        field.type === 'email' ||
        field.type === 'phone' ||
        field.type === 'number' ||
        field.type === 'date' ||
        field.type === 'file') && (
        <input
          {...common}
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'date'
                ? 'date'
                : field.type === 'email'
                  ? 'email'
                  : field.type === 'phone'
                    ? 'tel'
                    : 'text'
          }
          inputMode={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'decimal' : undefined}
          value={strVal}
          maxLength={field.type === 'text' ? field.maxLength : undefined}
          min={field.type === 'number' ? field.minValue : undefined}
          max={field.type === 'number' ? field.maxValue : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            field.placeholderTh ?? (field.type === 'file' ? tx('ระบุชื่อไฟล์เอกสารแนบ เช่น medical-cert.pdf') : '')
          }
        />
      )}
      {errorLine}
    </div>
  );
}
