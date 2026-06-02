import {
    IsString,
    IsOptional,
    IsArray,
    IsIn,
    ValidateNested,
    MaxLength,
    MinLength,
    ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DocumentStatus } from '@/knowledge/enums';

export type ChatRole = 'user' | 'assistant';

// ─── Request DTOs ───

export class CreateDocumentDto {
    @ApiPropertyOptional({
        description: 'Optional human-readable title. Falls back to the file name.',
        maxLength: 255,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    title?: string;
}

export class ChatHistoryMessageDto {
    @ApiProperty({ enum: ['user', 'assistant'] })
    @IsIn(['user', 'assistant'])
    role: ChatRole;

    @ApiProperty({ description: 'Message content' })
    @IsString()
    @MaxLength(8000)
    content: string;
}

export class ChatDto {
    @ApiProperty({ description: 'The question for the tea-farming assistant', maxLength: 2000 })
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    message: string;

    @ApiPropertyOptional({
        description: 'Recent conversation turns, oldest first, for follow-up context',
        type: [ChatHistoryMessageDto],
    })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => ChatHistoryMessageDto)
    history?: ChatHistoryMessageDto[];
}

// ─── Response shapes ───

export interface DocumentSummary {
    id: string;
    title: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    status: DocumentStatus;
    charCount: number;
    chunkCount: number;
    errorMessage: string | null;
    createdAt: Date;
}

export interface ChatSource {
    documentId: string;
    title: string;
    snippet: string;
}

export interface ChatResponse {
    answer: string;
    sources: ChatSource[];
    /** True when the answer came from the LLM; false for the retrieval-only fallback. */
    usedAi: boolean;
}

export interface KnowledgeStatus {
    aiConfigured: boolean;
    model: string;
    documentCount: number;
    readyDocumentCount: number;
    chunkCount: number;
}
