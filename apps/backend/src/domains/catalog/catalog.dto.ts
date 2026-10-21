import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class RankingQueryDto extends createZodDto(C.RankingQuery) {}
export class AreaAtPointQueryDto extends createZodDto(C.AreaAtPointQuery) {}
export class TambonSearchQueryDto extends createZodDto(C.TambonSearchQuery) {}
export class SaveStylesDto extends createZodDto(C.SaveStylesBody) {}
