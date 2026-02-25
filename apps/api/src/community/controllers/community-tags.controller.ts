import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { CommunityTagsService } from '@/community/services';
import { CreateTagDto } from '@/community/dto';

@ApiTags('Community Tags')
@Controller('community/tags')
export class CommunityTagsController {
    constructor(private readonly tagsService: CommunityTagsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all community tags' })
    @ApiResponse({ status: 200, description: 'List of tags' })
    async getAllTags() {
        return this.tagsService.findAll();
    }

    @Get('trending')
    @ApiOperation({ summary: 'Get trending tags from last 7 days' })
    @ApiResponse({ status: 200, description: 'List of trending tags' })
    async getTrendingTags(@Query('limit') limit?: number) {
        return this.tagsService.findTrending(limit ?? 10);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new tag (admin only)' })
    @ApiResponse({ status: 201, description: 'Tag created' })
    async createTag(@Body() dto: CreateTagDto) {
        return this.tagsService.createTag(dto);
    }
}
