import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

/** How a satellite pruning record reached ÇAYKUR's purchase system. */
export const PRUNING_REGISTRATIONS = ['auto', 'expert', 'pending', 'rejected', 'unattributed', 'no_license'] as const;
export type PruningRegistration = (typeof PRUNING_REGISTRATIONS)[number];
export const RADAR_CLASSES = ['confirmed', 'weak', 'neutral', 'contradicted', 'no_data'] as const;
/** Multi-sensor verdict classes (fusion module) a record can be filtered by; 'none' = garden never judged. */
export const RECORD_FUSION_CLASSES = ['pruned', 'likely', 'unclear', 'not_pruned', 'no_data', 'none'] as const;

/** Query params for the scan-centred pruning record feed. */
export class PruningRecordQueryDto {
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

    @ApiPropertyOptional({ description: 'Pruning season, e.g. 2025-26 (default: latest scanned)' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    season?: string;

    @ApiPropertyOptional({ description: 'Scan date (YYYY-MM-DD) the record was detected at' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    scanDate?: string;

    @ApiPropertyOptional({ description: 'TKGM locality (mevkii) of the parcel' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    locality?: string;

    @ApiPropertyOptional({ enum: PRUNING_REGISTRATIONS })
    @IsOptional()
    @IsIn(PRUNING_REGISTRATIONS)
    registration?: PruningRegistration;

    @ApiPropertyOptional({ enum: RADAR_CLASSES, description: 'Sentinel-1 verdict on the record (radar module)' })
    @IsOptional()
    @IsIn(RADAR_CLASSES)
    radar?: (typeof RADAR_CLASSES)[number];

    @ApiPropertyOptional({ enum: RECORD_FUSION_CLASSES, description: 'Multi-sensor (fusion) verdict of the record\'s garden this season' })
    @IsOptional()
    @IsIn(RECORD_FUSION_CLASSES)
    fusion?: (typeof RECORD_FUSION_CLASSES)[number];

    @ApiPropertyOptional({ description: 'Producer name, producer / wallet / licence code, garden code or "ada/parsel"' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;
}
