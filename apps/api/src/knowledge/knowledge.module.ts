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
    EmbeddingService,
} from '@/knowledge/services';
import { UploadsModule } from '@/uploads/uploads.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([KnowledgeDocument, KnowledgeDocumentChunk]),
        UploadsModule,
    ],
    controllers: [KnowledgeController],
    providers: [
        KnowledgeService,
        AiChatService,
        TextExtractionService,
        EmbeddingService,
    ],
    exports: [KnowledgeService],
})
export class KnowledgeModule {}
