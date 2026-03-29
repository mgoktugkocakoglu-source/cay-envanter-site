import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateJobListingDto } from './create-job-listing.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { JobListingStatus } from '../enums/job-listing.enum';

export class UpdateJobListingDto extends PartialType(CreateJobListingDto) {
    @ApiPropertyOptional({
        enum: JobListingStatus,
        description: 'Update the status of the listing (e.g. mark it filled)',
    })
    @IsEnum(JobListingStatus)
    @IsOptional()
    status?: JobListingStatus;
}
