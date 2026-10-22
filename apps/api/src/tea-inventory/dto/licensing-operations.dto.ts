import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { APPLICATION_TYPES } from '@/tea-inventory/dto/licensing.dto';

/** The holder a piece / part / licence goes to: an existing producer or a new person. */
export class HolderDto {
    @ApiPropertyOptional({ description: 'Existing producer code (e.g. DEMO-M-0012)' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    producerCode?: string;

    @ApiPropertyOptional({ description: 'New holder name (when no producer code)' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    name?: string;

    @ApiPropertyOptional({ description: 'New holder wallet number (optional; generated when blank)' })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    walletNo?: string;
}

export class SubdivisionPieceDto {
    @ApiProperty({ description: 'Short label, e.g. "A" or "Kuzey parça"' })
    @IsString()
    @MaxLength(40)
    label: string;

    @ApiProperty({ description: 'GeoJSON Polygon / MultiPolygon in WGS84' })
    @IsObject()
    geometry: Record<string, unknown>;

    @ApiProperty({ type: HolderDto })
    @ValidateNested()
    @Type(() => HolderDto)
    holder: HolderDto;

    @ApiPropertyOptional({ description: 'Licensed area assigned to the piece (m²); pro-rata by map area when blank' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    licensedAreaM2?: number;
}

/** garden_subdivision: cut one garden into pieces, each with its holder and licensed share. */
export class SubdivisionPayloadDto {
    @ApiProperty()
    @IsString()
    @MaxLength(40)
    gardenCode: string;

    @ApiProperty({ type: [SubdivisionPieceDto] })
    @IsArray()
    @ArrayMinSize(2)
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => SubdivisionPieceDto)
    pieces: SubdivisionPieceDto[];

    @ApiPropertyOptional({ enum: ['inheritance', 'sale', 'parcel_split', 'family', 'other'] })
    @IsOptional()
    @IsIn(['inheritance', 'sale', 'parcel_split', 'family', 'other'])
    cause?: 'inheritance' | 'sale' | 'parcel_split' | 'family' | 'other';

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

export class LicenseSplitPartDto {
    @ApiProperty()
    @IsString()
    @MaxLength(40)
    label: string;

    @ApiProperty({ type: HolderDto })
    @ValidateNested()
    @Type(() => HolderDto)
    holder: HolderDto;

    @ApiProperty({ description: 'Gardens of the licence that go to this part', type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    gardenCodes: string[];

    @ApiPropertyOptional({ description: 'Recorded area of the new licence (m²); pro-rata by the gardens\' licensed areas when blank' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    recordedAreaM2?: number;
}

/** license_split: divide one licence among holders along its gardens (inheritance, sale of a parcel, parcel split). */
export class LicenseSplitPayloadDto {
    @ApiProperty()
    @IsString()
    @MaxLength(40)
    licenseCode: string;

    @ApiProperty({ type: [LicenseSplitPartDto] })
    @IsArray()
    @ArrayMinSize(2)
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => LicenseSplitPartDto)
    parts: LicenseSplitPartDto[];

    @ApiProperty({ enum: ['inheritance', 'sale', 'parcel_split', 'family', 'other'] })
    @IsIn(['inheritance', 'sale', 'parcel_split', 'family', 'other'])
    cause: 'inheritance' | 'sale' | 'parcel_split' | 'family' | 'other';

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

/** transfer: the whole licence (with its gardens) passes to another holder. */
export class TransferPayloadDto {
    @ApiProperty()
    @IsString()
    @MaxLength(40)
    licenseCode: string;

    @ApiProperty({ type: HolderDto })
    @ValidateNested()
    @Type(() => HolderDto)
    holder: HolderDto;

    @ApiProperty({ enum: ['inheritance', 'sale', 'family', 'other'] })
    @IsIn(['inheritance', 'sale', 'family', 'other'])
    cause: 'inheritance' | 'sale' | 'family' | 'other';

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

/** area_correction: the licensed area of a garden (and its licence) is corrected. */
export class AreaCorrectionPayloadDto {
    @ApiProperty()
    @IsString()
    @MaxLength(40)
    gardenCode: string;

    @ApiProperty({ description: 'New licensed area of the garden (m²)' })
    @IsNumber()
    @Min(0)
    newLicensedAreaM2: number;

    @ApiProperty({ maxLength: 1000 })
    @IsString()
    @MaxLength(1000)
    reason: string;
}

/** boundary_determination: a new geometry for a garden (map drawing, RTK walk or producer sketch). */
export class BoundaryPayloadDto {
    @ApiProperty()
    @IsString()
    @MaxLength(40)
    gardenCode: string;

    @ApiProperty({ description: 'GeoJSON Polygon / MultiPolygon in WGS84' })
    @IsObject()
    geometry: Record<string, unknown>;

    @ApiProperty({ enum: ['map', 'rtk', 'producer'] })
    @IsIn(['map', 'rtk', 'producer'])
    source: 'map' | 'rtk' | 'producer';

    @ApiPropertyOptional({ maxLength: 1000 })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    reason?: string;
}

/** A site-created application: the type decides how `payload` is validated and applied on approval. */
export class CreateApplicationDto {
    @ApiProperty({ enum: APPLICATION_TYPES })
    @IsIn(APPLICATION_TYPES)
    type: (typeof APPLICATION_TYPES)[number];

    @ApiProperty({ description: 'Type-specific payload (see SubdivisionPayloadDto, LicenseSplitPayloadDto, TransferPayloadDto, AreaCorrectionPayloadDto, BoundaryPayloadDto)' })
    @IsObject()
    payload: Record<string, unknown>;

    @ApiPropertyOptional({ description: 'Document types already provided (the rest of the checklist is marked missing)', type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    providedDocuments?: string[];

    @ApiPropertyOptional({ description: 'Submit straight to review (default) or keep as draft' })
    @IsOptional()
    @IsIn(['review', 'draft'])
    submit?: 'review' | 'draft';
}

/** Dry-run of a subdivision or split: the computed pieces / parts without saving anything. */
export class PreviewOperationDto {
    @ApiProperty({ enum: ['garden_subdivision', 'license_split', 'boundary_determination'] })
    @IsIn(['garden_subdivision', 'license_split', 'boundary_determination'])
    type: 'garden_subdivision' | 'license_split' | 'boundary_determination';

    @ApiProperty()
    @IsObject()
    payload: Record<string, unknown>;
}
