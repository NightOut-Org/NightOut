import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type * as C from '@nightout/contracts';
import {
  OAUTH_PROVIDER_LABEL,
  PRIVACY_VERSION,
  TERMS_VERSION,
  facebookBirthdate,
  googleBirthdate,
  isAtLeastAge,
  isOAuthProvider,
  type GoogleBirthday,
  type OAuthProvider,
} from '@nightout/utils';
import { SupabaseService, type AuthAdminUser } from '../../supabase/supabase.service';

/** key ใน auth.users.app_metadata (ผู้ใช้แก้เองไม่ได้) — วันเกิดที่ backend ดึงจากผู้ให้บริการ รอผู้ใช้ยอมรับเงื่อนไข */
const PENDING_KEY = 'nightout_oauth_age';
/** ยืนยันอายุแล้วต้องกดยอมรับเงื่อนไขภายในเวลานี้ ไม่งั้นต้องล็อกอินใหม่ (ดึงวันเกิดใหม่) */
const PENDING_TTL_MS = 30 * 60_000;
const PROVIDER_TIMEOUT_MS = 8_000;

interface PendingAge {
  birthdate: string;
  provider: OAuthProvider;
  verified_at: string;
}

/**
 * สมัครด้วย Google / Facebook (REQUIREMENTS ข้อ 3)
 * ล็อกอิน OAuth ครั้งแรก → trigger ไม่สร้าง public.users → verify ดึงวันเกิดจากผู้ให้บริการ (อายุไม่ผ่าน = ลบบัญชี Auth)
 * → complete หลังผู้ใช้ยอมรับ ToS + PDPA (rpc app_complete_oauth_signup) · cancel = ไม่ยอมรับ → ลบบัญชี Auth
 */
@Injectable()
export class AccountOAuthService {
  private readonly log = new Logger('OAuthSignup');

  constructor(private readonly db: SupabaseService) {}

  async verify(userId: string, providerToken: string | null | undefined): Promise<C.OAuthSignupVerifyResult> {
    const user = await this.authUser(userId);
    const provider = providerOf(user);
    const result = (status: C.OAuthSignupVerifyResult['status']): C.OAuthSignupVerifyResult => ({
      status,
      provider,
      email: user.email ?? '',
      display_name: displayNameOf(user),
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    });

    if (await this.hasProfile(userId)) return result('REGISTERED');
    if (!provider) throw new BadRequestException('OAUTH_PROVIDER_UNSUPPORTED');
    if (!user.email) return this.reject(userId, 'OAUTH_EMAIL_MISSING');

    if (!providerToken) {
      if (pendingOf(user)) return result('NEEDS_CONSENT');
      throw new ConflictException('OAUTH_RELOGIN_REQUIRED');
    }

    const birthdate = await this.fetchBirthdate(provider, providerToken, providerUserIdOf(user, provider));
    if (!birthdate) return this.reject(userId, 'OAUTH_BIRTHDATE_MISSING');
    if (!isAtLeastAge(birthdate)) return this.reject(userId, 'OAUTH_AGE_UNDER_20');

    const pending: PendingAge = { birthdate, provider, verified_at: new Date().toISOString() };
    await this.db.updateAuthAppMetadata(userId, { [PENDING_KEY]: pending });
    return result('NEEDS_CONSENT');
  }

  async complete(userId: string, body: C.OAuthSignupCompleteBody): Promise<C.OAuthSignupCompleteResult> {
    if (await this.hasProfile(userId)) return { id: userId, created: false };
    const user = await this.authUser(userId);
    const pending = pendingOf(user);
    if (!pending) throw new ConflictException('OAUTH_RELOGIN_REQUIRED');

    const r = await this.db.rpc<C.OAuthSignupCompleteResult>('app_complete_oauth_signup', {
      p_actor: userId,
      p_birthdate: pending.birthdate,
      p_method: pending.provider.toUpperCase(),
      p_display_name: body.display_name ?? displayNameOf(user),
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
    });
    // วันเกิดอยู่ใน public.users แล้ว — ล้างของที่พักไว้ (ล้างไม่ได้ไม่กระทบบัญชี)
    await this.db.updateAuthAppMetadata(userId, { [PENDING_KEY]: null }).catch((e: Error) => this.log.warn(e.message));
    return r;
  }

  /** ไม่ยอมรับเงื่อนไข / ยืนยันอายุไม่ผ่าน → ลบบัญชี Auth ที่ยังไม่มีโปรไฟล์ (บัญชีที่สร้างแล้วไม่แตะ) */
  async cancel(userId: string): Promise<C.OAuthSignupCancelResult> {
    if (await this.hasProfile(userId)) return { deleted: false };
    await this.db.deleteAuthUser(userId);
    return { deleted: true };
  }

  private async authUser(userId: string): Promise<AuthAdminUser> {
    const user = await this.db.getAuthUserById(userId);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }

  private async hasProfile(userId: string): Promise<boolean> {
    const rows = await this.db.select<{ id: string }[]>(`users?select=id&id=eq.${userId}`);
    return rows.length > 0;
  }

  /** ยืนยันอายุไม่ผ่าน = ไม่สร้างบัญชี → ลบบัญชี Auth ที่ Supabase สร้างไว้ตอนล็อกอิน แล้วแจ้งเหตุ */
  private async reject(userId: string, code: keyof typeof C.ACCOUNT_ERRORS): Promise<never> {
    await this.db.deleteAuthUser(userId);
    throw new ForbiddenException(code);
  }

  private async fetchBirthdate(provider: OAuthProvider, token: string, expectedId: string | null): Promise<string | null> {
    if (provider === 'google') {
      const body = await this.callProvider<{ resourceName?: string; birthdays?: GoogleBirthday[] }>(
        provider,
        'https://people.googleapis.com/v1/people/me?personFields=birthdays',
        token,
      );
      this.assertSameAccount(body.resourceName?.replace(/^people\//, ''), expectedId);
      return googleBirthdate(body.birthdays);
    }
    const body = await this.callProvider<{ id?: string; birthday?: string }>(
      provider,
      'https://graph.facebook.com/me?fields=id,birthday',
      token,
    );
    this.assertSameAccount(body.id, expectedId);
    return facebookBirthdate(body.birthday);
  }

  /** token ต้องเป็นของบัญชีผู้ให้บริการเดียวกับที่ล็อกอิน (กันส่ง token ของคนอื่นมาแทน) */
  private assertSameAccount(actual: string | undefined, expected: string | null) {
    if (!actual || !expected || actual !== expected) throw new ForbiddenException('OAUTH_TOKEN_MISMATCH');
  }

  private async callProvider<T>(provider: OAuthProvider, url: string, token: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
    } catch (e) {
      this.log.warn(`ติดต่อ ${OAUTH_PROVIDER_LABEL[provider]} ไม่ได้: ${(e as Error).message}`);
      throw new BadGatewayException('OAUTH_PROVIDER_UNAVAILABLE');
    }
    if (res.status === 401) throw new UnauthorizedException('OAUTH_RELOGIN_REQUIRED');
    if (!res.ok) {
      this.log.warn(`${OAUTH_PROVIDER_LABEL[provider]} ตอบ ${res.status}: ${(await res.text()).slice(0, 200)}`);
      throw new BadGatewayException('OAUTH_PROVIDER_UNAVAILABLE');
    }
    return (await res.json()) as T;
  }
}

/** ผู้ให้บริการที่ใช้สมัคร (app_metadata.provider ตั้งโดย Supabase Auth) */
function providerOf(user: AuthAdminUser): OAuthProvider | null {
  const p = user.app_metadata?.provider;
  return isOAuthProvider(p) ? p : null;
}

/** รหัสผู้ใช้ฝั่ง Google (sub) / Facebook (id) ของบัญชีที่ล็อกอิน */
function providerUserIdOf(user: AuthAdminUser, provider: OAuthProvider): string | null {
  const identity = user.identities?.find((i) => i.provider === provider);
  const sub = identity?.identity_data?.sub ?? identity?.identity_data?.provider_id ?? identity?.id;
  return typeof sub === 'string' && sub ? sub : null;
}

function pendingOf(user: AuthAdminUser): PendingAge | null {
  const p = user.app_metadata?.[PENDING_KEY] as Partial<PendingAge> | null | undefined;
  if (!p?.birthdate || !isOAuthProvider(p.provider) || !p.verified_at) return null;
  if (Date.now() - Date.parse(p.verified_at) > PENDING_TTL_MS) return null;
  return p as PendingAge;
}

function displayNameOf(user: AuthAdminUser): string {
  const m = user.user_metadata ?? {};
  const name = [m.full_name, m.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  return (name?.trim() ?? (user.email ?? '').split('@')[0] ?? '').slice(0, 60);
}
