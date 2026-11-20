import React, { useState } from 'react';
import type { AuthProviderType, UserAccount } from '../types';
import { getLang, tx, txf } from '../i18n';
import {
  IconAlert,
  IconArrowRight,
  IconCheckCircle,
  IconClose,
  IconDevice,
  IconDownload,
  IconFacebookMark,
  IconGoogleMark,
  IconLineMark,
  IconLock,
  IconMail,
} from './Icons';

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

type ActionResult = { ok: boolean; error?: string };
type Notify = (ok: boolean, message: string) => void;

const formatDateTime = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
};

const PROVIDER_META: Record<
  'google' | 'facebook' | 'line',
  { label: string; icon: React.ReactNode }
> = {
  google: { label: 'Google', icon: <IconGoogleMark size={22} /> },
  facebook: { label: 'Facebook', icon: <IconFacebookMark size={22} /> },
  line: { label: 'LINE', icon: <IconLineMark size={22} /> },
};

const PageHead: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <header className="acct-page-head">
    <h2>{title}</h2>
    <p className="muted-block">{description}</p>
  </header>
);

/* -------------------------------------------------------------------------- */
/* Account security + removal (rendered inside the Privacy & data page)        */
/* -------------------------------------------------------------------------- */

interface AccountSecuritySectionsProps {
  user: UserAccount;
  phone: string;
  onSetOrChangePassword: (newPassword: string, grant: string) => Promise<ActionResult>;
  onRequestPasswordCode: () => Promise<ActionResult & { sentTo?: string }>;
  onVerifyPasswordCode: (otp: string) => Promise<ActionResult & { grant?: string }>;
  onManageAccountStatus: (
    action: 'deactivate' | 'request_deletion' | 'cancel_deletion',
    reason?: string,
    confirmCode?: string
  ) => Promise<ActionResult>;
  notify: Notify;
}

export const AccountSecuritySections: React.FC<AccountSecuritySectionsProps> = ({
  user,
  phone,
  onSetOrChangePassword,
  onRequestPasswordCode,
  onVerifyPasswordCode,
  onManageAccountStatus,
  notify,
}) => {
  // Password change flow: idle -> send code to email -> enter code -> set new password.
  const [pwStep, setPwStep] = useState<'idle' | 'send' | 'code' | 'new'>('idle');
  const [pwSentTo, setPwSentTo] = useState('');
  const [pwOtp, setPwOtp] = useState('');
  const [pwGrant, setPwGrant] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [removalMode, setRemovalMode] = useState<'none' | 'deactivate' | 'delete'>(
    'none'
  );
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteCode, setDeleteCode] = useState('');

  const linkedMethods = user.identities.length;
  const checks = [
    { key: 'password', ok: user.hasPassword, label: tx('ตั้งรหัสผ่านสำหรับเข้าสู่ระบบด้วยอีเมลแล้ว') },
    {
      key: 'methods',
      ok: linkedMethods >= 2,
      label: tx('มีช่องทางเข้าสู่ระบบมากกว่า 1 ทาง (กันเข้าบัญชีไม่ได้)'),
    },
    { key: 'phone', ok: phone.replace(/\D/g, '').length >= 9, label: tx('มีเบอร์โทรศัพท์สำหรับติดต่อกลับ') },
  ];
  const passedChecks = checks.filter((c) => c.ok).length;

  const passwordChangedText = formatDateTime(user.passwordChangedAt);
  const deletionPending = user.accountStatus === 'deletion_requested';

  const resetPasswordFlow = () => {
    setPwStep('idle');
    setPwSentTo('');
    setPwOtp('');
    setPwGrant('');
    setPwError('');
    setNewPass('');
    setConfirmPass('');
  };

  const startPasswordFlow = () => {
    if (!user.contactEmail) {
      notify(false, tx('กรุณาเพิ่มอีเมลติดต่อในแท็บข้อมูลส่วนตัวก่อน ระบบจะส่งรหัสยืนยันไปที่อีเมลนี้ก่อนเปลี่ยนรหัสผ่าน'));
      return;
    }
    setPwError('');
    setPwStep('send');
  };

  const requestCode = async () => {
    setPwBusy(true);
    setPwError('');
    const r = await onRequestPasswordCode();
    setPwBusy(false);
    if (!r.ok) {
      setPwError(tx(r.error ?? 'ส่งรหัสไม่สำเร็จ'));
      return;
    }
    setPwSentTo(r.sentTo ?? '');
    setPwOtp('');
    setPwStep('code');
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(pwOtp.trim())) {
      setPwError(tx('กรอกรหัส 6 หลักจากอีเมล'));
      return;
    }
    setPwBusy(true);
    setPwError('');
    const r = await onVerifyPasswordCode(pwOtp.trim());
    setPwBusy(false);
    if (!r.ok || !r.grant) {
      setPwError(tx(r.error ?? 'รหัสยืนยันไม่ถูกต้อง'));
      return;
    }
    setPwGrant(r.grant);
    setPwStep('new');
  };

  const submitPassword = async () => {
    if (newPass.length < 8 || newPass !== confirmPass) {
      setPwError(tx('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษรและตรงกันทั้งสองช่อง'));
      return;
    }
    setPwBusy(true);
    setPwError('');
    const r = await onSetOrChangePassword(newPass, pwGrant);
    setPwBusy(false);
    if (!r.ok) {
      setPwError(tx(r.error ?? 'ไม่สามารถบันทึกรหัสผ่านได้'));
      return;
    }
    resetPasswordFlow();
    notify(true, tx('บันทึกรหัสผ่านใหม่แล้ว'));
  };

  return (
    <>
      {/* Password & authentication */}
      <section className="acct-section" aria-labelledby="acct-auth-title">
        <h3 id="acct-auth-title">{tx('รหัสผ่านและความปลอดภัย')}</h3>

        <div className="acct-check-block">
          <div className="acct-check-head">
            <strong>{tx('ความปลอดภัยของบัญชี')}</strong>
            <span
              className={`status-pill ${passedChecks === checks.length ? 'badge-forest' : 'badge-amber'}`}
            >
              {passedChecks === checks.length ? <IconCheckCircle size={14} /> : <IconAlert size={14} />}
              <span className="mono-num">
                {passedChecks}/{checks.length}
              </span>
            </span>
          </div>
          <ul className="acct-check-list">
            {checks.map((c) => (
              <li key={c.key} className={c.ok ? 'is-ok' : 'is-missing'}>
                {c.ok ? <IconCheckCircle size={15} /> : <IconAlert size={15} />}
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="acct-setting-row">
          <div className="acct-setting-text">
            <strong>{tx('รหัสผ่าน')}</strong>
            <span className="muted-inline">
              {user.hasPassword
                ? passwordChangedText
                  ? txf('เปลี่ยนล่าสุด {0}', passwordChangedText)
                  : tx('ตั้งรหัสผ่านแล้ว (ไม่มีบันทึกวันที่เปลี่ยนล่าสุด)')
                : tx('ยังไม่ได้ตั้งรหัสผ่าน — ตอนนี้เข้าสู่ระบบได้เฉพาะช่องทางโซเชียล')}
            </span>
          </div>
          <button
            type="button"
            className={user.hasPassword ? 'btn-secondary' : 'btn-primary'}
            aria-expanded={pwStep !== 'idle'}
            aria-controls="acct-pw-flow"
            onClick={() => (pwStep === 'idle' ? startPasswordFlow() : resetPasswordFlow())}
          >
            <IconLock size={15} />
            <span>
              {pwStep !== 'idle'
                ? tx('ยกเลิก')
                : user.hasPassword
                  ? tx('เปลี่ยนรหัสผ่าน')
                  : tx('ตั้งรหัสผ่าน')}
            </span>
          </button>
        </div>

        {pwStep !== 'idle' && (
          <div id="acct-pw-flow" className="acct-pw-flow">
            <ol className="acct-pw-steps" aria-label={tx('ขั้นตอนเปลี่ยนรหัสผ่าน')}>
              {[
                { key: 'send', label: tx('ส่งรหัสไปที่อีเมล') },
                { key: 'code', label: tx('ยืนยันรหัส') },
                { key: 'new', label: tx('ตั้งรหัสผ่านใหม่') },
              ].map((st, i) => {
                const order = ['send', 'code', 'new'];
                const cur = order.indexOf(pwStep);
                const done = i < cur;
                const current = i === cur;
                return (
                  <li
                    key={st.key}
                    className={done ? 'is-done' : current ? 'is-current' : undefined}
                    aria-current={current ? 'step' : undefined}
                  >
                    {done ? (
                      <IconCheckCircle size={14} />
                    ) : (
                      <span className="step-no">{i + 1}.</span>
                    )}
                    <span>{st.label}</span>
                  </li>
                );
              })}
            </ol>

            {pwStep === 'send' && (
              <>
                <p className="muted-block" style={{ margin: 0 }}>
                  {txf(
                    'เพื่อยืนยันว่าเป็นคุณ ระบบจะส่งรหัส 6 หลักไปที่ {0} กรอกรหัสนั้นแล้วจึงตั้งรหัสผ่านใหม่ได้',
                    user.contactEmail ? maskEmail(user.contactEmail) : '-'
                  )}
                </p>
                <div className="acct-inline-actions acct-inline-actions-start">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={pwBusy}
                    onClick={() => void requestCode()}
                  >
                    <IconMail size={15} />
                    <span>{tx('ส่งรหัสยืนยัน')}</span>
                  </button>
                </div>
              </>
            )}

            {pwStep === 'code' && (
              <form
                className="acct-inline-editor"
                onSubmit={(e) => {
                  e.preventDefault();
                  void verifyCode();
                }}
              >
                <label htmlFor="acct-pw-otp">
                  {txf('รหัส 6 หลักที่ส่งไปที่ {0}', pwSentTo || '-')}
                </label>
                <div className="acct-inline-editor-row">
                  <input
                    id="acct-pw-otp"
                    className="acct-otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={pwOtp}
                    onChange={(e) => setPwOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    aria-describedby="acct-pw-sandbox"
                    autoFocus
                  />
                  <button type="submit" className="btn-primary" disabled={pwBusy}>
                    {tx('ยืนยันรหัส')}
                  </button>
                </div>
                <p id="acct-pw-sandbox" className="acct-sandbox-note">
                  <IconAlert size={15} />
                  <span>
                    {tx('โหมดทดสอบ (Sandbox): ระบบยังไม่ส่งอีเมลจริง ใช้รหัส 123456')}
                  </span>
                </p>
                <div>
                  <button
                    type="button"
                    className="acct-link-btn"
                    disabled={pwBusy}
                    onClick={() => void requestCode()}
                  >
                    {tx('ส่งรหัสอีกครั้ง')}
                  </button>
                </div>
              </form>
            )}

            {pwStep === 'new' && (
              <form
                className="acct-inline-editor"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitPassword();
                }}
              >
                <div className="form-grid-2">
                  <div className="form-row">
                    <label htmlFor="sec-npw">{tx('รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)')}</label>
                    <input
                      id="sec-npw"
                      type="password"
                      autoComplete="new-password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="sec-cpw">{tx('ยืนยันรหัสผ่านใหม่')}</label>
                    <input
                      id="sec-cpw"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                    />
                  </div>
                </div>
                <div className="acct-inline-actions">
                  <button type="submit" className="btn-primary" disabled={pwBusy}>
                    <IconLock size={15} />
                    <span>{tx('บันทึกรหัสผ่านใหม่')}</span>
                  </button>
                </div>
              </form>
            )}

            {pwError && (
              <p className="acct-note" role="alert">
                <IconAlert size={15} />
                <span>{pwError}</span>
              </p>
            )}
          </div>
        )}
      </section>

      {/* Account removal */}
      <section className="acct-section acct-danger" aria-labelledby="acct-removal-title">
        <h3 id="acct-removal-title">{tx('ปิดหรือลบบัญชี')}</h3>

        {deletionPending ? (
          <div className="acct-setting-row">
            <div className="acct-setting-text">
              <strong className="text-amber">{tx('ส่งคำขอลบบัญชีแล้ว')}</strong>
              <span className="muted-inline">
                {txf('ส่งคำขอเมื่อ {0}', user.deletionRequestedAt ?? '-')}
                {user.deletionRequestReason ? ` · ${tx(user.deletionRequestReason)}` : ''}
              </span>
              <span className="muted-inline">
                {tx('ทีมงานจะตรวจสอบคำขอก่อนลบข้อมูล ระหว่างนี้ยังใช้งานบัญชีได้ตามปกติ')}
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                const r = await onManageAccountStatus('cancel_deletion');
                notify(
                  r.ok,
                  r.ok ? tx('ยกเลิกคำขอลบบัญชีเรียบร้อยแล้ว') : tx(r.error ?? 'ไม่สามารถดำเนินการได้')
                );
              }}
            >
              {tx('ยกเลิกคำขอลบบัญชี')}
            </button>
          </div>
        ) : (
          <>
            <p className="muted-block">
              {tx(
                'ปิดพักบัญชีจะออกจากระบบทุกอุปกรณ์และพักโปรไฟล์ไว้ กลับมาใช้ได้เมื่อเข้าสู่ระบบอีกครั้ง ส่วนการลบบัญชีเป็นคำขอให้ทีมงานลบข้อมูลส่วนบุคคล โดยรายการชำระเงินและใบสมัครที่ชำระแล้วจะยังถูกเก็บไว้ตามกฎหมาย'
              )}
            </p>
            <div className="acct-danger-actions">
              <button
                type="button"
                className="btn-danger-outline"
                aria-expanded={removalMode === 'deactivate'}
                onClick={() => setRemovalMode((m) => (m === 'deactivate' ? 'none' : 'deactivate'))}
              >
                {tx('ปิดพักบัญชี')}
              </button>
              <button
                type="button"
                className="btn-danger"
                aria-expanded={removalMode === 'delete'}
                onClick={() => setRemovalMode((m) => (m === 'delete' ? 'none' : 'delete'))}
              >
                {tx('ลบบัญชี')}
              </button>
            </div>

            {removalMode === 'deactivate' && (
              <div className="acct-confirm-panel" role="group" aria-label={tx('ยืนยันปิดพักบัญชี')}>
                <strong>{tx('ปิดพักบัญชีและออกจากระบบทุกอุปกรณ์?')}</strong>
                <span className="muted-inline">
                  {tx('บัตรวิ่งและคำสั่งซื้อเดิมยังอยู่ครบ เข้าสู่ระบบอีกครั้งเพื่อเปิดใช้งาน')}
                </span>
                <div className="acct-inline-actions">
                  <button type="button" className="btn-ghost-sm" onClick={() => setRemovalMode('none')}>
                    {tx('ยกเลิก')}
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => {
                      void onManageAccountStatus('deactivate', 'ผู้ใช้กดยืนยันปิดพักบัญชีชั่วคราว');
                    }}
                  >
                    {tx('ยืนยันปิดพักบัญชี')}
                  </button>
                </div>
              </div>
            )}

            {removalMode === 'delete' && (
              <form
                className="acct-confirm-panel"
                aria-label={tx('ยืนยันคำขอลบบัญชี')}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await onManageAccountStatus(
                    'request_deletion',
                    deleteReason.trim() || 'ขอลบข้อมูลตามสิทธิ์เจ้าของข้อมูลส่วนบุคคล',
                    deleteCode.trim()
                  );
                  if (r.ok) {
                    setDeleteReason('');
                    setDeleteCode('');
                    setRemovalMode('none');
                  }
                  notify(
                    r.ok,
                    r.ok ? tx('บันทึกคำขอลบบัญชีแล้ว') : tx(r.error ?? 'ไม่สามารถดำเนินการได้')
                  );
                }}
              >
                <strong>{tx('ส่งคำขอลบบัญชี')}</strong>
                <div className="form-row">
                  <label htmlFor="acct-del-reason">{tx('เหตุผล (ไม่บังคับ)')}</label>
                  <input
                    id="acct-del-reason"
                    type="text"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder={tx('เช่น ไม่ได้ใช้งานแล้ว')}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="acct-del-code">
                    {txf('พิมพ์รหัสบัญชี {0} เพื่อยืนยัน', user.code)}
                  </label>
                  <input
                    id="acct-del-code"
                    type="text"
                    className="mono-code"
                    autoComplete="off"
                    value={deleteCode}
                    onChange={(e) => setDeleteCode(e.target.value)}
                  />
                </div>
                <div className="acct-inline-actions">
                  <button type="button" className="btn-ghost-sm" onClick={() => setRemovalMode('none')}>
                    {tx('ยกเลิก')}
                  </button>
                  <button
                    type="submit"
                    className="btn-danger"
                    disabled={deleteCode.trim().toUpperCase() !== user.code.toUpperCase()}
                  >
                    {tx('ส่งคำขอลบบัญชี')}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. การเชื่อมต่อ (Connections)                                              */
/* -------------------------------------------------------------------------- */

interface ConnectionsPanelProps {
  user: UserAccount;
  onLinkProvider: (provider: 'google' | 'line' | 'facebook') => void;
  onUnlinkProvider: (provider: AuthProviderType) => ActionResult;
  notify: Notify;
}

export const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({
  user,
  onLinkProvider,
  onUnlinkProvider,
  notify,
}) => {
  const total = user.identities.length;
  const isLast = total <= 1;
  const unlinked = (['google', 'facebook', 'line'] as const).filter(
    (p) => !user.identities.some((i) => i.provider === p)
  );

  return (
    <div className="clean-panel acct-page">
      <PageHead
        title={tx('การเชื่อมต่อ')}
        description={tx('เชื่อมบัญชีภายนอกเพื่อเข้าสู่ระบบ กระต่าย ได้หลายทาง ถ้าลืมรหัสผ่านหรือเข้าบัญชีหนึ่งไม่ได้ ยังเข้าด้วยช่องทางอื่นได้')}
      />

      {unlinked.length > 0 && (
        <section className="acct-section acct-section-flush" aria-labelledby="acct-add-conn">
          <h3 id="acct-add-conn">{tx('เพิ่มการเชื่อมต่อ')}</h3>
          <div className="acct-connect-tiles">
            {unlinked.map((p) => (
              <button
                key={p}
                type="button"
                className="acct-connect-tile"
                onClick={() => {
                  onLinkProvider(p);
                  notify(true, txf('เชื่อม {0} แล้ว', PROVIDER_META[p].label));
                }}
              >
                {PROVIDER_META[p].icon}
                <span>{txf('เชื่อม {0}', PROVIDER_META[p].label)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="acct-section" aria-labelledby="acct-methods">
        <div className="acct-section-head">
          <h3 id="acct-methods">{tx('ช่องทางเข้าสู่ระบบของคุณ')}</h3>
          <span className="muted-inline mono-num">{txf('{0} ช่องทาง', total)}</span>
        </div>
        <ul className="acct-list">
          {user.identities.map((idn) => {
            const meta =
              idn.provider === 'password'
                ? { label: tx('อีเมล + รหัสผ่าน'), icon: <span className="acct-list-icon"><IconLock size={18} /></span> }
                : PROVIDER_META[idn.provider as 'google' | 'facebook' | 'line'] ?? {
                    label: idn.provider,
                    icon: null,
                  };
            const subject =
              idn.providerEmail ??
              (idn.provider === 'password' ? user.contactEmail ?? user.code : null);
            return (
              <li key={idn.id} className="acct-list-row">
                <span className="acct-list-lead">{meta.icon}</span>
                <div className="acct-list-text">
                  <strong>{meta.label}</strong>
                  <span className="muted-inline">
                    {subject ? `${subject} · ` : ''}
                    {txf('เชื่อมเมื่อ {0}', idn.linkedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  disabled={isLast}
                  title={isLast ? tx('ช่องทางสุดท้าย เพิ่มช่องทางอื่นก่อนจึงถอดได้') : undefined}
                  onClick={() => {
                    const r = onUnlinkProvider(idn.provider);
                    notify(
                      r.ok,
                      r.ok
                        ? txf('ถอดการเชื่อม {0} แล้ว', meta.label)
                        : tx(r.error ?? 'ไม่สามารถถอดช่องทางสุดท้ายได้')
                    );
                  }}
                >
                  {tx('ถอด')}
                </button>
              </li>
            );
          })}
        </ul>
        {isLast && (
          <p className="acct-note">
            <IconAlert size={15} />
            <span>{tx('นี่คือช่องทางเข้าสู่ระบบช่องทางเดียวของบัญชี จึงถอดไม่ได้ เพิ่มช่องทางอื่นก่อนถ้าต้องการเปลี่ยน')}</span>
          </p>
        )}
      </section>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. อุปกรณ์ (Devices & sign-in history)                                     */
/* -------------------------------------------------------------------------- */

const HISTORY_SHOWN = 20;

interface DevicesPanelProps {
  user: UserAccount;
  onRevokeSession: (sessionId: string) => Promise<ActionResult>;
  onRevokeOtherSessions: () => void;
  notify: Notify;
}

export const DevicesPanel: React.FC<DevicesPanelProps> = ({
  user,
  onRevokeSession,
  onRevokeOtherSessions,
  notify,
}) => {
  const current = user.sessions.filter((s) => s.isCurrentDevice);
  const others = user.sessions.filter((s) => !s.isCurrentDevice);
  const history = (user.loginHistory ?? []).slice(0, HISTORY_SHOWN);

  const statusOf = (s: 'success' | 'revoked' | 'failed') =>
    s === 'success'
      ? { cls: 'badge-forest', icon: <IconCheckCircle size={14} />, label: tx('สำเร็จ') }
      : s === 'failed'
        ? { cls: 'badge-danger', icon: <IconAlert size={14} />, label: tx('ไม่สำเร็จ') }
        : { cls: 'badge-neutral', icon: <IconClose size={14} />, label: tx('ถูกเพิกถอน') };

  return (
    <div className="clean-panel acct-page">
      <PageHead
        title={tx('อุปกรณ์')}
        description={tx('อุปกรณ์ที่เข้าสู่ระบบบัญชีนี้อยู่ ถ้าเห็นเครื่องที่ไม่รู้จัก ให้ออกจากระบบเครื่องนั้นแล้วเปลี่ยนรหัสผ่าน')}
      />

      <section className="acct-section acct-section-flush" aria-labelledby="acct-dev-current">
        <h3 id="acct-dev-current">{tx('เครื่องนี้')}</h3>
        <ul className="acct-list">
          {current.map((s) => (
            <li key={s.id} className="acct-list-row">
              <span className="acct-list-lead">
                <span className="acct-list-icon"><IconDevice size={18} /></span>
              </span>
              <div className="acct-list-text">
                <strong>{tx(s.deviceLabel)}</strong>
                <span className="muted-inline">
                  {tx(s.locationHint)} · {tx(s.lastActiveAt)}
                </span>
              </div>
              <span className="status-pill badge-forest">
                <IconCheckCircle size={14} />
                <span>{tx('กำลังใช้งาน')}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="acct-section" aria-labelledby="acct-dev-others">
        <div className="acct-section-head">
          <h3 id="acct-dev-others">{txf('อุปกรณ์อื่น ({0})', others.length)}</h3>
        </div>
        {others.length === 0 ? (
          <p className="muted-block">{tx('ไม่มีอุปกรณ์อื่นที่เข้าสู่ระบบอยู่')}</p>
        ) : (
          <>
            <ul className="acct-list">
              {others.map((s) => (
                <li key={s.id} className="acct-list-row">
                  <span className="acct-list-lead">
                    <span className="acct-list-icon"><IconDevice size={18} /></span>
                  </span>
                  <div className="acct-list-text">
                    <strong>{tx(s.deviceLabel)}</strong>
                    <span className="muted-inline">
                      {tx(s.locationHint)} · {tx(s.lastActiveAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="acct-icon-btn"
                    aria-label={txf('ออกจากระบบ {0}', tx(s.deviceLabel))}
                    title={tx('ออกจากระบบเครื่องนี้')}
                    onClick={async () => {
                      const r = await onRevokeSession(s.id);
                      notify(
                        r.ok,
                        r.ok
                          ? txf('ออกจากระบบ {0} แล้ว', tx(s.deviceLabel))
                          : tx(r.error ?? 'ไม่สามารถดำเนินการได้')
                      );
                    }}
                  >
                    <IconClose size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="acct-inline-actions acct-inline-actions-start">
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => {
                  onRevokeOtherSessions();
                  notify(true, tx('ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว'));
                }}
              >
                {tx('ออกจากระบบอุปกรณ์อื่นทั้งหมด')}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="acct-section" aria-labelledby="acct-dev-history">
        <div className="acct-section-head">
          <h3 id="acct-dev-history">{tx('ประวัติการเข้าสู่ระบบ')}</h3>
          <span className="muted-inline">{txf('{0} รายการล่าสุด', HISTORY_SHOWN)}</span>
        </div>
        {history.length === 0 ? (
          <p className="muted-block">{tx('ยังไม่มีประวัติการเข้าสู่ระบบ')}</p>
        ) : (
          <div className="acct-table-wrap">
            <table className="acct-history-table">
              <thead>
                <tr>
                  <th scope="col">{tx('วัน-เวลา')}</th>
                  <th scope="col">{tx('ช่องทาง')}</th>
                  <th scope="col">{tx('อุปกรณ์')}</th>
                  <th scope="col">{tx('สถานที่')}</th>
                  <th scope="col">{tx('ผล')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const st = statusOf(h.status);
                  return (
                    <tr key={h.id} className={h.status === 'failed' ? 'is-failed' : undefined}>
                      <td className="mono-num">{h.timestamp}</td>
                      <td>{tx(h.method)}</td>
                      <td>{tx(h.deviceLabel)}</td>
                      <td>{tx(h.ipOrLocation)}</td>
                      <td>
                        <span className={`status-pill ${st.cls}`}>
                          {st.icon}
                          <span>{st.label}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. ความเป็นส่วนตัวและข้อมูล (Privacy & data)                              */
/* -------------------------------------------------------------------------- */

interface PrivacyPanelProps {
  user: UserAccount;
  /** Password/security and account removal sections, rendered after the data section. */
  securitySections?: React.ReactNode;
  onSetMarketingConsent: (granted: boolean) => Promise<ActionResult>;
  onExportMyData: () => Promise<ActionResult>;
  onOpenRaceHistory: () => void;
  notify: Notify;
}

export const PrivacyPanel: React.FC<PrivacyPanelProps> = ({
  user,
  securitySections,
  onSetMarketingConsent,
  onExportMyData,
  onOpenRaceHistory,
  notify,
}) => {
  const [busy, setBusy] = useState<'marketing' | 'export' | null>(null);
  const consents = user.consents ?? [];
  const latest = (type: 'terms' | 'privacy' | 'marketing') =>
    [...consents].reverse().find((c) => c.type === type);
  const marketing = latest('marketing');
  const terms = latest('terms');
  const privacy = latest('privacy');

  const docRow = (
    title: string,
    rec: ReturnType<typeof latest>
  ) => (
    <div className="acct-setting-row">
      <div className="acct-setting-text">
        <strong>{title}</strong>
        <span className="muted-inline">
          {rec
            ? txf('ยอมรับเวอร์ชัน {0} เมื่อ {1}', rec.version ?? '-', formatDateTime(rec.recordedAt) ?? '-')
            : tx('ไม่มีบันทึก (บัญชีสร้างก่อนเริ่มเก็บข้อมูลการยินยอม)')}
        </span>
      </div>
      {rec ? (
        <span className="status-pill badge-forest">
          <IconCheckCircle size={14} />
          <span>{tx('ยอมรับแล้ว')}</span>
        </span>
      ) : (
        <span className="status-pill badge-neutral">
          <span>{tx('ไม่มีบันทึก')}</span>
        </span>
      )}
    </div>
  );

  return (
    <div className="clean-panel acct-page">
      <PageHead
        title={tx('ความเป็นส่วนตัวและข้อมูล')}
        description={tx('จัดการการยินยอม สำเนาข้อมูลส่วนบุคคล (PDPA) รหัสผ่าน และการปิดหรือลบบัญชีของคุณ')}
      />

      <section className="acct-section acct-section-flush" aria-labelledby="acct-consent">
        <h3 id="acct-consent">{tx('การยินยอม')}</h3>

        <div className="acct-setting-row">
          <div className="acct-setting-text">
            <label htmlFor="acct-marketing" className="acct-setting-label">
              {tx('รับข่าวสารงานวิ่งและโปรโมชันทางอีเมล')}
            </label>
            <span className="muted-inline">
              {marketing
                ? txf(
                  'อัปเดตล่าสุด {0} ({1})',
                  formatDateTime(marketing.recordedAt) ?? '-',
                  marketing.source === 'signup' ? tx('ตอนสมัครสมาชิก') : tx('ในหน้าตั้งค่า')
                )
                : tx('ยังไม่มีบันทึก — ถือว่ายังไม่ยินยอม')}
            </span>
            <span className="muted-inline">
              {tx('ไม่มีผลกับอีเมลยืนยันการสมัคร ใบเสร็จ หรือแจ้งเตือนความปลอดภัย')}
            </span>
          </div>
          <input
            id="acct-marketing"
            type="checkbox"
            role="switch"
            className="acct-switch"
            checked={Boolean(marketing?.granted)}
            disabled={busy === 'marketing'}
            onChange={async (e) => {
              const next = e.target.checked;
              setBusy('marketing');
              const r = await onSetMarketingConsent(next);
              setBusy(null);
              notify(
                r.ok,
                r.ok
                  ? next
                    ? tx('เปิดรับข่าวสารทางอีเมลแล้ว')
                    : tx('ยกเลิกรับข่าวสารทางอีเมลแล้ว')
                  : tx(r.error ?? 'ไม่สามารถบันทึกได้')
              );
            }}
          />
        </div>

        {docRow(tx('ข้อกำหนดการใช้งาน'), terms)}
        {docRow(tx('นโยบายความเป็นส่วนตัว'), privacy)}

        <div className="acct-setting-row">
          <div className="acct-setting-text">
            <strong>{tx('กติกาของแต่ละงานวิ่ง')}</strong>
            <span className="muted-inline">
              {tx('ยอมรับแยกตอนสมัครแต่ละงาน ดูได้ในใบสมัครของงานนั้น')}
            </span>
          </div>
          <button type="button" className="btn-secondary" onClick={onOpenRaceHistory}>
            <span>{tx('ดูใบสมัคร')}</span>
            <IconArrowRight size={15} />
          </button>
        </div>
      </section>

      <section className="acct-section" aria-labelledby="acct-mydata">
        <h3 id="acct-mydata">{tx('ข้อมูลของฉัน')}</h3>

        <div className="acct-setting-row">
          <div className="acct-setting-text">
            <strong>{tx('ขอสำเนาข้อมูลของฉัน')}</strong>
            <span className="muted-inline">
              {tx('ดาวน์โหลดไฟล์ JSON ของข้อมูลบัญชี โปรไฟล์ ช่องทางเข้าสู่ระบบ ประวัติการเข้าใช้ การยินยอม และใบสมัครของคุณ (ไม่รวมรหัสผ่าน)')}
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy === 'export'}
            onClick={async () => {
              setBusy('export');
              const r = await onExportMyData();
              setBusy(null);
              notify(
                r.ok,
                r.ok ? tx('ดาวน์โหลดสำเนาข้อมูลแล้ว') : tx(r.error ?? 'ไม่สามารถดาวน์โหลดได้')
              );
            }}
          >
            <IconDownload size={15} />
            <span>{tx('ดาวน์โหลด')}</span>
          </button>
        </div>

        <div className="acct-setting-row">
          <div className="acct-setting-text">
            <strong>{tx('ระยะเวลาเก็บข้อมูล')}</strong>
            <span className="muted-inline">
              {tx('ยังไม่ได้กำหนดนโยบายระยะเวลาเก็บข้อมูล (รอยืนยัน) รายการชำระเงินและใบสมัครที่ชำระแล้วจะถูกเก็บไว้ตามกฎหมายแม้ลบบัญชี')}
            </span>
          </div>
        </div>
      </section>

      {securitySections}
    </div>
  );
};
