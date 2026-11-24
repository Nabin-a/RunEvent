import { CustomRegistrationField, RaceEvent } from '../types';
import { tx, txf } from '../i18n';

export function validateQuotaUpdate(
    nextMaxQuota: number,
    registeredCount: number,
    reservedCount: number
): { valid: boolean; message?: string; minAllowed: number } {
    const minAllowed = registeredCount + reservedCount;

    if (!Number.isInteger(nextMaxQuota) || nextMaxQuota < 1) {
        return { valid: false, message: tx('จำนวนรับสมัครต้องเป็นจำนวนเต็มบวก'), minAllowed };
    }

    if (nextMaxQuota < minAllowed) {
        return {
            valid: false,
            message: txf(
                'ปรับลดต่ำกว่า {0} ไม่ได้ (สมัครแล้ว {1} + กันโควตาอยู่ {2})',
                minAllowed,
                registeredCount,
                reservedCount
            ),
            minAllowed,
        };
    }

    return { valid: true, minAllowed };
}

// โควตารวมทั้งงานเปิดอยู่หรือไม่ งานที่สร้างก่อนมีสวิตช์ (ไม่มีค่า) ถือว่าเปิด
export function isTotalQuotaEnabled(ev: Pick<RaceEvent, 'totalEventQuotaEnabled'>): boolean {
    return ev.totalEventQuotaEnabled !== false;
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