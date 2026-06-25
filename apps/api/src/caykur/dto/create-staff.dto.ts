import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { CaykurRole } from '@/auth/enums';

/**
 * Payload for a manager/admin to onboard a Çaykur staff member. Staff do not
 * self-register; the account is created pre-verified and the person sets their
 * own password via the invite link.
 */
export class CreateStaffDto {
    @ApiProperty({ example: 'Davut Şahin', description: 'Full name of the staff member' })
    @IsString()
    @IsNotEmpty({ message: 'Ad Soyad gereklidir' })
    @MinLength(3, { message: 'Ad Soyad en az 3 karakter olmalıdır' })
    @MaxLength(100, { message: 'Ad Soyad en fazla 100 karakter olabilir' })
    @Matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/, {
        message: 'Sadece harf ve boşluk kullanabilirsiniz',
    })
    fullName: string;

    @ApiProperty({ example: 'davut.sahin@caykur.gov.tr', description: 'Email address' })
    @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
    @MaxLength(255)
    email: string;

    @ApiProperty({ example: '5551234567', description: 'Phone number (5XXXXXXXXX)' })
    @IsString()
    @IsNotEmpty({ message: 'Telefon numarası gereklidir' })
    @Matches(/^(5)[0-9]{9}$/, {
        message: 'Geçerli bir telefon numarası giriniz (5XXXXXXXXX)',
    })
    phone: string;

    @ApiProperty({ example: 'Rize', description: 'Province' })
    @IsString()
    @IsNotEmpty({ message: 'İl gereklidir' })
    @MaxLength(100)
    province: string;

    @ApiProperty({ example: 'Çayeli', description: 'District' })
    @IsString()
    @IsNotEmpty({ message: 'İlçe gereklidir' })
    @MaxLength(100)
    district: string;

    @ApiProperty({ enum: CaykurRole, example: CaykurRole.SAHA_PERSONELI, description: 'Çaykur staff role' })
    @IsEnum(CaykurRole, { message: 'Geçerli bir Çaykur rolü seçiniz' })
    caykurRole: CaykurRole;

    @ApiPropertyOptional({ example: 'Rize / Çayeli', description: 'Org scope (region / factory / purchase point)' })
    @IsOptional()
    @IsString()
    @MaxLength(150)
    caykurScope?: string;
}
