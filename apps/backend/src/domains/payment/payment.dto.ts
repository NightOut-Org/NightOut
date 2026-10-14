import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class MockCompleteDto extends createZodDto(C.MockCompleteBody) {}
export class MarkPaymentRefundedDto extends createZodDto(C.MarkPaymentRefundedBody) {}
