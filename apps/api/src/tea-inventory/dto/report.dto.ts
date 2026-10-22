import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Query params of the evidence / season report downloads. */
export class ReportQueryDto {
    @ApiPropertyOptional({ description: 'Pruning season, e.g. 2025-26 (default: latest scanned)' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    season?: string;
}
