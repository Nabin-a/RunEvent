import React, { useState } from 'react';
import {
  AuthProviderType,
  Organization,
  ReturnIntent,
  TeamInvitation,
  UserAccount,
} from '../types';
import {
  IconAlert,
  IconArrowRight,
  IconBuilding,
  IconCheckCircle,
  IconDevice,
  IconEye,
  IconEyeOff,
  IconGoogleMark,
  IconLineMark,
  IconLock,
  IconMail,
} from './Icons';

interface AuthScreenProps {
  users: UserAccount[];
  currentUser: UserAccount | null;
  returnIntent: ReturnIntent | null;
  initialTab?: 'signin' | 'signup' | 'forgot';
  externalSocialScenario?: {
    seq: number;
    provider: 'google' | 'line';
    scenario: 'new_no_email' | 'collision' | 'cancelled';
  } | null;
  onAuthenticated: (user: UserAccount, preferredOrgId?: string) => void;
  onRegisterEmailUser: (payload: {
    fullNameTh: string;
    email: string;
    marketingConsent: boolean;
  }) => { ok: boolean; error?: string; user?: UserAccount };
  onRegisterSocialUser: (payload: {
    provider: 'google' | 'line';
    fullNameTh: string;
    email: string | null;
    marketingConsent: boolean;
  }) => UserAccount;
  onLogout: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  users,
  currentUser,
  returnIntent,
  initialTab = 'signin',
  externalSocialScenario,
  onAuthenticated,
  onRegisterEmailUser,
  onRegisterSocialUser,
  onLogout,
}) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'forgot'>(
    initialTab
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign up fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Social OAuth simulation flow state
  const [socialPendingStep, setSocialPendingStep] = useState<
    | null
    | {
        mode: 'new_line_no_email' | 'email_collision_verify' | 'provider_cancelled';
        provider: 'google' | 'line';
        tempName: string;
        collisionUser?: UserAccount;
      }
  >(null);
  const [socialTermsAccepted, setSocialTermsAccepted] = useState(false);
  const [collisionPasswordCheck, setCollisionPasswordCheck] = useState('');

  // Forgot password simulation
  const [resetRequestedEmail, setResetRequestedEmail] = useState<string | null>(
    null
  );
  const [resetDoneBanner, setResetDoneBanner] = useState(false);

  const [statusAlert, setStatusAlert] = useState<{
    tone: 'ok' | 'err' | 'warn';
    text: string;
  } | null>(null);

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setSocialPendingStep(null);
    const normalized = email.trim().toLowerCase();
    const matched = users.find(
      (u) => (u.contactEmail ?? '').toLowerCase() === normalized
    );
    if (!matched || !matched.hasPassword) {
      setStatusAlert({
        tone: 'err',
        text: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากสมัครไว้ด้วย LINE หรือ Google อย่างเดียว กรุณาเข้าสู่ระบบด้วยปุ่มช่องทางนั้น)',
      });
      return;
    }
    if (!password.trim()) {
      setStatusAlert({ tone: 'err', text: 'กรุณากรอกรหัสผ่าน' });
      return;
    }
    setStatusAlert(null);
    onAuthenticated(matched, matched.memberships[0]?.organizationId);
  };

  const handleEmailSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      setStatusAlert({
        tone: 'err',
        text: 'ต้องยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวก่อนสร้างบัญชี',
      });
      return;
    }
    if (regPass.length < 8) {
      setStatusAlert({
        tone: 'err',
        text: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร',
      });
      return;
    }
    const res = onRegisterEmailUser({
      fullNameTh: regName.trim(),
      email: regEmail.trim(),
      marketingConsent: marketingOptIn,
    });
    if (!res.ok || !res.user) {
      setStatusAlert({
        tone: 'err',
        text: res.error ?? 'ไม่สามารถสร้างบัญชีได้',
      });
      return;
    }
    onAuthenticated(res.user);
  };

  const handleSocialButton = (
    provider: 'google' | 'line',
    scenario: 'existing' | 'new_no_email' | 'collision' | 'cancelled'
  ) => {
    setStatusAlert(null);
    if (scenario === 'cancelled') {
      setSocialPendingStep({
        mode: 'provider_cancelled',
        provider,
        tempName: '',
      });
      return;
    }
    if (scenario === 'existing') {
      const existing = users.find((u) =>
        u.identities.some((id) => id.provider === provider)
      );
      if (existing) {
        onAuthenticated(existing, existing.memberships[0]?.organizationId);
      }
      return;
    }
    if (scenario === 'new_no_email') {
      setSocialTermsAccepted(false);
      setSocialPendingStep({
        mode: 'new_line_no_email',
        provider: 'line',
        tempName: 'วรินทร สายลมเหนือ',
      });
      return;
    }
    if (scenario === 'collision') {
      const targetCollision =
        users.find((u) => u.id === 'usr-manager') ?? users[0];
      setCollisionPasswordCheck('');
      setSocialPendingStep({
        mode: 'email_collision_verify',
        provider: 'google',
        tempName: targetCollision.fullNameTh,
        collisionUser: targetCollision,
      });
    }
  };

  React.useEffect(() => {
    setAuthTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    if (externalSocialScenario) {
      setAuthTab('signin');
      handleSocialButton(
        externalSocialScenario.provider,
        externalSocialScenario.scenario
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSocialScenario?.seq]);

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetRequestedEmail(email.trim());
    setResetDoneBanner(false);
  };

  return (
    <main className="auth-page-shell auth-single-shell">
      {returnIntent && (
        <div className="intent-return-banner" role="status">
          <IconArrowRight size={16} />
          <span>
            กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ: <strong>{returnIntent.label}</strong>
          </span>
        </div>
      )}

      <div className="auth-centered-wrap">
        <section
          className="clean-panel auth-primary-card"
          aria-label="เข้าสู่ระบบหรือสมัครสมาชิก RunEvent"
        >
          <div className="auth-card-head">
            <h1>เข้าสู่ระบบ RunEvent</h1>
            <p className="muted-block">
              บัญชีเดียวใช้งานได้ครบทั้งสมัครงานวิ่ง ซื้อสินค้าที่ระลึก และจัดการงานสำหรับทีมผู้จัดที่ได้รับสิทธิ์
            </p>
          </div>

          {currentUser && (
            <div className="active-session-box">
              <div className="session-box-row">
                <IconCheckCircle size={18} />
                <div>
                  <strong>เข้าสู่ระบบอยู่: {currentUser.fullNameTh}</strong>
                  <div className="muted-inline">
                    {currentUser.contactEmail ??
                      'ยังไม่ได้เพิ่มอีเมลติดต่อ (เข้าผ่าน LINE)'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={onLogout}
              >
                ออกจากระบบ
              </button>
            </div>
          )}

          <div className="pill-tabs-bar" role="tablist" aria-label="โหมดการเข้าใช้งาน">
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'signin'}
              className={`pill-tab ${authTab === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setAuthTab('signin');
                setStatusAlert(null);
              }}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'signup'}
              className={`pill-tab ${authTab === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setAuthTab('signup');
                setStatusAlert(null);
              }}
            >
              สมัครสมาชิกใหม่
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authTab === 'forgot'}
              className={`pill-tab ${authTab === 'forgot' ? 'active' : ''}`}
              onClick={() => {
                setAuthTab('forgot');
                setStatusAlert(null);
              }}
            >
              ลืมรหัสผ่าน
            </button>
          </div>

          {statusAlert && (
            <div
              className={
                statusAlert.tone === 'ok'
                  ? 'success-callout'
                  : 'error-callout'
              }
              role="alert"
            >
              <IconAlert size={16} />
              <span>{statusAlert.text}</span>
            </div>
          )}

          {authTab === 'signin' && (
            <>
              <div className="social-buttons-stack">
                <button
                  type="button"
                  className="btn-social btn-social-google"
                  onClick={() => handleSocialButton('google', 'existing')}
                >
                  <IconGoogleMark size={18} />
                  <span>ดำเนินการต่อด้วย Google</span>
                </button>

                <button
                  type="button"
                  className="btn-social btn-social-line"
                  onClick={() => handleSocialButton('line', 'existing')}
                >
                  <IconLineMark size={18} />
                  <span>ดำเนินการต่อด้วย LINE</span>
                </button>
              </div>

              {socialPendingStep?.mode === 'provider_cancelled' && (
                <div className="status-explanation-banner" role="alert">
                  <IconAlert size={16} />
                  <span>
                    การยืนยันตัวตนผ่าน {socialPendingStep.provider.toUpperCase()}{' '}
                    ถูกยกเลิกหรือหมดเวลา (Callback State Expired) —
                    ยังไม่มีการสร้างหรือเปลี่ยนสถานะบัญชี กรุณาเลือกวิธีเข้าสู่ระบบอีกครั้ง
                  </span>
                </div>
              )}

              {socialPendingStep?.mode === 'new_line_no_email' && (
                <div className="social-onboarding-box">
                  <h2>ตั้งค่าบัญชีใหม่จาก LINE (กรณี LINE ไม่ส่งอีเมล)</h2>
                  <p className="muted-block">
                    ระบบสร้างบัญชีจากรหัสตัวตน LINE ที่ตรวจสอบแล้วโดยไม่สร้างอีเมลสมมติแทน
                    คุณสามารถเพิ่มและยืนยันอีเมลภายหลังเมื่อต้องการรับใบเสร็จหรือคำเชิญทีม
                  </p>
                  <div className="form-row">
                    <label htmlFor="line-new-name">
                      ชื่อที่ใช้แสดงในบัญชี (ชื่อจริงสำหรับแข่งขันจะถามแยกเมื่อสมัครงานวิ่ง)
                    </label>
                    <input
                      id="line-new-name"
                      type="text"
                      value={socialPendingStep.tempName}
                      onChange={(e) =>
                        setSocialPendingStep({
                          ...socialPendingStep,
                          tempName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={socialTermsAccepted}
                      onChange={(e) => setSocialTermsAccepted(e.target.checked)}
                    />
                    <span>ยอมรับข้อกำหนดการใช้งานแพลตฟอร์ม (v1.0)</span>
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!socialTermsAccepted}
                    onClick={() => {
                      const created = onRegisterSocialUser({
                        provider: 'line',
                        fullNameTh:
                          socialPendingStep.tempName.trim() || 'ผู้ใช้ LINE ใหม่',
                        email: null,
                        marketingConsent: false,
                      });
                      setSocialPendingStep(null);
                      onAuthenticated(created);
                    }}
                  >
                    ยืนยันสร้างบัญชีและเข้าใช้งาน
                  </button>
                </div>
              )}

              {socialPendingStep?.mode === 'email_collision_verify' &&
                socialPendingStep.collisionUser && (
                  <div className="social-onboarding-box">
                    <h2>พบอีเมลตรงกับบัญชีเดิม — ต้องยืนยันเจ้าของก่อนเชื่อม</h2>
                    <p className="muted-block">
                      อีเมล{' '}
                      <strong>
                        {socialPendingStep.collisionUser.contactEmail}
                      </strong>{' '}
                      มีบัญชีอยู่แล้ว ระบบจะ<strong>ไม่รวมบัญชีอัตโนมัติ</strong>{' '}
                      กรุณากรอกรหัสผ่านของบัญชีเดิมเพื่อยืนยันความเป็นเจ้าของก่อนผูก Google
                    </p>
                    <div className="form-row">
                      <label htmlFor="collision-pass">
                        รหัสผ่านบัญชีเดิม (ทดสอบใช้รหัส <code>demo1234</code>)
                      </label>
                      <input
                        id="collision-pass"
                        type="password"
                        value={collisionPasswordCheck}
                        onChange={(e) =>
                          setCollisionPasswordCheck(e.target.value)
                        }
                      />
                    </div>
                    <div className="cta-inline-row">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          if (!collisionPasswordCheck.trim()) return;
                          const target = socialPendingStep.collisionUser!;
                          setSocialPendingStep(null);
                          onAuthenticated(
                            target,
                            target.memberships[0]?.organizationId
                          );
                        }}
                      >
                        ยืนยันรหัสผ่านและเข้าสู่บัญชีเดิม
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => setSocialPendingStep(null)}
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}

              <div className="divider-line-text">
                <span>หรือใช้อีเมลและรหัสผ่าน</span>
              </div>

              <form onSubmit={handleEmailSignIn} className="auth-cred-form">
                <div className="form-row">
                  <label htmlFor="signin-email">อีเมล</label>
                  <input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="form-row">
                  <label htmlFor="signin-pass">รหัสผ่าน</label>
                  <div className="password-field-wrap">
                    <input
                      id="signin-pass"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านของคุณ"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-eye-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'
                      }
                    >
                      {showPassword ? (
                        <IconEyeOff size={17} />
                      ) : (
                        <IconEye size={17} />
                      )}
                      <span>{showPassword ? 'ซ่อน' : 'แสดง'}</span>
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-primary btn-full">
                  <IconLock size={16} />
                  <span>เข้าสู่ระบบด้วยอีเมล</span>
                </button>
              </form>
            </>
          )}

          {authTab === 'signup' && (
            <form onSubmit={handleEmailSignUp} className="auth-cred-form">
              <div className="form-row">
                <label htmlFor="reg-name">ชื่อ-นามสกุลผู้ใช้งาน</label>
                <input
                  id="reg-name"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="เช่น ณัฐธิดา เจริญสุข"
                  required
                />
              </div>

              <div className="form-row">
                <label htmlFor="reg-email">อีเมลสำหรับยืนยันบัญชี</label>
                <input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="form-row">
                <label htmlFor="reg-pass">ตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
                <input
                  id="reg-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  required
                />
              </div>

              <div className="consent-group">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>
                    <strong>[จำเป็น]</strong> ยอมรับข้อกำหนดการใช้งานและนโยบายข้อมูลส่วนบุคคล (v1.0)
                  </span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                  />
                  <span>
                    [ไม่บังคับ — แยกจากข้อกำหนดหลัก] รับข่าวสารงานวิ่งและโปรโมชันจากแพลตฟอร์ม
                  </span>
                </label>
              </div>

              <button type="submit" className="btn-primary btn-full">
                สร้างบัญชีใหม่ (ต้องยืนยันอีเมลในหน้าถัดไป)
              </button>
            </form>
          )}

          {authTab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="auth-cred-form">
              <p className="muted-block">
                กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่แบบใช้ครั้งเดียว
                (ระบบตอบข้อความเดียวกันเสมอเพื่อไม่เปิดเผยว่าอีเมลใดมีอยู่ในระบบ)
              </p>
              <div className="form-row">
                <label htmlFor="forgot-email">อีเมลที่ลงทะเบียน</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary btn-full">
                <IconMail size={16} />
                <span>ส่งลิงก์รีเซ็ตรหัสผ่าน</span>
              </button>

              {resetRequestedEmail && !resetDoneBanner && (
                <div className="status-explanation-banner" role="status">
                  <div>
                    <strong>
                      หากอีเมล {resetRequestedEmail} มีอยู่ในระบบ
                      เราได้ส่งลิงก์รีเซ็ตที่มีอายุ 15 นาทีไปให้แล้ว
                    </strong>
                    <div style={{ marginTop: '0.45rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setResetDoneBanner(true)}
                      >
                        เปิดลิงก์ยืนยันตั้งรหัสผ่านใหม่จากอีเมล
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {resetDoneBanner && (
                <div className="success-callout" role="status">
                  <IconCheckCircle size={17} />
                  <span>
                    ตั้งรหัสผ่านใหม่สำเร็จ และเพิกถอนลิงก์รีเซ็ตเดิมเรียบร้อยแล้ว
                    สามารถกลับไปแท็บเข้าสู่ระบบได้ทันที
                  </span>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
};

/* ================= ACCOUNT & SECURITY VIEW (SECTION 16.3) ================= */

interface AccountSecurityViewProps {
  user: UserAccount;
  organizations: Organization[];
  invitations: TeamInvitation[];
  onVerifyContactEmail: (email: string) => void;
  onSetOrChangePassword: () => void;
  onLinkProvider: (provider: 'google' | 'line') => void;
  onUnlinkProvider: (
    provider: AuthProviderType
  ) => { ok: boolean; error?: string };
  onRevokeOtherSessions: () => void;
  onAcceptTeamInvitation: (
    inviteCode: string
  ) => { ok: boolean; message: string };
  onApplyNewOrganizerOrg: (
    orgNameTh: string,
    province: string
  ) => Organization;
  onEnterOrganizerOrg: (orgId: string) => void;
}

export const AccountSecurityView: React.FC<AccountSecurityViewProps> = ({
  user,
  organizations,
  invitations,
  onVerifyContactEmail,
  onSetOrChangePassword,
  onLinkProvider,
  onUnlinkProvider,
  onRevokeOtherSessions,
  onAcceptTeamInvitation,
  onApplyNewOrganizerOrg,
  onEnterOrganizerOrg,
}) => {
  const [emailDraft, setEmailDraft] = useState(user.contactEmail ?? '');
  const [inviteInput, setInviteInput] = useState('INV-LANNA-STAFF26');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgProv, setNewOrgProv] = useState('ขอนแก่น');
  const [feedback, setFeedback] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  const hasGoogle = user.identities.some((i) => i.provider === 'google');
  const hasLine = user.identities.some((i) => i.provider === 'line');
  const otherSessionsCount = user.sessions.filter(
    (s) => !s.isCurrentDevice
  ).length;

  return (
    <main className="customer-container">
      <div className="hub-header-bar">
        <div>
          <h1>บัญชีและความปลอดภัย ({user.fullNameTh})</h1>
          <p className="muted-block">
            จัดการอีเมลติดต่อ รหัสผ่าน ช่องทางเข้าสู่ระบบที่เชื่อมไว้ (Google / LINE)
            รายการอุปกรณ์ที่เข้าสู่ระบบ และการเข้าร่วมทีมผู้จัดงานด้วยบัญชีเดียว
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={
            feedback.tone === 'ok' ? 'success-callout' : 'error-callout'
          }
          role="status"
        >
          {feedback.tone === 'ok' ? (
            <IconCheckCircle size={17} />
          ) : (
            <IconAlert size={17} />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="security-grid">
        {/* Contact Email & Password */}
        <section className="clean-panel">
          <h2>อีเมลติดต่อและรหัสผ่าน</h2>
          <p className="muted-inline">
            สถานะปัจจุบัน:{' '}
            {user.contactEmail ? (
              user.emailVerified ? (
                <strong className="text-forest">
                  ยืนยันอีเมลแล้ว ({user.contactEmail})
                </strong>
              ) : (
                <strong className="text-amber">
                  รอยืนยันลิงก์ในอีเมล ({user.contactEmail})
                </strong>
              )
            ) : (
              <strong className="text-amber">
                ยังไม่มีอีเมลติดต่อ (เข้าผ่าน LINE — กรุณาเพิ่มอีเมลเพื่อรับใบเสร็จ)
              </strong>
            )}
          </p>

          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <label htmlFor="sec-email">อีเมลติดต่อสำหรับรับใบยืนยันและใบเสร็จ</label>
            <div className="cta-inline-row">
              <input
                id="sec-email"
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="ระบุอีเมลของคุณ..."
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!emailDraft.trim()) return;
                  onVerifyContactEmail(emailDraft.trim());
                  setFeedback({
                    tone: 'ok',
                    text: `บันทึกและยืนยันอีเมล ${emailDraft.trim()} สำเร็จ`,
                  });
                }}
              >
                บันทึกและยืนยันอีเมล
              </button>
            </div>
          </div>

          <div className="security-subblock">
            <div>
              <strong>รหัสผ่านของบัญชี</strong>
              <div className="muted-inline">
                {user.hasPassword
                  ? 'ตั้งรหัสผ่านไว้แล้ว สามารถเปลี่ยนรหัสผ่านใหม่ได้'
                  : 'ยังไม่ได้ตั้งรหัสผ่าน (สมัครผ่าน Social Login)'}
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onSetOrChangePassword();
                setFeedback({
                  tone: 'ok',
                  text: user.hasPassword
                    ? 'เปลี่ยนรหัสผ่านและส่งแจ้งเตือนความปลอดภัยเรียบร้อยแล้ว'
                    : 'เพิ่มรหัสผ่านให้บัญชีสำเร็จ ตอนนี้เข้าสู่ระบบด้วยอีเมล+รหัสผ่านได้แล้ว',
                });
              }}
            >
              {user.hasPassword ? 'เปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่านเพิ่มเติม'}
            </button>
          </div>
        </section>

        {/* Linked Login Methods */}
        <section className="clean-panel">
          <h2>วิธีเข้าสู่ระบบที่เชื่อมอยู่กับบัญชีนี้</h2>
          <p className="muted-block">
            ระบบไม่อนุญาตให้ถอดช่องทางสุดท้ายที่ใช้เข้าสู่ระบบได้ เพื่อป้องกันบัญชีถูกล็อกถาวร
          </p>

          <div className="linked-provider-list">
            <div className="linked-provider-row">
              <div className="persona-identity">
                <IconGoogleMark size={18} />
                <div>
                  <strong>Google Account</strong>
                  <div className="muted-inline">
                    {hasGoogle ? 'เชื่อมต่อกับบัญชีนี้แล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                  </div>
                </div>
              </div>
              {hasGoogle ? (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    const res = onUnlinkProvider('google');
                    setFeedback({
                      tone: res.ok ? 'ok' : 'err',
                      text: res.ok
                        ? 'ถอดการเชื่อมบัญชี Google เรียบร้อยแล้ว'
                        : res.error ?? 'ไม่สามารถถอดช่องทางสุดท้ายได้',
                    });
                  }}
                >
                  ถอดการเชื่อม
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onLinkProvider('google');
                    setFeedback({
                      tone: 'ok',
                      text: 'เชื่อมบัญชี Google เข้ากับบัญชี RunEvent เดิมสำเร็จ',
                    });
                  }}
                >
                  เชื่อม Google เพิ่ม
                </button>
              )}
            </div>

            <div className="linked-provider-row">
              <div className="persona-identity">
                <IconLineMark size={18} />
                <div>
                  <strong>LINE Login</strong>
                  <div className="muted-inline">
                    {hasLine ? 'เชื่อมต่อกับบัญชีนี้แล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
                  </div>
                </div>
              </div>
              {hasLine ? (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    const res = onUnlinkProvider('line');
                    setFeedback({
                      tone: res.ok ? 'ok' : 'err',
                      text: res.ok
                        ? 'ถอดการเชื่อมบัญชี LINE เรียบร้อยแล้ว'
                        : res.error ?? 'ไม่สามารถถอดช่องทางสุดท้ายได้',
                    });
                  }}
                >
                  ถอดการเชื่อม
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onLinkProvider('line');
                    setFeedback({
                      tone: 'ok',
                      text: 'เชื่อมบัญชี LINE เข้ากับบัญชี RunEvent เดิมสำเร็จ',
                    });
                  }}
                >
                  เชื่อม LINE เพิ่ม
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Active Device Sessions */}
        <section className="clean-panel">
          <div className="section-title-bar">
            <h2>อุปกรณ์ที่เข้าสู่ระบบอยู่ ({user.sessions.length})</h2>
            {otherSessionsCount > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onRevokeOtherSessions();
                  setFeedback({
                    tone: 'ok',
                    text: 'ออกจากระบบอุปกรณ์อื่นทั้งหมดเรียบร้อยแล้ว',
                  });
                }}
              >
                ออกจากระบบอุปกรณ์อื่น ({otherSessionsCount})
              </button>
            )}
          </div>

          <div className="linked-provider-list">
            {user.sessions.map((ses) => (
              <div key={ses.id} className="linked-provider-row">
                <div className="persona-identity">
                  <IconDevice size={18} />
                  <div>
                    <strong>{ses.deviceLabel}</strong>
                    <div className="muted-inline">
                      {ses.locationHint} · ใช้งานล่าสุด: {ses.lastActiveAt}
                    </div>
                  </div>
                </div>
                {ses.isCurrentDevice && (
                  <span className="status-pill badge-forest">
                    <IconCheckCircle size={13} />
                    <span>เครื่องนี้</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Organizer Memberships, Single-Use Team Invites & New Organizer Onboarding */}
        <section className="clean-panel">
          <h2>สิทธิ์ทีมผู้จัดงานและคำเชิญเข้าร่วมองค์กร</h2>
          <p className="muted-block">
            บัญชีนักวิ่งเดิมสามารถรับคำเชิญเข้าทีมงานวิ่ง หรือขอเปิดองค์กรผู้จัดใหม่ได้โดยไม่ต้องสมัครบัญชีแยก
          </p>

          {user.memberships.length > 0 && (
            <div className="membership-action-list" style={{ marginBottom: '0.9rem' }}>
              {user.memberships.map((m) => {
                const org = organizations.find(
                  (o) => o.id === m.organizationId
                );
                return (
                  <button
                    key={m.organizationId}
                    type="button"
                    className="btn-org-enter"
                    onClick={() => onEnterOrganizerOrg(m.organizationId)}
                  >
                    <IconBuilding size={15} />
                    <span>
                      เปิดจัดการ <strong>{org?.nameTh}</strong> (สิทธิ์:{' '}
                      <strong>
                        {m.role === 'owner'
                          ? 'เจ้าขององค์กร'
                          : m.role === 'event_manager'
                          ? 'ผู้จัดการงานวิ่ง'
                          : m.role === 'finance'
                          ? 'ฝ่ายการเงิน'
                          : 'เจ้าหน้าที่หน้างาน'}
                      </strong>
                      )
                    </span>
                    <IconArrowRight size={14} />
                  </button>
                );
              })}
            </div>
          )}

          <div className="form-row">
            <label htmlFor="inv-code-input">
              ตอบรับคำเชิญเข้าทีมผู้จัด (รหัสใช้ครั้งเดียว เช่น{' '}
              <code>
                {invitations.find((i) => !i.usedByUserId)?.inviteCode ??
                  'INV-LANNA-STAFF26'}
              </code>
              )
            </label>
            <div className="cta-inline-row">
              <input
                id="inv-code-input"
                type="text"
                className="mono-code"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const res = onAcceptTeamInvitation(inviteInput.trim());
                  setFeedback({
                    tone: res.ok ? 'ok' : 'err',
                    text: res.message,
                  });
                }}
              >
                ยืนยันรับคำเชิญ
              </button>
            </div>
          </div>

          <form
            className="security-subblock"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newOrgName.trim()) return;
              const createdOrg = onApplyNewOrganizerOrg(
                newOrgName.trim(),
                newOrgProv.trim()
              );
              setNewOrgName('');
              setFeedback({
                tone: 'ok',
                text: `สร้างองค์กรผู้จัดใหม่ "${createdOrg.nameTh}" ในสถานะรอตรวจสอบผู้จัดและบัญชีรับเงินแล้ว`,
              });
            }}
          >
            <div style={{ flex: 1 }}>
              <strong>สมัครเปิดองค์กรผู้จัดงานวิ่งใหม่</strong>
              <div className="form-grid-2" style={{ marginTop: '0.45rem' }}>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="ชื่อองค์กร/ชมรมผู้จัดงาน..."
                  aria-label="ชื่อองค์กรผู้จัดใหม่"
                  required
                />
                <input
                  type="text"
                  value={newOrgProv}
                  onChange={(e) => setNewOrgProv(e.target.value)}
                  placeholder="จังหวัด..."
                  aria-label="จังหวัดขององค์กร"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              ส่งคำขอเปิดองค์กร
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};
