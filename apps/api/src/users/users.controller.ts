import {
    Controller,
    Get,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    BadRequestException,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums';
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

    @Get('admin/list')
    @Roles(Role.ADMIN, Role.MODERATOR)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth()
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'role', required: false, enum: ['all', 'user', 'moderator', 'admin'] })
    @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'banned'] })
    async listUsersForAdmin(
        @Query('search') search?: string,
        @Query('role') role?: string,
        @Query('status') status?: string,
    ) {
        return this.usersService.listForAdmin({
            search,
            role: role as 'all' | Role | undefined,
            status: status as 'all' | 'active' | 'banned' | undefined,
        });
    }

    @Patch('admin/:id/ban')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth()
    async setBan(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('banned') banned: boolean,
    ) {
        if (typeof banned !== 'boolean') {
            throw new BadRequestException('banned alanı boolean olmalıdır');
        }
        return this.usersService.setBanStatus(id, banned);
    }

    @Patch('admin/:id/role')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth()
    async setRole(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('role') role: Role,
    ) {
        return this.usersService.setRole(id, role);
    }
}
