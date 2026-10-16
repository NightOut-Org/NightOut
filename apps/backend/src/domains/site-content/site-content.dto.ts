import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class SaveSiteNavDto extends createZodDto(C.SaveSiteNavBody) {}
