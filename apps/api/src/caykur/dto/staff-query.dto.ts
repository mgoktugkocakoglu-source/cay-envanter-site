import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CaykurRole } from '@/auth/enums';

/** Query params for the paginated staff list. */
export class StaffQueryDto {
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

    @ApiPropertyOptional({ description: 'Search by name or email' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: CaykurRole })
    @IsOptional()
    @IsEnum(CaykurRole)
    caykurRole?: CaykurRole;

    @ApiPropertyOptional({ enum: ['active', 'suspended'] })
    @IsOptional()
    @IsIn(['active', 'suspended'])
    status?: 'active' | 'suspended';
}
