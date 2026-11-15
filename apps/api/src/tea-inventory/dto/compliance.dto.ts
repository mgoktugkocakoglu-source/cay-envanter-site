import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { COMPLIANCE_CERTAINTY, COMPLIANCE_OVERALL } from '@/tea-inventory/entities/compliance.types';

export class ComplianceQueryDto {
    @ApiPropertyOptional({ enum: COMPLIANCE_CERTAINTY, description: 'Independent evidence agreement class' })
    @IsOptional()
    @IsIn(COMPLIANCE_CERTAINTY)
    certainty?: (typeof COMPLIANCE_CERTAINTY)[number];

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ enum: COMPLIANCE_OVERALL, description: 'Overall outcome of the parcel' })
    @IsOptional()
    @IsIn(COMPLIANCE_OVERALL)
    overall?: (typeof COMPLIANCE_OVERALL)[number];

    @ApiPropertyOptional({ description: 'Only parcels where this rule failed or went to review (e.g. "K2")' })
    @IsOptional()
    @Matches(/^K\d{1,2}$/)
    rule?: string;

    @ApiPropertyOptional({ description: 'Block/parcel ("106/23"), deed title or locality' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    search?: string;
}
