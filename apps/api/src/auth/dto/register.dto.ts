import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'Ahmet Yılmaz', description: 'Full name of the user' })
    @IsString()
    @IsNotEmpty({ message: 'Ad Soyad gereklidir' })
    @MinLength(3, { message: 'Ad Soyad en az 3 karakter olmalıdır' })
    @MaxLength(100, { message: 'Ad Soyad en fazla 100 karakter olabilir' })
    @Matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/, {
        message: 'Sadece harf ve boşluk kullanabilirsiniz',
    })
    fullName: string;

    @ApiProperty({ example: 'ahmet@example.com', description: 'Email address' })
    @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
    @MaxLength(255)
    email: string;

    @ApiProperty({ example: '5551234567', description: 'Phone number' })
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

    @ApiProperty({ example: 'SecurePass123', description: 'Password' })
    @IsString()
    @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır' })
    @Matches(/(?=.*[a-z])/, {
        message: 'Şifre en az bir küçük harf içermelidir',
    })
    @Matches(/(?=.*[A-Z])/, {
        message: 'Şifre en az bir büyük harf içermelidir',
    })
    @Matches(/(?=.*[0-9])/, { message: 'Şifre en az bir rakam içermelidir' })
    password: string;

    @ApiProperty({
        example: '12345678901',
        description: 'Farmer ID number (optional)',
        required: false,
    })
    @IsOptional()
    @IsString()
    @Matches(/^[0-9]{11}$/, {
        message: 'Çiftçi Kimlik No 11 haneli olmalıdır',
    })
    farmerIdNumber?: string;
}
