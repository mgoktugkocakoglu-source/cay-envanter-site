import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@/auth/decorators';
import { JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard } from '@/auth/guards';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/auth/enums';
import { CreateEquipmentDto, CreateEquipmentReviewDto, QueryEquipmentDto } from '@/equipment/dto';
import { EquipmentService } from '@/equipment/equipment.service';

@ApiTags('Ekipmanlar')
@Controller('equipment')
export class EquipmentController {
    constructor(private readonly equipmentService: EquipmentService) { }

    @Get()
    @UseGuards(OptionalJwtAuthGuard)
    @ApiOperation({ summary: 'Ekipmanları listele' })
    @ApiResponse({ status: 200, description: 'Ekipman listesi başarıyla getirildi.' })
    findAll(
        @CurrentUser() authUser: (AuthenticatedUser & { role?: Role }) | null,
        @Query() query: QueryEquipmentDto,
    ) {
        return this.equipmentService.findAll(query, authUser?.id, authUser?.role || Role.USER);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Yeni ekipman gönder' })
    create(
        @CurrentUser() authUser: AuthenticatedUser & { role?: Role },
        @Body() dto: CreateEquipmentDto,
    ) {
        return this.equipmentService.create(authUser.id, authUser.role || Role.USER, dto);
    }

    @Patch(':id/approve')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ekipmanı onayla' })
    approve(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
    ) {
        return this.equipmentService.approve(id, userId);
    }

    @Patch(':id/reject')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ekipmanı reddet' })
    reject(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
    ) {
        return this.equipmentService.reject(id, userId);
    }

    @Post(':id/reviews')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ekipman değerlendirmesi ekle' })
    createReview(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
        @Body() dto: CreateEquipmentReviewDto,
    ) {
        return this.equipmentService.createReview(userId, id, dto);
    }

    @Post(':id/favorite')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ekipmanı favoriye ekle veya çıkar' })
    toggleFavorite(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
    ) {
        return this.equipmentService.toggleFavorite(userId, id);
    }

    @Post('reviews/:reviewId/like')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Ekipman yorumunu beğen veya beğeniyi kaldır' })
    toggleReviewLike(
        @CurrentUser('id') userId: string,
        @Param('reviewId') reviewId: string,
    ) {
        return this.equipmentService.toggleReviewLike(userId, reviewId);
    }
}
