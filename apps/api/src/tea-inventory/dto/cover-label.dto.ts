import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { COVER_CLASSES } from '@/tea-inventory/entities/land-cover.types';

export class CreateCoverLabelDto {
    @ApiProperty({ enum: COVER_CLASSES, description: 'What grows (or stands) on the drawn area' })
    @IsIn(COVER_CLASSES)
    coverClass: (typeof COVER_CLASSES)[number];

    @ApiProperty({ description: 'Outer ring of the drawn polygon as [lon, lat] pairs (WGS84); closed or open', type: [[Number]] })
    @IsArray()
    @ArrayMinSize(3)
    @ArrayMaxSize(200)
    ring: number[][];

    @ApiPropertyOptional({ description: 'Free note (how the person knows, date seen)' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    note?: string;
}
