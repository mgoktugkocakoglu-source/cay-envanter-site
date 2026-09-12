import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GEMINI_API_BASE =
    'https://generativelanguage.googleapis.com/v1beta/models';

/** Dimensions kept per vector; Gemini truncates (MRL) and we re-normalise. */
export const EMBEDDING_DIMENSIONS = 768;

/** Gemini caps batchEmbedContents at 100 requests per call. */
const BATCH_SIZE = 100;
const MAX_EMBED_CHARS = 6000;

type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

interface EmbedRequest {
    model: string;
    content: { parts: Array<{ text: string }> };
    taskType?: EmbeddingTaskType;
    outputDimensionality: number;
}

/**
 * Produces dense vectors with the Gemini embedding API so retrieval can match
 * meaning ("verim düşüklüğü" ≈ "üretim kaybı") rather than only keywords.
 * Every method is a no-op returning `null` when no API key is configured.
 */
@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name);
    private readonly apiKey: string;
    private readonly model: string;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
        this.model = this.configService.get<string>(
            'GEMINI_EMBEDDING_MODEL',
            'gemini-embedding-001',
        );
    }

    get isConfigured(): boolean {
        return !!this.apiKey;
    }

    get modelName(): string {
        return this.model;
    }

    /** Embeds a search query; returns null when embeddings are unavailable. */
    async embedQuery(text: string): Promise<number[] | null> {
        if (!this.isConfigured || !text.trim()) {
            return null;
        }
        try {
            const [vector] = await this.embedBatch([text], 'RETRIEVAL_QUERY');
            return vector ?? null;
        } catch (error) {
            this.logger.warn(`Query embedding failed: ${error}`);
            return null;
        }
    }

    /**
     * Embeds document passages in API-sized batches. Throws on failure so the
     * caller can mark the document as keyword-only.
     */
    async embedDocuments(texts: string[]): Promise<number[][]> {
        if (!this.isConfigured) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        const vectors: number[][] = [];
        for (let start = 0; start < texts.length; start += BATCH_SIZE) {
            const batch = texts.slice(start, start + BATCH_SIZE);
            vectors.push(...(await this.embedBatch(batch, 'RETRIEVAL_DOCUMENT')));
        }
        return vectors;
    }

    private async embedBatch(
        texts: string[],
        taskType: EmbeddingTaskType,
    ): Promise<number[][]> {
        const requests: EmbedRequest[] = texts.map((text) => ({
            model: `models/${this.model}`,
            content: { parts: [{ text: text.slice(0, MAX_EMBED_CHARS) }] },
            // gemini-embedding-2 takes task hints in the prompt instead.
            ...(this.model.includes('embedding-001') ? { taskType } : {}),
            outputDimensionality: EMBEDDING_DIMENSIONS,
        }));

        const response = await fetch(
            `${GEMINI_API_BASE}/${this.model}:batchEmbedContents`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey,
                },
                body: JSON.stringify({ requests }),
            },
        );

        if (!response.ok) {
            throw new Error(`Gemini embedding API returned status ${response.status}`);
        }

        const data = (await response.json()) as {
            embeddings?: Array<{ values?: number[] }>;
        };
        const embeddings = data.embeddings ?? [];
        if (embeddings.length !== texts.length) {
            throw new Error(
                `Gemini returned ${embeddings.length} embeddings for ${texts.length} inputs`,
            );
        }

        return embeddings.map((item) => normalise(item.values ?? []));
    }
}

/** Scales a vector to unit length so a dot product equals cosine similarity. */
export function normalise(vector: number[]): number[] {
    let sumSquares = 0;
    for (const value of vector) {
        sumSquares += value * value;
    }
    const magnitude = Math.sqrt(sumSquares);
    if (!magnitude) {
        return vector;
    }
    return vector.map((value) => value / magnitude);
}

/** Cosine similarity of two unit vectors of equal length. */
export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
    const length = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < length; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}
