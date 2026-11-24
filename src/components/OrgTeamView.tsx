/**
 * Organization "ทีมและข้อมูลองค์กร" — approved mockup, 24 Nov 2026.
 * Organization info and verification → payout account → what each role can do
 * (matches the permission flags the dashboard and server use) → team members →
 * single-use invite codes. Hiding a menu is not access control; the server checks.
 */
import React, { useState } from 'react';
import type { OrgRole, RaceEvent, TeamInvitation } from '../types';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';
import '../event-finance.css';
import '../org-team.css';

export interface OrgTeamMember {
  id: string;
  name: string;
  role: OrgRole;
  assignedEventIds?: string[];
  lastLoginAt?: string;
}

interface Props {
  org: {
    id: string;
    code: string;
    nameTh: string;
    province: string;
    verificationStatus: 'verified' | 'pending_review' | 'suspended';
    contactEmail: string;
    mainContactName?: string;
    documentCount: number;
    payoutBankSummary: string;
    payoutReady: boolean;
  };
  currentUserId: string;
  currentRole: OrgRole;
  isPlatformAdmin: boolean;
  members: OrgTeamMember[];
  invitations: TeamInvitation[];
  events: RaceEvent[];
  onCreateInvite: (role: OrgRole) => TeamInvitation;
}

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'เจ้าขององค์กร',
  event_manager: 'ผู้จัดการงาน',
  finance: 'ฝ่ายการเงิน',
  staff: 'เจ้าหน้าที่รับอุปกรณ์',
};

/* what each role can do: kept in step with the canX flags in OrganizerDashboardView */
type Cell = true | false | string;
const MATRIX: { label: string; cells: Record<OrgRole, Cell> }[] = [
  { label: 'ตั้งค่างาน ราคา จำนวนรับ สินค้า', cells: { owner: true, event_manager: true, finance: false, staff: false } },
  { label: 'ดูผู้สมัครและกำหนดเลข BIB', cells: { owner: true, event_manager: true, finance: 'ดูอย่างเดียว', staff: 'ค้นหาตอนเช็กอิน ซ่อนข้อมูลส่วนตัว' } },
  { label: 'เช็กอินหน้างาน', cells: { owner: true, event_manager: true, finance: false, staff: true } },
  { label: 'ดูเงินและอนุมัติคืนเงิน', cells: { owner: true, event_manager: false, finance: true, staff: false } },
  { label: 'เปลี่ยนบัญชีรับเงิน', cells: { owner: true, event_manager: false, finance: false, staff: false } },
  { label: 'เชิญเข้าทีม', cells: { owner: true, event_manager: false, finance: false, staff: false } },
];
const ROLES: OrgRole[] = ['owner', 'event_manager', 'finance', 'staff'];

/** first consonant (or Latin letter) of the first and last name: ทานตะวัน วงศ์เจริญ -> ทว */
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = (w: string) => w.match(/[ก-ฮA-Za-z]/)?.[0] ?? w.slice(0, 1);
  return (first(parts[0] ?? '') + (parts.length > 1 ? first(parts[parts.length - 1]) : '')).toUpperCase();
}

const bangkokTime = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(iso));

const VERIFY_META = {
  verified: { label: 'ผ่านการยืนยันผู้จัด', icon: 'circle-check', tone: 'is-ok' },
  pending_review: { label: 'รอตรวจเอกสารผู้จัด', icon: 'clock', tone: 'is-warn' },
  suspended: { label: 'ระงับการใช้งาน', icon: 'ban', tone: 'is-danger' },
} as const;

export const OrgTeamView: React.FC<Props> = ({
  org,
  currentUserId,
  currentRole,
  isPlatformAdmin,
  members,
  invitations,
  events,
  onCreateInvite,
}) => {
  const [inviteRole, setInviteRole] = useState<OrgRole>('staff');
  const [justCreated, setJustCreated] = useState<TeamInvitation | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const canInvite = currentRole === 'owner' || isPlatformAdmin;
  const today = new Date().toISOString().slice(0, 10);
  const verify = VERIFY_META[org.verificationStatus];

  const scopeText = (ids?: string[]) => {
    if (!ids || ids.length === 0) return tx('ทุกงาน');
    return ids.map((id) => tx(events.find((e) => e.id === id)?.titleTh ?? id)).join(', ');
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  };

  const sortedInvites = invitations.slice().sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));

  return (
    <div className="ot-page">
      <header className="ot-head">
        <div>
          <h1>{tx('ทีมและข้อมูลองค์กร')}</h1>
          <p className="fin-sub">{tx('ใครอยู่ในทีม ทำอะไรได้บ้าง และข้อมูลองค์กรที่ใช้รับเงิน')}</p>
        </div>
      </header>

      <div className="fin-grid2">
        <section className="fin-panel" aria-labelledby="ot-org-h">
          <div className="fin-panel-head">
            <h2 id="ot-org-h">{tx(org.nameTh)}</h2>
            <span className={`fin-tag ${verify.tone}`}>
              <FaIcon name={verify.icon} />
              {tx(verify.label)}
            </span>
          </div>
          <dl className="ot-dl">
            <dt>{tx('รหัสองค์กร')}</dt>
            <dd>{org.code}</dd>
            <dt>{tx('จังหวัด')}</dt>
            <dd>{tx(org.province)}</dd>
            <dt>{tx('ผู้ติดต่อหลัก')}</dt>
            <dd>
              {org.mainContactName ? `${tx(org.mainContactName)} · ` : ''}
              {org.contactEmail}
            </dd>
            <dt>{tx('เอกสารยืนยัน')}</dt>
            <dd>{org.documentCount > 0 ? txf('ส่งแล้ว {0} ฉบับ', org.documentCount) : tx('ยังไม่มีเอกสารในระบบ')}</dd>
          </dl>
        </section>

        <section className={`fin-panel${org.payoutReady ? '' : ' is-urgent'}`} aria-labelledby="ot-bank-h">
          <div className="fin-panel-head">
            <h2 id="ot-bank-h">{tx('บัญชีรับเงิน')}</h2>
            <span className={`fin-tag ${org.payoutReady ? 'is-ok' : 'is-warn'}`}>
              <FaIcon name={org.payoutReady ? 'shield-halved' : 'triangle-exclamation'} />
              {tx(org.payoutReady ? 'ยืนยันแล้ว' : 'รอยืนยันเอกสาร')}
            </span>
          </div>
          <p className="ot-bank">
            <FaIcon name="building-columns" /> {tx(org.payoutBankSummary)}
          </p>
          <p className="fin-sub">
            <FaIcon name="lock" />{' '}
            {tx(
              currentRole === 'owner'
                ? 'เปลี่ยนบัญชีได้เฉพาะเจ้าขององค์กร ติดต่อทีมแพลตฟอร์มพร้อมเอกสารบัญชีใหม่ ยอดที่นัดโอนจะรอจนบัญชีใหม่ผ่านการตรวจ'
                : 'บทบาทของคุณดูได้อย่างเดียว เปลี่ยนบัญชีได้เฉพาะเจ้าขององค์กร'
            )}
          </p>
        </section>
      </div>

      <section className="fin-panel" aria-labelledby="ot-matrix-h">
        <div className="fin-panel-head">
          <h2 id="ot-matrix-h">{tx('แต่ละบทบาททำอะไรได้')}</h2>
          <span className="fin-sub">{tx('ระบบหลังบ้านตรวจสิทธิ์ทุกครั้ง ไม่ได้แค่ซ่อนเมนู')}</span>
        </div>
        <div className="ot-matrix-wrap">
          <table className="ot-matrix">
            <thead>
              <tr>
                <th scope="col">
                  <span className="eh-sr">{tx('เรื่อง')}</span>
                </th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className={r === currentRole ? 'is-you' : ''}>
                    {tx(ROLE_LABEL[r])}
                    {r === currentRole && <span className="ot-you">{tx('(คุณ)')}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{tx(row.label)}</th>
                  {ROLES.map((r) => {
                    const c = row.cells[r];
                    return (
                      <td key={r} className={r === currentRole ? 'is-you' : ''}>
                        {c === true ? (
                          <span className="ot-yes">
                            <FaIcon name="circle-check" />
                            <span className="eh-sr">{tx('ได้')}</span>
                          </span>
                        ) : c === false ? (
                          <span className="ot-no">
                            <FaIcon name="minus" />
                            <span className="eh-sr">{tx('ไม่ได้')}</span>
                          </span>
                        ) : (
                          <span className="ot-part">{tx(c)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fin-panel" aria-labelledby="ot-members-h">
        <div className="fin-panel-head">
          <h2 id="ot-members-h">{tx('สมาชิกทีม')}</h2>
          <span className="fin-sub">{txf('{0} คน', members.length)}</span>
        </div>
        {members.length === 0 ? (
          <p className="fin-sub">{tx('ยังไม่มีสมาชิกในทีม')}</p>
        ) : (
          <ul className="ot-members">
            {members.map((m) => (
              <li key={m.id}>
                <span className="ot-avatar" aria-hidden="true">
                  {initials(m.name)}
                </span>
                <span className="ot-member-main">
                  <strong>
                    {tx(m.name)} {m.id === currentUserId && <span className="fin-sub">{tx('(คุณ)')}</span>}
                  </strong>
                  <span className="fin-sub">
                    {m.lastLoginAt ? txf('เข้าใช้ล่าสุด {0}', bangkokTime(m.lastLoginAt)) : tx('ยังไม่มีข้อมูลการเข้าใช้')}
                  </span>
                </span>
                <span className={`fin-tag ${m.role === 'owner' ? 'is-ok' : 'is-muted'}`}>{tx(ROLE_LABEL[m.role])}</span>
                <span className="ot-scope">{scopeText(m.assignedEventIds)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="fin-panel" aria-labelledby="ot-invite-h">
        <div className="fin-panel-head">
          <h2 id="ot-invite-h">{tx('เชิญเข้าทีม')}</h2>
          <span className="fin-sub">{tx('รหัสคำเชิญใช้ได้ครั้งเดียวและมีวันหมดอายุ คนที่ได้รับกดรับสิทธิ์ในหน้าบัญชีของตัวเอง')}</span>
        </div>
        {canInvite ? (
          <form
            className="ot-invite"
            onSubmit={(e) => {
              e.preventDefault();
              setJustCreated(onCreateInvite(inviteRole));
            }}
          >
            <label htmlFor="ot-role">{tx('บทบาท')}</label>
            <select id="ot-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}>
              <option value="staff">{tx(ROLE_LABEL.staff)}</option>
              <option value="event_manager">{tx(ROLE_LABEL.event_manager)}</option>
              <option value="finance">{tx(ROLE_LABEL.finance)}</option>
            </select>
            <button type="submit" className="fin-btn is-primary">
              <FaIcon name="user-plus" />
              {tx('สร้างรหัสคำเชิญ')}
            </button>
          </form>
        ) : (
          <p className="fin-sub">
            <FaIcon name="lock" /> {tx('เชิญเข้าทีมได้เฉพาะเจ้าขององค์กร')}
          </p>
        )}
        {justCreated && (
          <p className="ot-created" role="status">
            <FaIcon name="circle-check" />
            {txf('สร้างรหัส {0} สำหรับ{1}แล้ว หมดอายุ {2}', justCreated.inviteCode, tx(ROLE_LABEL[justCreated.role]), justCreated.expiresAt)}
            <button type="button" className="fin-link" onClick={() => copy(justCreated.inviteCode)}>
              {tx(copied === justCreated.inviteCode ? 'คัดลอกแล้ว' : 'คัดลอกรหัส')}
            </button>
          </p>
        )}
        {sortedInvites.length > 0 && (
          <table className="fin-table">
            <thead>
              <tr>
                <th scope="col">{tx('รหัสคำเชิญ')}</th>
                <th scope="col">{tx('บทบาท')}</th>
                <th scope="col">{tx('หมดอายุ')}</th>
                <th scope="col">{tx('สถานะ')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvites.map((inv) => {
                const used = Boolean(inv.usedByUserId);
                const expired = !used && inv.expiresAt.slice(0, 10) < today;
                const usedBy = members.find((m) => m.id === inv.usedByUserId)?.name ?? inv.usedByUserId;
                return (
                  <tr key={inv.id}>
                    <td className="fin-date">
                      {inv.inviteCode}
                      {!used && !expired && (
                        <button type="button" className="fin-link ot-copy" onClick={() => copy(inv.inviteCode)}>
                          {tx(copied === inv.inviteCode ? 'คัดลอกแล้ว' : 'คัดลอก')}
                        </button>
                      )}
                    </td>
                    <td>{tx(ROLE_LABEL[inv.role])}</td>
                    <td className="fin-date">{inv.expiresAt.slice(0, 10)}</td>
                    <td>
                      {used ? (
                        <span className="fin-tag is-ok">
                          <FaIcon name="check" />
                          {txf('{0} รับแล้ว', tx(usedBy ?? ''))}
                        </span>
                      ) : expired ? (
                        <span className="fin-tag is-muted">
                          <FaIcon name="hourglass-end" />
                          {tx('หมดอายุ')}
                        </span>
                      ) : (
                        <span className="fin-tag is-warn">
                          <FaIcon name="clock" />
                          {tx('ยังไม่ถูกใช้')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <p className="fin-sub">{tx('ข้อมูลในระบบนี้เป็นข้อมูลจำลอง')}</p>
    </div>
  );
};
