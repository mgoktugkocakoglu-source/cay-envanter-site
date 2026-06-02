import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
    KnowledgeDocument,
    KnowledgeDocumentChunk,
} from '@/knowledge/entities';
import { KnowledgeController } from '@/knowledge/knowledge.controller';
import {
    KnowledgeService,
    AiChatService,
    TextExtractionService,
} from '@/knowledge/services';

@Module({
    imports: [
        TypeOrmModule.forFeature([KnowledgeDocument, KnowledgeDocumentChunk]),
    ],
    controllers: [KnowledgeController],
    providers: [KnowledgeService, AiChatService, TextExtractionService],
    exports: [KnowledgeService],
})
export class KnowledgeModule {}
