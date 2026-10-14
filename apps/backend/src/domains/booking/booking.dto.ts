import * as C from '@nightout/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateBookingDto extends createZodDto(C.CreateBookingBody) {}
export class CancelBookingDto extends createZodDto(C.CancelBookingBody) {}
export class TeamBookingStatusDto extends createZodDto(C.TeamBookingStatusBody) {}
export class MoveBookingDto extends createZodDto(C.MoveBookingBody) {}
export class CheckInDto extends createZodDto(C.CheckInBody) {}
export class CheckInPreviewQueryDto extends createZodDto(C.CheckInPreviewQuery) {}
export class ReportNoTableDto extends createZodDto(C.ReportNoTableBody) {}
export class ZoneAvailabilityQueryDto extends createZodDto(C.ZoneAvailabilityQuery) {}
export class TableBoardQueryDto extends createZodDto(C.TableBoardQuery) {}
export class TableOccupancyDto extends createZodDto(C.TableOccupancyBody) {}
export class SalesStatsQueryDto extends createZodDto(C.SalesStatsQuery) {}
