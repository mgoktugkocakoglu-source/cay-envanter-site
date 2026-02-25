import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CommunityTag } from '@/community/entities';

/**
 * Handles AI-powered auto-tagging of community posts using the Groq free LLM API.
 * Falls back gracefully if the API is unavailable or returns invalid data.
 */
@Injectable()
export class TaggingService {
    private readonly logger = new Logger(TaggingService.name);
    private readonly groqApiKey: string;
    private readonly groqApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    private readonly model = 'llama-3.1-8b-instant';

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(CommunityTag)
        private readonly tagRepository: Repository<CommunityTag>,
    ) {
        this.groqApiKey = this.configService.get<string>('GROQ_API_KEY', '');
    }

    /**
     * Analyzes post content and returns suggested tag names using the Groq LLM.
     * Returns an empty array on failure so posts can still be created without tags.
     */
    async suggestTags(postContent: string): Promise<string[]> {
        if (!this.groqApiKey || !postContent?.trim()) {
            return [];
        }

        try {
            const existingTags = await this.tagRepository.find();
            const tagNames = existingTags.map((tag) => tag.name);

            const prompt = this.buildPrompt(postContent, tagNames);
            const response = await this.callGroqApi(prompt);
            const suggestedTags = this.parseResponse(response);

            this.logger.log(`AI suggested tags for post: [${suggestedTags.join(', ')}]`);
            return suggestedTags;
        } catch (error) {
            this.logger.warn(`Tag suggestion failed, post will be created without tags: ${error}`);
            return [];
        }
    }

    /**
     * Resolves tag names into Tag entities, creating new tags if they don't exist.
     */
    async resolveTagEntities(tagNames: string[]): Promise<CommunityTag[]> {
        if (!tagNames.length) {
            return [];
        }

        const uniqueNames = [...new Set(tagNames.map((name) => name.toLowerCase().trim()))];
        const existingTags = await this.tagRepository.find({
            where: { name: In(uniqueNames) },
        });

        const existingNames = new Set(existingTags.map((tag) => tag.name));
        const newTagNames = uniqueNames.filter((name) => !existingNames.has(name));

        const newTags: CommunityTag[] = [];
        for (const name of newTagNames) {
            const tag = this.tagRepository.create({
                name,
                displayName: name,
                isSystem: false,
            });
            const savedTag = await this.tagRepository.save(tag);
            newTags.push(savedTag);
        }

        return [...existingTags, ...newTags];
    }

    private buildPrompt(postContent: string, existingTags: string[]): string {
        const tagList = existingTags.length > 0
            ? existingTags.join(', ')
            : 'işçi-ilanı, çay-motoru, hasat, gübre, tarla-kiralama, iş-arıyorum, tavsiye, soru, haber, satılık, alınır';

        return `Sen bir tarımsal sosyal platform için içerik etiketleme uzmanısın.
Aşağıdaki gönderi metnini analiz et ve en uygun 1-3 etiketi seç.
Eğer mevcut etiketlerden hiçbiri uygun değilse, kısa ve açıklayıcı yeni bir etiket önerebilirsin.
Etiketler küçük harfli, Türkçe ve tire ile ayrılmış olmalıdır (örnek: çay-motoru).

Mevcut etiket havuzu: [${tagList}]

Gönderi metni: "${postContent}"

Cevabını sadece JSON formatında ver, başka bir şey yazma: {"tags": ["tag1", "tag2"]}`;
    }

    private async callGroqApi(prompt: string): Promise<string> {
        const body = JSON.stringify({
            model: this.model,
            messages: [
                { role: 'system', content: 'You are a helpful tagging assistant. Respond only in JSON.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 100,
        });

        const response = await fetch(this.groqApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.groqApiKey}`,
            },
            body,
        });

        if (!response.ok) {
            throw new Error(`Groq API returned status ${response.status}`);
        }

        const data = await response.json() as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        return data.choices?.[0]?.message?.content ?? '';
    }

    private parseResponse(responseContent: string): string[] {
        try {
            /** Strip markdown code fences if present */
            const cleaned = responseContent
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

            const parsed = JSON.parse(cleaned);

            if (Array.isArray(parsed.tags)) {
                return parsed.tags
                    .filter((tag: unknown): tag is string => typeof tag === 'string')
                    .map((tag: string) => tag.toLowerCase().trim())
                    .slice(0, 3);
            }

            return [];
        } catch {
            this.logger.warn(`Failed to parse LLM response: ${responseContent}`);
            return [];
        }
    }
}
