import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class MiniAdsQueryDto extends createZodDto(C.MiniAdsQuery) {}
export class TrackMiniAdDto extends createZodDto(C.TrackMiniAdBody) {}
export class CreateMiniAdDto extends createZodDto(C.MiniAdBody) {}
export class UpdateMiniAdDto extends createZodDto(C.UpdateMiniAdBody) {}
