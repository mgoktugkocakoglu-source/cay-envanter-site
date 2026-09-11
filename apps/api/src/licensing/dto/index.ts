import {
    IsString,
    IsNumber,
    IsOptional,
    IsArray,
    IsEnum,
    IsUUID,
    IsIn,
    IsInt,
    MaxLength,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeasurementPointDto } from '@/pruning/dto';
import type { MeasurementMethod, AccuracyLevel } from '@/pruning/entities';
import type { LicensingMeasurementStatus, LicensingApprovalStatus } from '@/licensing/entities';

const METHODS: MeasurementMethod[] = ['map', 'gps', 'assisted', 'imu'];
const ACCURACY_LEVELS: AccuracyLevel[] = ['high', 'medium', 'low'];
const MEASUREMENT_STATUSES: LicensingMeasurementStatus[] = ['pending_approval', 'approved', 'rejected'];
const APPROVAL_STATUSES: LicensingApprovalStatus[] = ['pending', 'approved', 'rejected'];
const DECISIONS = ['approved', 'rejected'] as const;
export type LicensingDecision = (typeof DECISIONS)[number];

export class CreateLicensingMeasurementDto {
    @ApiProperty({ description: 'Budama request UUID the measurement belongs to' })
    @IsUUID()
    pruningRequestId: string;

    @ApiProperty({ description: 'Registered owner (user UUID) whose slice was measured' })
    @IsUUID()
    ownerId: string;

    @ApiProperty({ description: 'Measured slice area in m²' })
    @IsNumber()
    @Min(0)
    measuredAreaM2: number;

    @ApiProperty({ description: '3D measurement vertices (lat/lng/altitude)', type: [MeasurementPointDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MeasurementPointDto)
    points: MeasurementPointDto[];

    @ApiProperty({ description: 'Measurement method', enum: METHODS })
    @IsEnum(METHODS)
    method: MeasurementMethod;

    @ApiPropertyOptional({ description: 'Accuracy level', enum: ACCURACY_LEVELS })
    @IsOptional()
    @IsEnum(ACCURACY_LEVELS)
    accuracyLevel?: AccuracyLevel;

    @ApiPropertyOptional({ description: 'GPS/RTK fix quality label' })
    @IsOptional()
    @IsString()
    @MaxLength(16)
    fixQuality?: string;

    @ApiPropertyOptional({ description: 'Notes', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class DecideLicensingApprovalDto {
    @ApiProperty({ description: 'Co-owner decision', enum: DECISIONS })
    @IsIn(DECISIONS)
    decision: LicensingDecision;

    @ApiPropertyOptional({ description: 'Reason (expected when rejecting)', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

export class LicensingMeasurementQueryDto {
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

    @ApiPropertyOptional({ description: 'Filter by budama request UUID' })
    @IsOptional()
    @IsUUID()
    pruningRequestId?: string;

    @ApiPropertyOptional({ enum: MEASUREMENT_STATUSES })
    @IsOptional()
    @IsIn(MEASUREMENT_STATUSES)
    status?: LicensingMeasurementStatus;
}

export class LicensingApprovalQueryDto {
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

    @ApiPropertyOptional({ enum: APPROVAL_STATUSES })
    @IsOptional()
    @IsIn(APPROVAL_STATUSES)
    status?: LicensingApprovalStatus;
}
