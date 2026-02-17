import {
    Controller,
    Get,
    Query,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { UsersService } from '@/users/users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('search')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiQuery({ name: 'query', required: true })
    @ApiQuery({ name: 'type', required: true, enum: ['tc', 'phone'] })
    async searchUser(
        @Query('query') query: string,
        @Query('type') type: 'tc' | 'phone',
    ) {
        if (!query || !type) {
            throw new BadRequestException('Arama sorgusu ve tipi gereklidir');
        }

        if (type !== 'tc' && type !== 'phone') {
            throw new BadRequestException('Geçersiz arama tipi');
        }

        const user = await this.usersService.searchUser(query, type);

        if (!user) {
            throw new BadRequestException('Kullanıcı bulunamadı');
        }

        return user;
    }
}
