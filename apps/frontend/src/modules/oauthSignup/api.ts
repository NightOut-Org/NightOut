import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';

/** API ของหน้าสมัครด้วย Google / Facebook · backend: domains/account (account.me.controller) */

/** POST /me/oauth-signup/verify — backend ดึงวันเกิดจาก Google/Facebook ด้วย provider_token แล้วตรวจอายุ 20+ */
export const verifyOAuthSignup = (providerToken: string | null | undefined) =>
  Rest.post<C.OAuthSignupVerifyResult>('/me/oauth-signup/verify', {
    provider_token: providerToken ?? null,
  } satisfies C.OAuthSignupVerifyBody);

/** POST /me/oauth-signup/complete — ยอมรับ ToS + PDPA → สร้างบัญชี */
export const completeOAuthSignup = (displayName: string) =>
  Rest.post<C.OAuthSignupCompleteResult>('/me/oauth-signup/complete', {
    accept_terms: true,
    display_name: displayName.trim() || undefined,
  } satisfies C.OAuthSignupCompleteBody);

/** DELETE /me/oauth-signup — ไม่ยอมรับ / ยืนยันไม่ผ่าน → ลบบัญชี Auth ที่ยังไม่มีโปรไฟล์ */
export const cancelOAuthSignup = () => Rest.delete<C.OAuthSignupCancelResult>('/me/oauth-signup');
