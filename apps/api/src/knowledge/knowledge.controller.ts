import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    Req,
    Res,
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
    ApiProduces,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Role } from '@/auth/enums/role.enum';
import { KnowledgeService } from '@/knowledge/services';
import {
    ChatDto,
    ChatResponse,
    ChatStreamEvent,
    CreateDocumentDto,
    DocumentFileQueryDto,
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

    @Get('documents/:id/file')
    @ApiOperation({ summary: 'Open or download the original document file' })
    @ApiParam({ name: 'id', description: 'Document UUID' })
    @ApiProduces('application/octet-stream')
    @ApiResponse({ status: 200, description: 'The original file' })
    @ApiResponse({ status: 404, description: 'Document or file not found' })
    async getDocumentFile(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: DocumentFileQueryDto,
        @Res() res: Response,
    ): Promise<void> {
        const file = await this.knowledgeService.getFile(id);
        const disposition = query.download === 'true' ? 'attachment' : 'inline';
        const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
        const encodedName = encodeURIComponent(file.fileName);

        res.setHeader('Content-Type', file.mimeType);
        res.setHeader(
            'Content-Disposition',
            `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        );
        res.setHeader('Cache-Control', 'private, max-age=3600');
        if (file.size) {
            res.setHeader('Content-Length', String(file.size));
        }

        if (file.buffer) {
            res.end(file.buffer);
            return;
        }
        file.stream?.pipe(res);
    }

    @Post('chat')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Ask the tea-farming AI agent a question',
        description: 'Answers strictly from the uploaded knowledge base, with cited passages.',
    })
    @ApiResponse({ status: 200, description: 'Assistant answer with sources' })
    async chat(@Body() dto: ChatDto): Promise<ChatResponse> {
        return this.knowledgeService.chat(dto);
    }

    @Post('chat/stream')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Ask the AI agent and stream the answer as server-sent events',
        description:
            'Emits `meta` (sources), then `delta` text fragments, then `done` (full answer + follow-up questions). Errors arrive as an `error` event.',
    })
    @ApiProduces('text/event-stream')
    @ApiResponse({ status: 200, description: 'SSE stream' })
    async chatStream(
        @Body() dto: ChatDto,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        // Tell nginx not to buffer so fragments reach the browser immediately.
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const controller = new AbortController();
        req.on('close', () => controller.abort());

        const emit = (event: ChatStreamEvent): void => {
            if (controller.signal.aborted || res.writableEnded) {
                return;
            }
            res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        };

        try {
            await this.knowledgeService.chatStream(dto, emit, controller.signal);
        } catch {
            emit({ type: 'error', message: 'Yanıt üretilemedi. Lütfen tekrar deneyin.' });
        } finally {
            if (!res.writableEnded) {
                res.end();
            }
        }
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

    @Post('documents/:id/reindex')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Re-embed a document and regenerate its starter questions (admin only)' })
    @ApiParam({ name: 'id', description: 'Document UUID' })
    @ApiResponse({ status: 200, description: 'Document queued for re-indexing' })
    async reindexDocument(@Param('id', ParseUUIDPipe) id: string): Promise<DocumentSummary> {
        return this.knowledgeService.reindex(id);
    }

    @Post('reindex')
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Re-embed every document (admin only)' })
    @ApiResponse({ status: 200, description: 'Number of documents queued' })
    async reindexAll(): Promise<{ queued: number }> {
        return { queued: await this.knowledgeService.reindexAll() };
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
