/**
 * DEV-ONLY. Replaces the knowledge/AI-agent API calls with in-memory data so
 * /dev/preview/ai-agent can exercise streaming answers, citations and the
 * document viewer without a session or a Gemini key.
 */
import {
    api,
    type KnowledgeChatSource,
    type KnowledgeChatStreamEvent,
    type KnowledgeDocument,
    type KnowledgeStatus,
} from '@/services/api';

/** A 3-page text PDF (budama desteği / yaş çay fiyatı / gübreleme takvimi). */
const SAMPLE_PDF_BASE64 =
    'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFs0IDAgUiA2IDAgUiA4IDAgUl0gL0NvdW50IDMgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL0xlbmd0aCA0MTUgPj4Kc3RyZWFtCkJUCi9GMSAxNCBUZgovRjEgMTggVGYKMSAwIDAgMSA2MCA3NjAgVG0gKEJVREFNQSBERVNURUdJIEtBUkFSTkFNRVNJIDIwMjYpIFRqCi9GMSAxMiBUZgoxIDAgMCAxIDYwIDczMiBUbSAoTWFkZGUgMTogQ2F5IGJhaGNlbGVyaW5kZSBidWRhbWEgeWFwYW4gdXJldGljaWxlcmUgZGVrYXIgYmFzaW5hIDg1MCBUTCBkZXN0ZWsgb2RlbmlyLikgVGoKL0YxIDEyIFRmCjEgMCAwIDEgNjAgNzEwIFRtIChNYWRkZSAyOiBEZXN0ZWssIGJ1ZGFtYW5pbiBDYXlrdXIgZWtzcGVyaSB0YXJhZmluZGFuIG9uYXlsYW5tYXNpbmRhbiBzb25yYSBvZGVuaXIuKSBUagovRjEgMTIgVGYKMSAwIDAgMSA2MCA2ODggVG0gKE1hZGRlIDM6IEJhc3Z1cnVsYXIgMSBFa2ltIC0gMzEgQXJhbGlrIHRhcmlobGVyaSBhcmFzaW5kYSB5YXBpbGlyLikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iago0IDAgb2JqCjw8IC9UeXBlIC9QYWdlIC9QYXJlbnQgMiAwIFIgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0gL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgMSAwIFIgPj4gPj4gL0NvbnRlbnRzIDMgMCBSID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggMzYyID4+CnN0cmVhbQpCVAovRjEgMTQgVGYKL0YxIDE4IFRmCjEgMCAwIDEgNjAgNzYwIFRtIChZQVMgQ0FZIEFMSU0gRklZQVRJKSBUagovRjEgMTIgVGYKMSAwIDAgMSA2MCA3MzIgVG0gKDIwMjYgc2V6b251IHlhcyBjYXkgYWxpbSBmaXlhdGkga2lsb2dyYW0gYmFzaW5hIDE3IFRMIG9sYXJhayBiZWxpcmxlbm1pc3Rpci4pIFRqCi9GMSAxMiBUZgoxIDAgMCAxIDYwIDcxMCBUbSAoRml5YXRhIGVrIG9sYXJhayBraWxvZ3JhbSBiYXNpbmEgMSBUTCBkZXN0ZWtsZW1lIHByaW1pIG9kZW5pci4pIFRqCi9GMSAxMiBUZgoxIDAgMCAxIDYwIDY4OCBUbSAoS290YSwgcnVoc2F0bGkgYWxhbiBiYXNpbmEgZGVrYXIgaWNpbiAzMDAga2lsb2dyYW1kaXIuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAxIDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjcgMCBvYmoKPDwgL0xlbmd0aCAzNTcgPj4Kc3RyZWFtCkJUCi9GMSAxNCBUZgovRjEgMTggVGYKMSAwIDAgMSA2MCA3NjAgVG0gKEdVQlJFTEVNRSBUQUtWSU1JKSBUagovRjEgMTIgVGYKMSAwIDAgMSA2MCA3MzIgVG0gKENheSBiYWhjZWxlcmluZSBndWJyZSwgYnVkYW1hIHNvbnJhc2kgTWFydCB2ZSBOaXNhbiBheWxhcmluZGEgdmVyaWxpci4pIFRqCi9GMSAxMiBUZgoxIDAgMCAxIDYwIDcxMCBUbSAoRGVrYXIgYmFzaW5hIG9uZXJpbGVuIG1pa3RhciA2MCBraWxvZ3JhbSBrb21wb3plIGd1YnJlZGlyLikgVGoKL0YxIDEyIFRmCjEgMCAwIDEgNjAgNjg4IFRtIChHdWJyZSwgeWFnbXVyZGFuIG9uY2UgdmUgb2NhayBkaXBsZXJpbmUgc2VycGlsZXJlayB1eWd1bGFuaXIuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjggMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSAxIDAgUiA+PiA+PiAvQ29udGVudHMgNyAwIFIgPj4KZW5kb2JqCjkgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSID4+CmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE0OCAwMDAwMCBuIAowMDAwMDAwNjE0IDAwMDAwIG4gCjAwMDAwMDA3NDAgMDAwMDAgbiAKMDAwMDAwMTE1MyAwMDAwMCBuIAowMDAwMDAxMjc5IDAwMDAwIG4gCjAwMDAwMDE2ODcgMDAwMDAgbiAKMDAwMDAwMTgxMyAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDEwIC9Sb290IDkgMCBSID4+CnN0YXJ0eHJlZgoxODYyCiUlRU9GCg==';

function samplePdfBlob(): Blob {
    const binary = atob(SAMPLE_PDF_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'application/pdf' });
}

export const mockKnowledgeDocuments: KnowledgeDocument[] = [
    {
        id: 'kd1', title: 'Budama Gelir Kararnamesi 2026', fileName: 'budama-kararname-2026.pdf', mimeType: 'application/pdf',
        fileSize: 254_000, status: 'ready', charCount: 8_400, chunkCount: 9, embeddedChunkCount: 9, pageCount: 3, hasFile: true,
        suggestedQuestions: ['Budama desteği dekar başına ne kadar?', 'Budama desteği başvurusu hangi tarihlerde yapılır?'],
        errorMessage: null, createdAt: '2026-09-12T09:00:00Z',
    },
    {
        id: 'kd2', title: 'Yaş Çay Alım Kararnamesi', fileName: 'yas-cay-alim-2026.pdf', mimeType: 'application/pdf',
        fileSize: 381_000, status: 'ready', charCount: 12_100, chunkCount: 14, embeddedChunkCount: 14, pageCount: 7, hasFile: true,
        suggestedQuestions: ['2026 yaş çay alım fiyatı kaç TL?', 'Dekar başına kota kaç kilogram?'],
        errorMessage: null, createdAt: '2026-09-12T09:05:00Z',
    },
    {
        id: 'kd3', title: 'Çay Ürün Raporu 2025', fileName: 'cay-urun-raporu-2025.pdf', mimeType: 'application/pdf',
        fileSize: 973_000, status: 'ready', charCount: 41_000, chunkCount: 33, embeddedChunkCount: 0, pageCount: 24, hasFile: false,
        suggestedQuestions: ['Rize çay üretimi son yıllarda nasıl değişti?'],
        errorMessage: 'Anlamsal indeksleme başarısız oldu; belge yalnızca anahtar kelimeyle aranıyor. Yeniden indekslemeyi deneyin.',
        createdAt: '2026-09-11T14:00:00Z',
    },
    {
        id: 'kd4', title: 'Stratejik Planlama', fileName: 'stratejik-planlama.pdf', mimeType: 'application/pdf',
        fileSize: 3_200_000, status: 'processing', charCount: 210_000, chunkCount: 179, embeddedChunkCount: 0, pageCount: 96, hasFile: true,
        suggestedQuestions: [], errorMessage: null, createdAt: '2026-09-12T10:00:00Z',
    },
    {
        id: 'kd5', title: 'Gübreleme Notları', fileName: 'gubreleme-notlari.md', mimeType: 'text/markdown',
        fileSize: 4_200, status: 'ready', charCount: 4_100, chunkCount: 4, embeddedChunkCount: 4, pageCount: 0, hasFile: true,
        suggestedQuestions: ['Çay bahçesine gübre hangi aylarda verilir?'], errorMessage: null, createdAt: '2026-09-10T08:00:00Z',
    },
];

export const mockKnowledgeStatus: KnowledgeStatus = {
    aiConfigured: true, model: 'gemini-3.1-flash-lite', embeddingModel: 'gemini-embedding-001', fileStorage: 'r2',
    documentCount: 5, readyDocumentCount: 4, chunkCount: 239, embeddedChunkCount: 27, pageCount: 130,
};

const mockSources: KnowledgeChatSource[] = [
    { index: 1, chunkId: 'c1', documentId: 'kd1', title: 'Budama Gelir Kararnamesi 2026', fileName: 'budama-kararname-2026.pdf', pageNumber: 1, snippet: 'Madde 1: Çay bahçelerinde budama yapan üreticilere dekar başına 850 TL destek ödenir…', score: 0.98 },
    { index: 2, chunkId: 'c2', documentId: 'kd1', title: 'Budama Gelir Kararnamesi 2026', fileName: 'budama-kararname-2026.pdf', pageNumber: 3, snippet: 'Madde 3: Başvurular 1 Ekim – 31 Aralık tarihleri arasında yapılır…', score: 0.71 },
    { index: 3, chunkId: 'c3', documentId: 'kd5', title: 'Gübreleme Notları', fileName: 'gubreleme-notlari.md', pageNumber: null, snippet: 'Gübre, budama sonrası Mart ve Nisan aylarında, ocak diplerine serpilerek verilir…', score: 0.52 },
];

const MOCK_ANSWER = `**Budama desteği** dekar başına **850 TL** olarak ödenir [1]. Ödeme, budamanın Çaykur eksperi tarafından onaylanmasından sonra yapılır [1].

Başvuru dönemi:
- Başvurular **1 Ekim – 31 Aralık** tarihleri arasında alınır [2].
- Budama sonrası gübreleme Mart ve Nisan aylarında yapılır [3].

Son kararı vermeden önce ilgili Çaykur birimine danışmanız önerilir.`;

const MOCK_FOLLOW_UPS = ['Budama onayını kim verir?', 'Başvuru için hangi belgeler gerekli?', 'Gübre miktarı dekar başına ne kadar?'];

export function installKnowledgePreviewMocks(): void {
    api.getKnowledgeStatus = async () => ({ data: mockKnowledgeStatus });
    api.getKnowledgeDocuments = async () => ({ data: mockKnowledgeDocuments });
    api.getKnowledgeDocumentFile = async (id) => {
        const document = mockKnowledgeDocuments.find((item) => item.id === id);
        if (!document?.hasFile) return { error: { message: 'Bu belgenin orijinal dosyası saklanmamış.', statusCode: 404 } };
        if (document.mimeType.startsWith('text/')) {
            return { data: new Blob(['# Gübreleme Notları\n\nGübre, budama sonrası Mart ve Nisan aylarında verilir.'], { type: 'text/markdown' }) };
        }
        return { data: samplePdfBlob() };
    };
    api.reindexKnowledgeDocument = async (id) => ({ data: mockKnowledgeDocuments.find((item) => item.id === id) });
    api.reindexKnowledge = async () => ({ data: { queued: mockKnowledgeDocuments.length } });
    api.deleteKnowledgeDocument = async () => ({ data: undefined });
    api.streamKnowledgeChat = async (_message, _history, onEvent: (event: KnowledgeChatStreamEvent) => void, signal) => {
        const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
        await wait(400);
        onEvent({ type: 'meta', sources: mockSources, retrievalMode: 'hybrid', usedAi: true });
        const words = MOCK_ANSWER.split(/(?<=\s)/);
        for (const word of words) {
            if (signal?.aborted) return;
            await wait(35);
            onEvent({ type: 'delta', text: word });
        }
        await wait(300);
        onEvent({ type: 'done', answer: MOCK_ANSWER, followUps: MOCK_FOLLOW_UPS });
    };
}
