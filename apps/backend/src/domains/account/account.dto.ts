import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateProfileDto extends createZodDto(C.UpdateProfileBody) {}
export class MarkReadDto extends createZodDto(C.MarkReadBody) {}
export class CreateUserDto extends createZodDto(C.CreateUserBody) {}
export class UpdateUserAccountDto extends createZodDto(C.UpdateUserAccountBody) {}
export class SetUsersRoleDto extends createZodDto(C.SetUsersRoleBody) {}
export class UnbanUserDto extends createZodDto(C.UnbanUserBody) {}
export class BanUserDto extends createZodDto(C.BanUserBody) {}
export class OAuthSignupVerifyDto extends createZodDto(C.OAuthSignupVerifyBody) {}
export class OAuthSignupCompleteDto extends createZodDto(C.OAuthSignupCompleteBody) {}
