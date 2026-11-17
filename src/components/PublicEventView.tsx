import React from 'react';
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
            <h4>ข้อมูลเพิ่มเติมสำหรับผู้จัดงาน</h4>
            {fields.map((field) => (
                <div key={field.id} className="form-group">
                    <label>
                        {field.label} {field.required && <span>*</span>}
                    </label>

                    {field.type === 'text' && (
                        <input
                            type="text"
                            required={field.required}
                            value={(answers[field.id] as string) ?? ''}
                            onChange={(e) => onAnswerChange(field.id, e.target.value)}
                        />
                    )}

                    {field.type === 'select' && (
                        <select
                            required={field.required}
                            value={(answers[field.id] as string) ?? ''}
                            onChange={(e) => onAnswerChange(field.id, e.target.value)}
                        >
                            <option value="">-- เลือก --</option>
                            {(field.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    )}

                    {field.type === 'checkbox' && (
                        <input
                            type="checkbox"
                            required={field.required}
                            checked={Boolean(answers[field.id])}
                            onChange={(e) => onAnswerChange(field.id, e.target.checked)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}