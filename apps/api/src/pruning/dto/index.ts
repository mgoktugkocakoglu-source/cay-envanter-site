import {
    IsString,
    IsNumber,
    IsOptional,
    IsArray,
    IsEnum,
    IsBoolean,
    IsUUID,
    IsDateString,
    IsIn,
    IsInt,
    MaxLength,
    Max,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MeasurementMethod, AccuracyLevel, PruningTaskStatus } from '@/pruning/entities';

const METHODS: MeasurementMethod[] = ['map', 'gps', 'assisted'];
const ACCURACY_LEVELS: AccuracyLevel[] = ['high', 'medium', 'low'];
const TASK_STATUSES: PruningTaskStatus[] = ['pending', 'in_progress', 'measured', 'completed', 'cancelled'];

export class CreatePruningMeasurementDto {
    @ApiProperty({ description: 'Field (parcel) UUID the measurement belongs to' })
    @IsUUID()
    fieldId: string;

    @ApiProperty({ description: 'Measurement method', enum: METHODS })
    @IsEnum(METHODS)
    method: MeasurementMethod;

    @ApiProperty({ description: 'Pruned-area polygon ring as [lng, lat] pairs' })
    @IsArray()
    geometry: number[][];

    @ApiProperty({ description: 'Pruned area in square meters' })
    @IsNumber()
    @Min(0)
    prunedAreaM2: number;

    @ApiProperty({ description: 'Total parcel area in square meters (snapshot)' })
    @IsNumber()
    @Min(0)
    fieldAreaM2: number;

    @ApiProperty({ description: 'Pruned area as a percentage of the parcel' })
    @IsNumber()
    @Min(0)
    ratioPercent: number;

    @ApiPropertyOptional({ description: 'Measurement accuracy level', enum: ACCURACY_LEVELS })
    @IsOptional()
    @IsEnum(ACCURACY_LEVELS)
    accuracyLevel?: AccuracyLevel;

    @ApiPropertyOptional({ description: 'Whether an on-site field check was performed', default: false })
    @IsOptional()
    @IsBoolean()
    fieldCheckDone?: boolean;

    @ApiPropertyOptional({ description: 'GPS accuracy in meters (for GPS measurements)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    gpsAccuracyMeters?: number;

    @ApiPropertyOptional({ description: 'Field/site photo URL' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    photoUrl?: string;

    @ApiPropertyOptional({ description: 'Producer approval', default: false })
    @IsOptional()
    @IsBoolean()
    producerApproved?: boolean;

    @ApiPropertyOptional({ description: 'Staff approval', default: false })
    @IsOptional()
    @IsBoolean()
    staffApproved?: boolean;

    @ApiPropertyOptional({ description: 'Producer/owner name snapshot' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    producerName?: string;

    @ApiPropertyOptional({ description: 'Parcel number snapshot' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    parcelNo?: string;

    @ApiPropertyOptional({ description: 'Notes', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;

    @ApiPropertyOptional({ description: 'Measurement timestamp (ISO 8601); defaults to now' })
    @IsOptional()
    @IsDateString()
    measuredAt?: string;

    @ApiPropertyOptional({ description: 'Pruning task this capture fulfils (optional)' })
    @IsOptional()
    @IsUUID()
    taskId?: string;
}

export class UpdatePruningApprovalDto {
    @ApiPropertyOptional({ description: 'Producer approval' })
    @IsOptional()
    @IsBoolean()
    producerApproved?: boolean;

    @ApiPropertyOptional({ description: 'Staff approval' })
    @IsOptional()
    @IsBoolean()
    staffApproved?: boolean;

    @ApiPropertyOptional({ description: 'Rejection reason; setting it rejects the measurement' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    rejectionReason?: string;
}

export class AssignPruningTaskDto {
    @ApiProperty({ description: 'Field (parcel) UUID to measure' })
    @IsUUID()
    fieldId: string;

    @ApiProperty({ description: 'Field officer (saha personeli) user UUID' })
    @IsUUID()
    assignedTo: string;

    @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dueDate?: string;

    @ApiPropertyOptional({ description: 'Notes for the officer', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    notes?: string;
}

export class PruningQueryDto {
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

    @ApiPropertyOptional({ enum: TASK_STATUSES })
    @IsOptional()
    @IsIn(TASK_STATUSES)
    status?: PruningTaskStatus;

    @ApiPropertyOptional({ description: 'Filter by assigned officer UUID' })
    @IsOptional()
    @IsUUID()
    assignedTo?: string;

    @ApiPropertyOptional({ description: 'Filter by field UUID' })
    @IsOptional()
    @IsUUID()
    fieldId?: string;
}
