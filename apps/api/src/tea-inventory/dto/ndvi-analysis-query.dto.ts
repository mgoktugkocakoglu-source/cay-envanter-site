import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class NdviAnalysisQueryDto {
    @ApiPropertyOptional({ description: 'Archive year; defaults to the latest available year' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(2017)
    @Max(2100)
    year?: number;
}
