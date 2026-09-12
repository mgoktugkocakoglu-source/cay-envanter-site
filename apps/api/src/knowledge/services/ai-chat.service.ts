import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatHistoryMessageDto } from '@/knowledge/dto';

/** A retrieved chunk passed to the model as grounding context. */
export interface RetrievedChunk {
    chunkId: string;
    documentId: string;
    title: string;
    fileName: string;
    pageNumber: number | null;
    content: string;
    /** Fused relevance in [0, 1]. */
    score: number;
}

/** A turn in Gemini's `contents` array. Note Gemini uses `model`, not `assistant`. */
interface GeminiContent {
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
}

interface GenerationOptions {
    temperature: number;
    maxOutputTokens: number;
    /** Ask Gemini for strict JSON output. */
    json?: boolean;
}

interface GeminiCandidateResponse {
    candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
}

const MAX_CONTEXT_CHARS_PER_CHUNK = 1100;
const MAX_HISTORY_TURNS = 8;
const GEMINI_API_BASE =
    'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Talks to the Google Gemini API on behalf of the tea-farming agent. Answers
 * are grounded strictly in retrieved knowledge-base passages; the model is
 * told to refuse anything the sources do not cover. Also provides the small
 * helper generations (question condensing, follow-ups, starter questions).
 */
@Injectable()
export class AiChatService {
    private readonly logger = new Logger(AiChatService.name);
    private readonly apiKey: string;
    private readonly model: string;

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
        this.model = this.configService.get<string>(
            'GEMINI_MODEL',
            'gemini-3.1-flash-lite',
        );
    }

    get isConfigured(): boolean {
        return !!this.apiKey;
    }

    get modelName(): string {
        return this.model;
    }

    // ─── Answering ───

    /**
     * Streams a grounded answer, invoking `onDelta` for every text fragment.
     * Resolves with the full answer text. Throws when Gemini is unavailable.
     */
    async streamAnswer(
        message: string,
        history: ChatHistoryMessageDto[],
        chunks: RetrievedChunk[],
        onDelta: (text: string) => void,
        signal?: AbortSignal,
    ): Promise<string> {
        const contents = this.toContents(message, history);
        return this.generateStream(
            this.buildSystemPrompt(chunks),
            contents,
            { temperature: 0.2, maxOutputTokens: 2048 },
            onDelta,
            signal,
        );
    }

    /** Non-streaming variant of {@link streamAnswer}. */
    async answer(
        message: string,
        history: ChatHistoryMessageDto[],
        chunks: RetrievedChunk[],
    ): Promise<string> {
        const contents = this.toContents(message, history);
        return this.generate(this.buildSystemPrompt(chunks), contents, {
            temperature: 0.2,
            maxOutputTokens: 2048,
        });
    }

    /**
     * Rewrites a follow-up ("peki bunun dozu ne?") into a standalone question
     * so retrieval sees the full intent. Returns the original on any failure.
     */
    async condenseQuestion(
        message: string,
        history: ChatHistoryMessageDto[],
    ): Promise<string> {
        if (!this.isConfigured || !history.length) {
            return message;
        }

        const transcript = history
            .slice(-MAX_HISTORY_TURNS)
            .map((turn) => `${turn.role === 'user' ? 'Kullanıcı' : 'Asistan'}: ${turn.content.slice(0, 600)}`)
            .join('\n');

        try {
            const rewritten = await this.generate(
                'Görevin: bir sohbetteki son kullanıcı mesajını, önceki bağlamı da içerecek şekilde tek başına anlaşılır ve arama motoruna uygun kısa bir soruya dönüştürmek. Yalnızca yeniden yazılmış soruyu döndür; açıklama, tırnak veya ek metin ekleme. Mesaj zaten tek başına anlaşılıyorsa olduğu gibi döndür.',
                [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `SOHBET:\n${transcript}\n\nSON MESAJ: ${message}`,
                            },
                        ],
                    },
                ],
                { temperature: 0, maxOutputTokens: 160 },
            );
            const clean = rewritten.trim().replace(/^["'`]+|["'`]+$/g, '');
            return clean.length >= 3 && clean.length <= 400 ? clean : message;
        } catch (error) {
            this.logger.warn(`Question condensing failed: ${error}`);
            return message;
        }
    }

    /** Suggests up to three grounded follow-up questions; empty on failure. */
    async suggestFollowUps(
        question: string,
        answer: string,
        chunks: RetrievedChunk[],
    ): Promise<string[]> {
        if (!this.isConfigured || !chunks.length) {
            return [];
        }

        const context = chunks
            .slice(0, 4)
            .map((chunk) => chunk.content.slice(0, 500))
            .join('\n---\n');

        try {
            const raw = await this.generate(
                'Kullanıcının bir sonraki adımda sorabileceği, YALNIZCA verilen kaynak metinlerden cevaplanabilecek 3 kısa Türkçe takip sorusu üret. Sorular çay üreticisi için pratik ve somut olsun, en fazla 90 karakter. JSON dizi olarak döndür: ["soru 1","soru 2","soru 3"].',
                [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `SORU: ${question}\n\nCEVAP: ${answer.slice(0, 1500)}\n\nKAYNAK METİNLER:\n${context}`,
                            },
                        ],
                    },
                ],
                { temperature: 0.5, maxOutputTokens: 300, json: true },
            );
            return this.parseQuestionList(raw, 3);
        } catch (error) {
            this.logger.warn(`Follow-up suggestion failed: ${error}`);
            return [];
        }
    }

    /** Starter questions a freshly indexed document can answer; empty on failure. */
    async suggestDocumentQuestions(
        title: string,
        sampleText: string,
    ): Promise<string[]> {
        if (!this.isConfigured || !sampleText.trim()) {
            return [];
        }

        try {
            const raw = await this.generate(
                'Sana bir belgenin başlığı ve metninden örnekler verilecek. Çay üreticisinin bu belgeye dayanarak sorabileceği, belgede cevabı kesin olarak bulunan 4 kısa Türkçe soru üret (en fazla 90 karakter, soru işaretiyle bitsin). JSON dizi olarak döndür.',
                [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `BELGE BAŞLIĞI: ${title}\n\nMETİN ÖRNEKLERİ:\n${sampleText.slice(0, 6000)}`,
                            },
                        ],
                    },
                ],
                { temperature: 0.5, maxOutputTokens: 400, json: true },
            );
            return this.parseQuestionList(raw, 4);
        } catch (error) {
            this.logger.warn(`Document question suggestion failed: ${error}`);
            return [];
        }
    }

    // ─── Prompts ───

    private buildSystemPrompt(chunks: RetrievedChunk[]): string {
        const context = chunks.length
            ? chunks
                  .map((chunk, index) => {
                      const page = chunk.pageNumber ? `, sayfa ${chunk.pageNumber}` : '';
                      return `[${index + 1}] ${chunk.title}${page}\n${chunk.content.slice(
                          0,
                          MAX_CONTEXT_CHARS_PER_CHUNK,
                      )}`;
                  })
                  .join('\n\n')
            : '(Bu soru için bilgi tabanında ilgili belge bulunamadı.)';

        return `Sen "Çay Hesabım" platformunun çay uzmanı asistanısın. Doğu Karadeniz'deki çay üreticilerine ve tarım işçilerine yardım edersin. Tek bilgi kaynağın aşağıdaki KAYNAK BELGELER'dir.

KESİN KURALLAR:
1. Yalnızca KAYNAK BELGELER'de açıkça yer alan bilgiyle yanıt ver. Genel bilgini, tahminini veya belgelerde olmayan hiçbir sayıyı, tarihi, fiyatı, dozu ekleme.
2. Her bilgi cümlesinin sonuna dayandığı kaynağın numarasını [1], [2] biçiminde ekle. Birden fazla kaynak varsa [1][3] gibi yaz.
3. Kaynaklar soruyu tam olarak yanıtlamıyorsa bunu açıkça söyle: "Yüklü belgelerde bu konuda bilgi yok." Kaynaklarda kısmen ilgili bilgi varsa yalnızca o kısmı aktar ve eksik kalan noktayı belirt.
4. Soru çay tarımı, çay üretimi, çay ekonomisi, çay mevzuatı veya çay işletmeciliği dışındaysa kibarca yalnızca çay konusunda yardımcı olabildiğini söyle.
5. Kaynak metinleri özetle, kopyalama; ancak resmî tutar, oran, tarih ve madde numaralarını aynen aktar.
6. Sade ve anlaşılır Türkçe kullan. Kısa paragraflar veya madde işaretleri kullan; gerekirse **kalın** vurgula. Tablo kullanma.
7. İlaçlama, gübre dozu, resmî destek ve mevzuat gibi konularda son kararı ziraat mühendisine veya ilgili kuruma danışarak vermeleri gerektiğini tek cümleyle hatırlat.
8. Yanıtın sonuna kaynak listesi yazma; kaynaklar arayüzde ayrıca gösterilir.

KAYNAK BELGELER:
${context}`;
    }

    buildFallbackAnswer(chunks: RetrievedChunk[]): string {
        if (!chunks.length) {
            return 'Yüklü belgelerde bu konuda bilgi bulamadım. Sorunuzu farklı kelimelerle deneyebilir veya sağdaki kütüphaneden ilgili belgeyi açabilirsiniz.';
        }

        const excerpts = chunks
            .slice(0, 3)
            .map((chunk, index) => {
                const page = chunk.pageNumber ? ` (sayfa ${chunk.pageNumber})` : '';
                return `**${index + 1}. ${chunk.title}${page}**\n${chunk.content
                    .slice(0, 320)
                    .trim()}…`;
            })
            .join('\n\n');

        return `Yapay zekâ yanıtı şu an üretilemiyor; bunun yerine belgelerden sorunuzla en ilgili bölümleri getirdim:\n\n${excerpts}`;
    }

    private toContents(
        message: string,
        history: ChatHistoryMessageDto[],
    ): GeminiContent[] {
        const contents: GeminiContent[] = [
            ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
                role: (turn.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
                parts: [{ text: turn.content }],
            })),
            { role: 'user', parts: [{ text: message }] },
        ];

        // Gemini requires the conversation to begin with a user turn.
        while (contents.length > 1 && contents[0].role === 'model') {
            contents.shift();
        }
        return contents;
    }

    private parseQuestionList(raw: string, max: number): string[] {
        const start = raw.indexOf('[');
        const end = raw.lastIndexOf(']');
        if (start === -1 || end === -1) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .filter((item): item is string => typeof item === 'string')
                .map((item) => item.trim())
                .filter((item) => item.length >= 8 && item.length <= 140)
                .slice(0, max);
        } catch {
            return [];
        }
    }

    // ─── Gemini transport ───

    private buildBody(
        systemPrompt: string,
        contents: GeminiContent[],
        options: GenerationOptions,
    ): string {
        return JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
                temperature: options.temperature,
                maxOutputTokens: options.maxOutputTokens,
                ...(options.json ? { responseMimeType: 'application/json' } : {}),
            },
        });
    }

    private async generate(
        systemPrompt: string,
        contents: GeminiContent[],
        options: GenerationOptions,
    ): Promise<string> {
        const response = await fetch(`${GEMINI_API_BASE}/${this.model}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey,
            },
            body: this.buildBody(systemPrompt, contents, options),
        });

        if (!response.ok) {
            throw new Error(`Gemini API returned status ${response.status}`);
        }

        const data = (await response.json()) as GeminiCandidateResponse;
        if (data.promptFeedback?.blockReason) {
            throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
        }
        return this.extractText(data);
    }

    /**
     * Calls `streamGenerateContent?alt=sse` and forwards each text fragment as
     * it arrives. Gemini sends one `data: {...}` JSON line per fragment.
     */
    private async generateStream(
        systemPrompt: string,
        contents: GeminiContent[],
        options: GenerationOptions,
        onDelta: (text: string) => void,
        signal?: AbortSignal,
    ): Promise<string> {
        const response = await fetch(
            `${GEMINI_API_BASE}/${this.model}:streamGenerateContent?alt=sse`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey,
                },
                body: this.buildBody(systemPrompt, contents, options),
                signal,
            },
        );

        if (!response.ok || !response.body) {
            throw new Error(`Gemini API returned status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let full = '';

        const handleLine = (line: string): void => {
            if (!line.startsWith('data:')) {
                return;
            }
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') {
                return;
            }
            const data = JSON.parse(payload) as GeminiCandidateResponse;
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
            }
            const text = this.extractText(data);
            if (text) {
                full += text;
                onDelta(text);
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            let newline = buffer.indexOf('\n');
            while (newline !== -1) {
                handleLine(buffer.slice(0, newline).trimEnd());
                buffer = buffer.slice(newline + 1);
                newline = buffer.indexOf('\n');
            }
        }
        if (buffer.trim()) {
            handleLine(buffer.trim());
        }

        return full;
    }

    private extractText(data: GeminiCandidateResponse): string {
        return (
            data.candidates?.[0]?.content?.parts
                ?.map((part) => part.text ?? '')
                .join('') ?? ''
        );
    }
}
