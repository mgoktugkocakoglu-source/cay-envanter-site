import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    ParseUUIDPipe,
    BadRequestException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Role } from '@/auth/enums/role.enum';
import { KnowledgeService } from '@/knowledge/services';
import {
    ChatDto,
    ChatResponse,
    CreateDocumentDto,
    DocumentSummary,
    KnowledgeStatus,
} from '@/knowledge/dto';

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25MB

@ApiTags('Knowledge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge')
export class KnowledgeController {
    constructor(private readonly knowledgeService: KnowledgeService) {}

    // ─── Read endpoints (all authenticated users) ───

    @Get('status')
    @ApiOperation({ summary: 'AI configuration and knowledge-base counters' })
    @ApiResponse({ status: 200, description: 'Knowledge base status' })
    async getStatus(): Promise<KnowledgeStatus> {
        return this.knowledgeService.getStatus();
    }

    @Get('documents')
    @ApiOperation({ summary: 'List documents in the AI knowledge base' })
    @ApiResponse({ status: 200, description: 'Documents' })
    async listDocuments(): Promise<DocumentSummary[]> {
        return this.knowledgeService.findAll();
    }

    @Post('chat')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Ask the tea-farming AI agent a question',
        description:
            'Answers from the uploaded knowledge base (cited) plus the model own agronomy knowledge.',
    })
    @ApiResponse({ status: 200, description: 'Assistant answer with sources' })
    async chat(@Body() dto: ChatDto): Promise<ChatResponse> {
        return this.knowledgeService.chat(dto);
    }

    // ─── Admin write endpoints ───

    @Post('documents')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: MAX_DOCUMENT_BYTES },
        }),
    )
    @ApiOperation({ summary: 'Upload a document to the knowledge base (admin only)' })
    @ApiResponse({ status: 201, description: 'Document indexed' })
    async uploadDocument(
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: CreateDocumentDto,
        @CurrentUser('id') userId: string,
    ): Promise<DocumentSummary> {
        if (!file) {
            throw new BadRequestException('Dosya yüklenemedi.');
        }
        return this.knowledgeService.createFromFile(file, dto.title, userId);
    }

    @Delete('documents/:id')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a document from the knowledge base (admin only)' })
    @ApiParam({ name: 'id', description: 'Document UUID' })
    @ApiResponse({ status: 204, description: 'Document removed' })
    async removeDocument(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
        return this.knowledgeService.remove(id);
    }
}
