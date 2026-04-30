import {
    IsString,
    IsNumber,
    IsOptional,
    IsDateString,
    IsEnum,
    IsUUID,
    IsArray,
    ValidateNested,
    MaxLength,
    Min,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@/payments/entities/payment.entity';

export class HarvestAllocationDto {
    @ApiProperty({ description: 'Harvest ID' })
    @IsUUID()
    harvestId: string;

    @ApiProperty({ description: 'Amount in kg to use from this harvest' })
    @IsNumber()
    @Min(0.01)
    usedAmountKg: number;
}

export class CreatePaymentDto {
    @ApiProperty({ description: 'Harvest allocations', type: [HarvestAllocationDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => HarvestAllocationDto)
    harvestAllocations: HarvestAllocationDto[];

    @ApiProperty({ description: 'Total price in TL', minimum: 0 })
    @IsNumber()
    @Min(0)
    totalPrice: number;

    @ApiPropertyOptional({ description: 'Broker firm ID' })
    @IsOptional()
    @IsUUID()
    brokerFirmId?: string;

    @ApiProperty({ description: 'Payment date (YYYY-MM-DD)' })
    @IsDateString()
    paymentDate: string;

    @ApiProperty({ description: 'Payment status', enum: ['received', 'pending'] })
    @IsEnum(['received', 'pending'])
    paymentStatus: PaymentStatus;

    @ApiPropertyOptional({ description: 'Notes', maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}

export class UpdatePaymentDto {
    @ApiPropertyOptional({ description: 'Total price in TL', minimum: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    totalPrice?: number;

    @ApiPropertyOptional({ description: 'Payment date' })
    @IsOptional()
    @IsDateString()
    paymentDate?: string;

    @ApiPropertyOptional({ description: 'Payment status', enum: ['received', 'pending'] })
    @IsOptional()
    @IsEnum(['received', 'pending'])
    paymentStatus?: PaymentStatus;

    @ApiPropertyOptional({ description: 'Notes' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}

export class PaymentQueryDto {
    @ApiPropertyOptional({ description: 'Filter by broker firm' })
    @IsOptional()
    @IsUUID()
    brokerFirmId?: string;

    @ApiPropertyOptional({ description: 'Filter by year' })
    @IsOptional()
    @IsNumber()
    year?: number;

    @ApiPropertyOptional({ description: 'Filter by status', enum: ['received', 'pending'] })
    @IsOptional()
    @IsEnum(['received', 'pending'])
    paymentStatus?: PaymentStatus;

    @ApiPropertyOptional({ description: 'Sort field', enum: ['paymentDate', 'totalPrice'] })
    @IsOptional()
    @IsString()
    sortBy?: 'paymentDate' | 'totalPrice';

    @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'] })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC';
}

export class CreateBrokerFirmDto {
    @ApiProperty({ description: 'Firm name', maxLength: 100 })
    @IsString()
    @MaxLength(100)
    firmName: string;
}

export interface PaymentWithDetails {
    id: string;
    totalAmountKg: number;
    totalPrice: number;
    pricePerKg: number;
    brokerFirm: { id: string; firmName: string } | null;
    paymentDate: Date;
    paymentStatus: PaymentStatus;
    notes: string | null;
    harvestCount: number;
    createdAt: Date;
}
