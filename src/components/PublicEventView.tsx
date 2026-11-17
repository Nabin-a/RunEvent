import { CustomRegistrationField } from '../types';

export function RunnerCustomFieldsInputs({
  fields = [],
  answers,
  onAnswerChange,
}: {
  fields?: CustomRegistrationField[];
  answers: Record<string, string | boolean>;
  onAnswerChange: (fieldId: string, value: string | boolean) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="runner-custom-fields">
      <h3>ข้อมูลเพิ่มเติมที่ผู้จัดงานกำหนด</h3>
      <div className="form-grid-2">
        {fields.map((field) => {
          const inputId = `runner-cf-${field.id}`;
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
                    {field.required && <strong>[จำเป็น] </strong>}
                    {field.label}
                  </span>
                </label>
              ) : (
                <>
                  <label htmlFor={inputId}>
                    {field.label}{' '}
                    {field.required ? (
                      <span className="text-vermilion">*</span>
                    ) : (
                      <span className="muted-inline">(ไม่บังคับ)</span>
                    )}
                  </label>
                  {field.type === 'text' && (
                    <input
                      id={inputId}
                      type="text"
                      required={field.required}
                      value={(answers[field.id] as string) ?? ''}
                      onChange={(e) => onAnswerChange(field.id, e.target.value)}
                      placeholder={`ระบุ${field.label}...`}
                    />
                  )}
                  {field.type === 'select' && (
                    <select
                      id={inputId}
                      required={field.required}
                      value={(answers[field.id] as string) ?? ''}
                      onChange={(e) => onAnswerChange(field.id, e.target.value)}
                    >
                      <option value="">-- เลือก{field.label} --</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
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
