import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class SaveHomePageDto extends createZodDto(C.SaveHomePageBody) {}
