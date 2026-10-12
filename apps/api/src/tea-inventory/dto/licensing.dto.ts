import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { APPLICATION_STATUSES, ApplicationStatus } from '@/tea-inventory/entities/licensing-application.entity';

export const LICENSE_MATCH_LEVELS = ['exact', 'historical', 'probable', 'unmatched'] as const;
export const GARDEN_APPROVAL_STATUSES = ['approved', 'proposed', 'boundary_conflict', 'field_check_required', 'unresolved'] as const;
export const GARDEN_DISCREPANCIES = ['area_over', 'area_under', 'no_tea', 'no_license', 'lineage_unresolved', 'overlap', 'outside_parcel'] as const;
export const APPLICATION_TYPES = ['new_license', 'area_correction', 'transfer', 'boundary_determination', 'parcel_update'] as const;
export const LICENSING_PRODUCER_SORT_KEYS = ['name', 'licensedArea', 'measuredTea', 'issues'] as const;
export type LicensingProducerSortKey = (typeof LICENSING_PRODUCER_SORT_KEYS)[number];

class PageQueryDto {
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
}

/** Query params for the producer-centred licence list. */
export class LicensingProducerQueryDto extends PageQueryDto {
    @ApiPropertyOptional({ description: 'Name, producer / wallet / licence no, garden code or "ada/parsel"' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ enum: LICENSE_MATCH_LEVELS, description: 'Worst match level among the producer licences' })
    @IsOptional()
    @IsIn(LICENSE_MATCH_LEVELS)
    matchLevel?: (typeof LICENSE_MATCH_LEVELS)[number];

    @ApiPropertyOptional({ enum: GARDEN_APPROVAL_STATUSES, description: 'Worst boundary status among the producer gardens' })
    @IsOptional()
    @IsIn(GARDEN_APPROVAL_STATUSES)
    approvalStatus?: (typeof GARDEN_APPROVAL_STATUSES)[number];

    @ApiPropertyOptional({ enum: GARDEN_DISCREPANCIES })
    @IsOptional()
    @IsIn(GARDEN_DISCREPANCIES)
    discrepancy?: (typeof GARDEN_DISCREPANCIES)[number];

    @ApiPropertyOptional({ description: 'true: only producers with any open issue; false: only clean ones' })
    @IsOptional()
    @IsIn(['true', 'false'])
    issues?: 'true' | 'false';

    @ApiPropertyOptional({ enum: LICENSING_PRODUCER_SORT_KEYS, default: 'issues' })
    @IsOptional()
    @IsIn(LICENSING_PRODUCER_SORT_KEYS)
    sortBy?: LicensingProducerSortKey = 'issues';

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

/** Query params for the application queue. */
export class ApplicationQueryDto extends PageQueryDto {
    @ApiPropertyOptional({ enum: APPLICATION_STATUSES, description: 'Effective status (latest decision wins)' })
    @IsOptional()
    @IsIn(APPLICATION_STATUSES)
    status?: ApplicationStatus;

    @ApiPropertyOptional({ enum: APPLICATION_TYPES })
    @IsOptional()
    @IsIn(APPLICATION_TYPES)
    type?: (typeof APPLICATION_TYPES)[number];

    @ApiPropertyOptional({ description: 'true: only files still open (not approved / rejected / superseded)' })
    @IsOptional()
    @IsIn(['true', 'false'])
    open?: 'true' | 'false';

    @ApiPropertyOptional({ description: 'Producer name, application / licence / garden code' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;
}

/** A reviewer's step on an application: the next status and a note. */
export class ApplicationDecisionDto {
    @ApiProperty({ enum: APPLICATION_STATUSES, description: 'Target status; must be a transition allowed from the current one' })
    @IsIn(APPLICATION_STATUSES)
    status: ApplicationStatus;

    @ApiPropertyOptional({ description: 'Reason or field note (required for a return or a rejection)', maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string;
}
