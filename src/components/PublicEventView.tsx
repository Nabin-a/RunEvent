import { ConditionalRule, CustomRegistrationField } from '../types';

import { tx, txf } from '../i18n';
export function evaluateConditionRule(
  rule: ConditionalRule | undefined,
  answers: Record<string, string | boolean>,
  contextValues: { raceDistance?: string; shirtSize?: string }
): boolean {
  if (!rule) return true;
  let actualValue = '';
  if (rule.sourceFieldKey === 'race_distance') {
    actualValue = contextValues.raceDistance ?? '';
  } else if (rule.sourceFieldKey === 'shirt_size') {
    actualValue = contextValues.shirtSize ?? '';
  } else {
    actualValue = String(answers[rule.sourceFieldKey] ?? '');
  }

  if (rule.operator === 'equals') {
    return actualValue === rule.value;
  }
  if (rule.operator === 'not_equals') {
    return actualValue !== '' && actualValue !== rule.value;
  }
  if (rule.operator === 'contains') {
    return actualValue.toLowerCase().includes(rule.value.toLowerCase());
  }
  return true;
}

export function RunnerCustomFieldsInputs({
  fields = [],
  answers,
  onAnswerChange,
  raceDistanceCode,
  shirtSize,
  publishedFormVersion,
}: {
  fields?: CustomRegistrationField[];
  answers: Record<string, string | boolean>;
  onAnswerChange: (fieldId: string, value: string | boolean) => void;
  raceDistanceCode?: string;
  shirtSize?: string;
  publishedFormVersion?: string;
}) {
  const visibleFields = fields.filter((f) =>
    evaluateConditionRule(f.visibilityCondition, answers, {
      raceDistance: raceDistanceCode,
      shirtSize,
    })
  );

  if (visibleFields.length === 0) return null;

  return (
    <div className="runner-custom-fields">
      <div
        className="cta-inline-row"
        style={{ justifyContent: 'space-between', marginBottom: '0.55rem' }}
      >
        <h3>
          {txf('ข้อมูลเพิ่มเติมที่ผู้จัดขอ ({0} ข้อ)', visibleFields.length)}
        </h3>
        {publishedFormVersion && (
          <span className="mono-code">
            Form Version: {tx(publishedFormVersion)}
          </span>
        )}
      </div>

      <div className="form-grid-2">
        {visibleFields.map((field) => {
          const inputId = `runner-cf-${field.id}`;
          const strVal = (answers[field.id] as string) ?? field.defaultValue ?? '';

          return (
            <div key={field.id} className="form-row">
              {field.type === 'checkbox' ? (
                <label className="checkbox-row" htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={Boolean(answers[field.id])}
                    onChange={(e) => onAnswerChange(field.id, e.target.checked)}
                  />
                  <span>
                    {field.required && <strong>{tx("[จำเป็น]")} </strong>}
                    {tx(field.label)}
                  </span>
                </label>
              ) : (
                <>
                  <label htmlFor={inputId}>
                    {tx(field.label)}{' '}
                    {field.required ? (
                      <span className="required-field-marker">*</span>
                    ) : (
                      <span className="muted-inline">{tx("(ไม่บังคับ)")}</span>
                    )}
                  </label>
                  {field.descriptionTh && (
                    <span className="muted-inline">{tx(field.descriptionTh)}</span>
                  )}

                  {(field.type === 'select' ||
                    field.type === 'size_selector' ||
                    field.type === 'distance_selector' ||
                    field.type === 'multiselect' ||
                    field.type === 'image_choice') && (
                    <select
                      id={inputId}
                      required={field.required}
                      value={strVal}
                      onChange={(e) => onAnswerChange(field.id, e.target.value)}
                    >
                      <option value="">{tx("-- เลือก")}{tx(field.label)} --</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {tx(opt)}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'radio' && (
                    <div className="cta-inline-row" style={{ flexWrap: 'wrap' }}>
                      {(field.options ?? ['ไม่มี', 'มี']).map((opt) => (
                        <label key={opt} className="checkbox-row">
                          <input
                            type="radio"
                            name={inputId}
                            checked={strVal === opt}
                            onChange={() => onAnswerChange(field.id, opt)}
                          />
                          <span>{tx(opt)}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {(field.type === 'textarea' || field.type === 'address') && (
                    <textarea
                      id={inputId}
                      rows={2}
                      required={field.required}
                      value={strVal}
                      placeholder={
                        field.placeholderTh ?? txf("ระบุ{0}...", field.label)
                      }
                      onChange={(e) => onAnswerChange(field.id, e.target.value)}
                    />
                  )}

                  {(field.type === 'text' ||
                    field.type === 'email' ||
                    field.type === 'phone' ||
                    field.type === 'number' ||
                    field.type === 'date' ||
                    field.type === 'file') && (
                    <input
                      id={inputId}
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
                      required={field.required}
                      value={strVal}
                      onChange={(e) => onAnswerChange(field.id, e.target.value)}
                      placeholder={
                        field.placeholderTh ??
                        (field.type === 'file'
                          ? tx("ระบุชื่อไฟล์เอกสารแนบ เช่น medical-cert.pdf")
                          : txf("ระบุ{0}...", field.label))
                      }
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
