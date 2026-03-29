import { IsEnum, IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobListingType, JobListingCategory } from '../enums/job-listing.enum';

export class CreateJobListingDto {
    @ApiProperty({
        enum: JobListingType,
        description: 'Type of listing (worker seeking job OR job seeking worker)',
    })
    @IsEnum(JobListingType)
    @IsNotEmpty()
    type: JobListingType;

    @ApiProperty({
        enum: JobListingCategory,
        description: 'Category of the job',
    })
    @IsEnum(JobListingCategory)
    @IsNotEmpty()
    category: JobListingCategory;

    @ApiProperty({
        description: 'General location of the job/worker (e.g. "Rize / Merkez")',
        example: 'Rize / Çayeli',
    })
    @IsString()
    @IsNotEmpty()
    location: string;

    @ApiPropertyOptional({
        description: 'Dynamic fields depending on type and category',
        type: 'object',
        example: { dailyRate: 4000, equipment: ['manuel_makas'] },
    })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;
}
