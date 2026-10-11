import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InventoryClass } from '@/tea-inventory/enums/inventory-class.enum';

export const INVENTORY_PARCEL_SORT_KEYS = ['parcel', 'teaArea', 'licensedArea', 'gap'] as const;
export type InventoryParcelSortKey = (typeof INVENTORY_PARCEL_SORT_KEYS)[number];

/** Query params for the parcels of one inventoried area. */
export class InventoryParcelQueryDto {
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

    @ApiPropertyOptional({ enum: InventoryClass })
    @IsOptional()
    @IsEnum(InventoryClass)
    inventoryClass?: InventoryClass;

    @ApiPropertyOptional({ description: 'Ada/parsel, deed title, license no or holder name' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ enum: INVENTORY_PARCEL_SORT_KEYS, default: 'gap' })
    @IsOptional()
    @IsIn(INVENTORY_PARCEL_SORT_KEYS)
    sortBy?: InventoryParcelSortKey = 'gap';

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

/** Query params for the list of inventoried areas. */
export class InventoryAreaQueryDto {
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
