import {
    IsString,
    IsOptional,
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
import type { LandMeasurementRequestStatus } from '@/measurement-requests/entities';

const REQUEST_STATUSES: LandMeasurementRequestStatus[] = [
    'pending',
    'scheduled',
    'measured',
    'closed',
    'rejected',
    'cancelled',
];

export class CreateMeasurementRequestDto {
    @ApiProperty({ description: 'Field UUID (must be on a hisseli parcel owned by the caller)' })
    @IsUUID()
    fieldId: string;

    @ApiPropertyOptional({ description: 'Producer note for the field officer', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    producerNote?: string;
}

export class SetMeasurementAppointmentDto {
    @ApiProperty({ description: 'Appointment date (YYYY-MM-DD)' })
    @IsDateString()
    appointmentDate: string;
}

export class RejectMeasurementRequestDto {
    @ApiPropertyOptional({ description: 'Rejection reason', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

export class MeasurementRequestQueryDto {
    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 50;

    @ApiPropertyOptional({ enum: REQUEST_STATUSES })
    @IsOptional()
    @IsIn(REQUEST_STATUSES)
    status?: LandMeasurementRequestStatus;

    @ApiPropertyOptional({ description: 'Search by producer name, district, ada or parsel', maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    search?: string;
}
