import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsISO8601, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/** One producer line of the Ministry's list; every field may be blank except one identifier. */
export class MinistryRequestLineDto {
    @ApiPropertyOptional({ description: 'ÇAYKUR wallet (cüzdan) number' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    walletNo?: string;

    @ApiPropertyOptional({ description: 'Licence number' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    licenseNo?: string;

    @ApiPropertyOptional({ description: 'Producer code in the register' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    producerCode?: string;

    @ApiPropertyOptional({ description: 'Producer name as written by the Ministry' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;
}

/** A Ministry / inspection request: who asked, when, and the list of producers to answer for. */
export class CreateMinistryRequestDto {
    @ApiProperty({ maxLength: 200 })
    @IsString()
    @MaxLength(200)
    title: string;

    @ApiPropertyOptional({ maxLength: 200, description: 'Requesting body' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    source?: string;

    @ApiPropertyOptional({ maxLength: 120, description: 'Letter / reference number' })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    reference?: string;

    @ApiProperty({ description: 'Date of the request (YYYY-MM-DD)' })
    @IsISO8601({ strict: true })
    requestedAt: string;

    @ApiPropertyOptional({ description: 'Pruning season to answer for (default: latest scanned)' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    season?: string;

    @ApiPropertyOptional({ maxLength: 2000 })
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    note?: string;

    @ApiPropertyOptional({ type: [MinistryRequestLineDto], description: 'Structured lines (alternative to `text`)' })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(2000)
    @ValidateNested({ each: true })
    @Type(() => MinistryRequestLineDto)
    items?: MinistryRequestLineDto[];

    @ApiPropertyOptional({ description: 'Pasted list: one producer per line, fields separated by ; , or tab (cüzdan no, ruhsat no, müstahsil no, ad soyad in any order)', maxLength: 200000 })
    @IsOptional()
    @IsString()
    @MaxLength(200000)
    text?: string;
}

/** Query params of the request list. */
export class MinistryRequestQueryDto {
    @ApiPropertyOptional({ description: 'Pruning season' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    season?: string;
}
