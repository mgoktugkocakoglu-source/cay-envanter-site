import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { DocumentStatus } from '@/knowledge/enums';
import { KnowledgeDocumentChunk } from '@/knowledge/entities/document-chunk.entity';

/**
 * A document uploaded to the AI agent's knowledge base (PDF, DOCX, TXT, MD).
 * The extracted text is split into {@link KnowledgeDocumentChunk} rows that
 * back full-text retrieval; this row only holds metadata.
 */
@Entity('knowledge_documents')
export class KnowledgeDocument {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'varchar', length: 255 })
    fileName: string;

    @Column({ type: 'varchar', length: 150 })
    mimeType: string;

    @Column({ type: 'integer', default: 0 })
    fileSize: number;

    @Column({ type: 'varchar', length: 20, default: DocumentStatus.Processing })
    status: DocumentStatus;

    @Column({ type: 'integer', default: 0 })
    charCount: number;

    @Column({ type: 'integer', default: 0 })
    chunkCount: number;

    @Column({ type: 'text', nullable: true })
    errorMessage: string | null;

    @Index()
    @Column({ type: 'uuid', nullable: true })
    uploadedById: string | null;

    @OneToMany(() => KnowledgeDocumentChunk, (chunk) => chunk.document, {
        cascade: true,
    })
    chunks: KnowledgeDocumentChunk[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
