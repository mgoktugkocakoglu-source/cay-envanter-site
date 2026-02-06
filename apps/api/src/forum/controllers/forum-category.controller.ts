import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { ForumCategoryService } from '@/forum/services';
import { CreateCategoryDto, UpdateCategoryDto, CategoryResponseDto } from '@/forum/dto';

@ApiTags('Forum Categories')
@Controller('forum/categories')
export class ForumCategoryController {
    constructor(private readonly categoryService: ForumCategoryService) { }

    @Get()
    @ApiOperation({ summary: 'Get all categories' })
    @ApiResponse({ status: 200, type: [CategoryResponseDto] })
    async findAll(): Promise<CategoryResponseDto[]> {
        return this.categoryService.findAll();
    }

    @Get(':slug')
    @ApiOperation({ summary: 'Get category by slug' })
    async findBySlug(@Param('slug') slug: string) {
        return this.categoryService.findBySlug(slug);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create category (Admin only)' })
    async create(@Body() dto: CreateCategoryDto) {
        // TODO: Add admin guard
        return this.categoryService.create(dto);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update category (Admin only)' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateCategoryDto,
    ) {
        // TODO: Add admin guard
        return this.categoryService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete category (Admin only)' })
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        // TODO: Add admin guard
        return this.categoryService.delete(id);
    }

    @Post('reorder')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Reorder categories (Admin only)' })
    async reorder(@Body() categoryIds: string[]) {
        // TODO: Add admin guard
        return this.categoryService.reorder(categoryIds);
    }
}
