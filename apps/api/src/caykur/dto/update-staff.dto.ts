import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { CaykurRole } from '@/auth/enums';

/** Editable fields on an existing staff member. */
export class UpdateStaffDto {
    @ApiPropertyOptional({ example: 'Davut Şahin' })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    @Matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/, {
        message: 'Sadece harf ve boşluk kullanabilirsiniz',
    })
    fullName?: string;

    @ApiPropertyOptional({ example: '5551234567' })
    @IsOptional()
    @Matches(/^(5)[0-9]{9}$/, {
        message: 'Geçerli bir telefon numarası giriniz (5XXXXXXXXX)',
    })
    phone?: string;

    @ApiPropertyOptional({ example: 'Rize' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    province?: string;

    @ApiPropertyOptional({ example: 'Çayeli' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    district?: string;

    @ApiPropertyOptional({ enum: CaykurRole })
    @IsOptional()
    @IsEnum(CaykurRole, { message: 'Geçerli bir Çaykur rolü seçiniz' })
    caykurRole?: CaykurRole;

    @ApiPropertyOptional({ example: 'Rize / Çayeli' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    caykurScope?: string;

    @ApiPropertyOptional({ example: true, description: 'Active (false suspends the account)' })
    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
