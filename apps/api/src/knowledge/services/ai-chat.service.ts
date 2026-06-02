import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatHistoryMessageDto } from '@/knowledge/dto';

/** A retrieved chunk passed to the model as grounding context. */
export interface RetrievedChunk {
    documentId: string;
    title: string;
    content: string;
}

interface GroqMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

const MAX_CONTEXT_CHARS_PER_CHUNK = 900;
const MAX_HISTORY_TURNS = 8;

/**
 * Talks to the Groq LLM API (OpenAI-compatible) to answer tea-farming
 * questions, grounded in retrieved knowledge-base passages plus the model's
 * own agronomy knowledge. Degrades gracefully to a retrieval-only answer when
 * no API key is configured or the request fails.
 */
@Injectable()
export class AiChatService {
    private readonly logger = new Logger(AiChatService.name);
    private readonly groqApiUrl =
        'https://api.groq.com/openai/v1/chat/completions';
    private readonly groqApiKey: string;
    private readonly model: string;

    constructor(private readonly configService: ConfigService) {
        this.groqApiKey = this.configService.get<string>('GROQ_API_KEY', '');
        this.model = this.configService.get<string>(
            'GROQ_MODEL',
            'llama-3.3-70b-versatile',
        );
    }

    get isConfigured(): boolean {
        return !!this.groqApiKey;
    }

    get modelName(): string {
        return this.model;
    }

    /**
     * Produces an answer for the user's message. Returns `usedAi: false` when
     * the response is the retrieval-only fallback rather than an LLM answer.
     */
    async answer(
        message: string,
        history: ChatHistoryMessageDto[],
        chunks: RetrievedChunk[],
    ): Promise<{ answer: string; usedAi: boolean }> {
        if (!this.isConfigured) {
            return { answer: this.buildFallbackAnswer(chunks), usedAi: false };
        }

        try {
            const messages: GroqMessage[] = [
                { role: 'system', content: this.buildSystemPrompt(chunks) },
                ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
                    role: turn.role,
                    content: turn.content,
                })),
                { role: 'user', content: message },
            ];

            const text = (await this.callGroqApi(messages)).trim();
            return text
                ? { answer: text, usedAi: true }
                : { answer: this.buildFallbackAnswer(chunks), usedAi: false };
        } catch (error) {
            this.logger.warn(`Groq chat request failed: ${error}`);
            return { answer: this.buildFallbackAnswer(chunks), usedAi: false };
        }
    }

    private buildSystemPrompt(chunks: RetrievedChunk[]): string {
        const context = chunks.length
            ? chunks
                  .map(
                      (chunk, index) =>
                          `[${index + 1}] ${chunk.title}\n${chunk.content.slice(
                              0,
                              MAX_CONTEXT_CHARS_PER_CHUNK,
                          )}`,
                  )
                  .join('\n\n')
            : '(Bu soru için bilgi tabanında ilgili belge bulunamadı.)';

        return `Sen "Çay Hesabım" platformunun çay tarımı uzmanı yapay zekâ danışmanısın. Doğu Karadeniz'deki çay üreticilerine ve tarım işçilerine yardımcı olursun.

Yanıt kuralların:
- Öncelikle aşağıdaki KAYNAK belgelerindeki bilgileri kullan. Bir bilgi kaynaklarda geçiyorsa ona dayan ve ilgili cümlenin sonunda [1], [2] gibi kaynak numarasını belirt.
- Kaynaklarda olmayan ama doğru bildiğin konularda kendi ziraat/tarım bilgini kullanabilirsin; bu durumda kaynak numarası ekleme.
- Emin olmadığın bir şeyi uydurma; bilgi yoksa açıkça "kaynaklarda bu bilgi yok" de.
- Sade, anlaşılır ve uygulanabilir Türkçe kullan. Mümkünse maddeler hâlinde, kısa ve net yaz.
- İlaçlama dozu, gübre miktarı, resmî destek ve mevzuat gibi kritik konularda yetkili ziraat mühendisine veya ilgili kuruma danışılmasını hatırlat.

KAYNAK BELGELER:
${context}`;
    }

    private buildFallbackAnswer(chunks: RetrievedChunk[]): string {
        if (!chunks.length) {
            return 'Şu anda yapay zekâ yanıtı üretilemiyor ve bu soruyla ilgili bilgi tabanında bir belge bulunamadı. Lütfen yöneticinin konuyla ilgili bir doküman (PDF/DOCX) yüklemesini isteyin veya sorunuzu farklı kelimelerle tekrar deneyin.';
        }

        const excerpts = chunks
            .slice(0, 3)
            .map(
                (chunk, index) =>
                    `${index + 1}. ${chunk.title}\n${chunk.content
                        .slice(0, 320)
                        .trim()}…`,
            )
            .join('\n\n');

        return `Yapay zekâ yanıtı şu an üretilemiyor; bunun yerine bilgi tabanından sorunuzla en ilgili bölümleri getirdim:\n\n${excerpts}`;
    }

    private async callGroqApi(messages: GroqMessage[]): Promise<string> {
        const response = await fetch(this.groqApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.groqApiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: 0.4,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            throw new Error(`Groq API returned status ${response.status}`);
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? '';
    }
}
