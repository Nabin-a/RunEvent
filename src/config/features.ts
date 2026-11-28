/**
 * Feature switches for the local build.
 *
 * emailVerification — shelved 20 Nov 2026 (user request). While false:
 *   - no "verified / pending verification" badges or OTP flow (/verify-email redirects to /profile)
 *   - a saved contact email is enough for registration and profile completion
 *   - the security tab saves the contact email directly instead of opening the OTP page
 * Flip back to true to restore the full OTP verification flow; the code paths are kept intact.
 */
export const FEATURES = {
  emailVerification: false,
} as const;
