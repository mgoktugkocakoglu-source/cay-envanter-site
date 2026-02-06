import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: 'ahmet@example.com', description: 'Email address' })
    @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
    email: string;

    @ApiProperty({ example: 'SecurePass123', description: 'Password' })
    @IsNotEmpty({ message: 'Şifre gereklidir' })
    password: string;

    @ApiProperty({
        example: false,
        description: 'Remember me for extended session',
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
}
