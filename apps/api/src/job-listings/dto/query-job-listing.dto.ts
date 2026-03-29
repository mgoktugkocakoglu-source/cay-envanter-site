import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobListingType, JobListingCategory, JobListingStatus } from '../enums/job-listing.enum';

export class QueryJobListingDto {
    @ApiPropertyOptional({
        enum: JobListingType,
        description: 'Filter by worker (seeking job) or job (seeking worker)',
    })
    @IsEnum(JobListingType)
    @IsOptional()
    type?: JobListingType;

    @ApiPropertyOptional({
        enum: JobListingCategory,
        description: 'Filter by tea picking, transport, or daily jobs',
    })
    @IsEnum(JobListingCategory)
    @IsOptional()
    category?: JobListingCategory;

    @ApiPropertyOptional({
        enum: JobListingStatus,
        description: 'Filter by listing status',
    })
    @IsEnum(JobListingStatus)
    @IsOptional()
    status?: JobListingStatus;

    @ApiPropertyOptional({
        description: 'Search string for location or author name',
    })
    @IsString()
    @IsOptional()
    search?: string;
}
