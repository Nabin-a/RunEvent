import React, { useState } from 'react';
import { DemoUser, Organization, OrgRole } from '../types';
import {
  IconAlert,
  IconArrowRight,
  IconBuilding,
  IconCheckCircle,
  IconLock,
  IconShield,
  IconUsers,
} from './Icons';

interface LoginViewProps {
  users: DemoUser[];
  organizations: Organization[];
  currentUser: DemoUser | null;
  onSelectDemoUser: (user: DemoUser, defaultOrgId?: string) => void;
  onLogout: () => void;
}

const roleTitleTh: Record<OrgRole, string> = {
  owner: 'เจ้าขององค์กร (Org Owner)',
  event_manager: 'ผู้จัดการงาน (Event Manager)',
  finance: 'ฝ่ายการเงิน (Finance Officer)',
  staff: 'เจ้าหน้าที่จุดรับอุปกรณ์ (Kit-Pickup Staff)',
};

export const LoginView: React.FC<LoginViewProps> = ({
  users,
  organizations,
  currentUser,
  onSelectDemoUser,
  onLogout,
}) => {
  const [emailInput, setEmailInput] = useState(
    users[0]?.email ?? 'tantawan.owner@demo.runevent.local'
  );
  const [passwordInput, setPasswordInput] = useState('demo-only-not-sent');
  const [formError, setFormError] = useState<string | null>(null);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = users.find(
      (u) => u.email.toLowerCase() === emailInput.trim().toLowerCase()
    );
    if (!matched) {
      setFormError(
        'ไม่พบอีเมลนี้ในชุดบัญชีสาธิต กรุณาคลิกเลือกบัญชีสาธิตด้านขวาหรือใช้อีเมล @demo.runevent.local ที่กำหนดไว้'
      );
      return;
    }
    setFormError(null);
    onSelectDemoUser(matched, matched.memberships[0]?.organizationId);
  };

  return (
    <div className="login-shell">
      <div className="login-grid">
        <section className="login-form-panel" aria-label="แบบฟอร์มเข้าสู่ระบบสาธิต">
          <h1>เข้าสู่ระบบ RunEvent (โหมดจำลองสิทธิ์ Multi-Tenant)</h1>
          <p className="muted-block">
            บัญชีหนึ่งสามารถสังกัดหลายองค์กรผู้จัดงานได้ โดยสิทธิ์การเข้าถึงข้อมูลผู้สมัคร
            ยอดนำส่ง และการส่งมอบ BIB ผูกกับสมาชิกองค์กรและขอบเขตงานที่ได้รับมอบหมาย
          </p>

          {currentUser && (
            <div className="active-session-box">
              <div className="session-box-row">
                <IconCheckCircle size={18} />
                <div>
                  <strong>กำลังใช้งานในชื่อ: {currentUser.fullNameTh}</strong>
                  <div className="muted-inline">{currentUser.email}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={onLogout}
              >
                ออกจากระบบสาธิต
              </button>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="auth-cred-form">
            <div className="form-row">
              <label htmlFor="login-email">อีเมลบัญชีสาธิต</label>
              <input
                id="login-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-row">
              <label htmlFor="login-pass">
                รหัสผ่านจำลอง (ต้นแบบไม่ส่งรหัสผ่านออกนอกเบราว์เซอร์)
              </label>
              <input
                id="login-pass"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {formError && (
              <div className="error-callout" role="alert">
                <IconAlert size={16} />
                <span>{formError}</span>
              </div>
            )}

            <button type="submit" className="btn-primary btn-full">
              <IconLock size={16} />
              <span>เข้าสู่ระบบด้วยอีเมลบัญชีสาธิต</span>
            </button>
          </form>

          <div className="permission-matrix-summary">
            <h2>ตารางขอบเขตสิทธิ์ที่จำลองในต้นแบบนี้</h2>
            <table className="compact-matrix-table">
              <thead>
                <tr>
                  <th>บทบาท</th>
                  <th>งานและโควตา</th>
                  <th>การเงิน/คืนเงิน</th>
                  <th>เช็กอิน/BIB</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>เจ้าขององค์กร</td>
                  <td>ทุกงานในองค์กร</td>
                  <td>ดูครบ + ตั้งบัญชีรับเงิน</td>
                  <td>ทำได้ครบ</td>
                </tr>
                <tr>
                  <td>ผู้จัดการงาน</td>
                  <td>เฉพาะงานที่มอบหมาย</td>
                  <td>ไม่มีสิทธิ์เข้าถึง</td>
                  <td>กำหนด BIB ได้</td>
                </tr>
                <tr>
                  <td>ฝ่ายการเงิน</td>
                  <td>อ่านอย่างเดียว</td>
                  <td>อนุมัติคืนเงิน/ดูนำส่ง</td>
                  <td>ไม่มีสิทธิ์ส่งมอบ</td>
                </tr>
                <tr>
                  <td>เจ้าหน้าที่รับอุปกรณ์</td>
                  <td>เฉพาะงานที่ระบุ</td>
                  <td>ซ่อนยอดเงินทั้งหมด</td>
                  <td>สแกน QR / ส่งมอบ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="persona-picker-panel"
          aria-label="เลือกบัญชีสาธิตตามบทบาทและองค์กร"
        >
          <h2>คลิกสลับบัญชีสาธิตทันที (5 บทบาททดสอบครบ Flow)</h2>
          <p className="muted-block">
            ในระบบจริงการตรวจสิทธิ์ทุกคำขอต้องทำฝั่งเซิร์ฟเวอร์ (Tenant Isolation)
            ไม่ใช่เพียงการซ่อนเมนูบนหน้าเว็บ
          </p>

          <div className="persona-list">
            {users.map((u) => {
              const isCurrent = currentUser?.id === u.id;
              return (
                <div
                  key={u.id}
                  className={`persona-row ${isCurrent ? 'persona-active' : ''}`}
                >
                  <div className="persona-row-head">
                    <div className="persona-identity">
                      {u.kind === 'organizer' ? (
                        <IconShield size={18} />
                      ) : (
                        <IconUsers size={18} />
                      )}
                      <strong>{u.fullNameTh}</strong>
                      <span className="mono-code">{u.code}</span>
                    </div>
                    <span
                      className={`status-pill ${
                        u.kind === 'organizer' ? 'badge-navy' : 'badge-forest'
                      }`}
                    >
                      {u.kind === 'organizer'
                        ? 'ฝั่งผู้จัดงาน (Organizer)'
                        : 'ฝั่งนักวิ่ง (Runner)'}
                    </span>
                  </div>

                  <p className="persona-desc">{u.personaSummary}</p>

                  {u.memberships.length > 0 ? (
                    <div className="membership-action-list">
                      {u.memberships.map((m) => {
                        const org = organizations.find(
                          (o) => o.id === m.organizationId
                        );
                        return (
                          <button
                            key={`${u.id}-${m.organizationId}`}
                            type="button"
                            className="btn-org-enter"
                            onClick={() =>
                              onSelectDemoUser(u, m.organizationId)
                            }
                          >
                            <IconBuilding size={15} />
                            <span>
                              เข้า <strong>{org?.nameTh}</strong> ในฐานะ{' '}
                              <em>{roleTitleTh[m.role]}</em>
                            </span>
                            <IconArrowRight size={14} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="membership-action-list">
                      <button
                        type="button"
                        className="btn-org-enter"
                        onClick={() => onSelectDemoUser(u)}
                      >
                        <IconUsers size={15} />
                        <span>
                          เข้าใช้งานในฐานะนักวิ่ง (ดูใบสมัคร, QR รับอุปกรณ์ และแก้ไซส์เสื้อ)
                        </span>
                        <IconArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
