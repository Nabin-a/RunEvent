import { CustomRegistrationField } from '../types';

export function validateQuotaUpdate(
    nextMaxQuota: number,
    registeredCount: number,
    reservedCount: number
): { valid: boolean; message?: string; minAllowed: number } {
    const minAllowed = registeredCount + reservedCount;

    if (!Number.isInteger(nextMaxQuota) || nextMaxQuota < 1) {
        return { valid: false, message: 'จำนวนรับสมัครต้องเป็นจำนวนเต็มบวก', minAllowed };
    }

    if (nextMaxQuota < minAllowed) {
        return {
            valid: false,
            message: `ปรับลดต่ำกว่า ${minAllowed} ไม่ได้ (สมัครแล้ว ${registeredCount} + กันโควตาอยู่ ${reservedCount})`,
            minAllowed,
        };
    }

    return { valid: true, minAllowed };
}

// ใช้ตอนกด "ทำสำเนางาน" คัดลอกเฉพาะโครงคำถามและโควตาตั้งต้น ไม่คัดลอกผู้สมัครหรือคำตอบ PII
export function cloneCustomFieldsSchema(
    fields: CustomRegistrationField[] = []
): CustomRegistrationField[] {
    return fields.map((field) => ({
        ...field,
        id: `cf_${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`,
        options: field.options ? [...field.options] : undefined,
    }));
}