import type { OrgRole } from '../types';

/** Organizer team roles: names and what each one can do. Shared by the team page and the
 *  Dev / Demo account list (27 Nov 2026). Keep in step with the canX flags in
 *  OrganizerDashboardView, which the server checks again. */
export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'เจ้าขององค์กร',
  event_manager: 'ผู้จัดการงาน',
  finance: 'ฝ่ายการเงิน',
  staff: 'เจ้าหน้าที่รับอุปกรณ์',
};

/** true = can, false = cannot, text = can with that limit */
export type RoleCell = true | false | string;

export const ROLE_MATRIX: { label: string; cells: Record<OrgRole, RoleCell> }[] = [
  { label: 'ตั้งค่างาน ราคา จำนวนรับ สินค้า', cells: { owner: true, event_manager: true, finance: false, staff: false } },
  { label: 'ดูผู้สมัครและกำหนดเลข BIB', cells: { owner: true, event_manager: true, finance: 'ดูอย่างเดียว', staff: 'ค้นหาตอนเช็กอิน ซ่อนข้อมูลส่วนตัว' } },
  { label: 'เช็กอินหน้างาน', cells: { owner: true, event_manager: true, finance: false, staff: true } },
  { label: 'ดูเงินและอนุมัติคืนเงิน', cells: { owner: true, event_manager: false, finance: true, staff: false } },
  { label: 'เปลี่ยนบัญชีรับเงิน', cells: { owner: true, event_manager: false, finance: false, staff: false } },
  { label: 'เชิญเข้าทีม', cells: { owner: true, event_manager: false, finance: false, staff: false } },
];

export const ORG_ROLES: OrgRole[] = ['owner', 'event_manager', 'finance', 'staff'];

/** what a role can do, as short Thai phrases (a limit in brackets) */
export function roleDuties(role: OrgRole): string[] {
  return ROLE_MATRIX.flatMap((row) => {
    const cell = row.cells[role];
    if (cell === false) return [];
    return [cell === true ? row.label : `${row.label} (${cell})`];
  });
}
