import { useState, type FormEvent } from 'react';
import { tx } from '../i18n';
import { IconAlert, IconShield } from '../components/Icons';

/**
 * Sign-in for the Platform Owner console. Email and password only (no social sign-in, no
 * demo switcher); the server accepts Platform Owner accounts only and issues an admin session
 * that is separate from the public site's.
 */
export function AdminLogin({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(tx('กรอกอีเมลและรหัสผ่านให้ครบ'));
      return;
    }
    setBusy(true);
    setError('');
    const err = await onSubmit(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <main className="admin-login">
      <form className="admin-login-card" onSubmit={submit} noValidate>
        <span className="admin-login-icon" aria-hidden="true">
          <IconShield size={28} />
        </span>
        <h1>{tx('ศูนย์ควบคุม Platform Owner')}</h1>
        <p className="muted-block">
          {tx('ระบบแยกจากเว็บไซต์หลัก ต้องเข้าสู่ระบบที่นี่ด้วยบัญชี Platform Owner เท่านั้น')}
        </p>
        <div className="form-row">
          <label htmlFor="admin-email">{tx('อีเมล')}</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="admin-password">{tx('รหัสผ่าน')}</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div className="error-callout" role="alert">
            <IconAlert size={16} />
            <span>{error}</span>
          </div>
        )}
        <button type="submit" className="btn-primary btn-full" disabled={busy}>
          {busy ? tx('กำลังเข้าสู่ระบบ…') : tx('เข้าสู่ระบบศูนย์ควบคุม')}
        </button>
      </form>
    </main>
  );
}
