import { api, type KnowledgeDocument } from '@/services/api';

/** Short label for the document format chip. */
export function documentKind(document: Pick<KnowledgeDocument, 'fileName' | 'mimeType'>): string {
    const name = document.fileName.toLowerCase();
    if (document.mimeType.includes('pdf') || name.endsWith('.pdf')) return 'PDF';
    if (document.mimeType.includes('word') || name.endsWith('.docx')) return 'Word';
    if (name.endsWith('.md')) return 'MD';
    return 'Metin';
}

export function formatBytes(bytes: number): string {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/**
 * Downloads the original file through the authenticated API and hands it to
 * the browser with its real file name. Resolves with an error message on
 * failure, or an empty string on success.
 */
export async function downloadKnowledgeDocument(document: KnowledgeDocument): Promise<string> {
    if (!document.hasFile) {
        return 'Bu belgenin orijinal dosyası saklanmamış.';
    }

    const { data, error } = await api.getKnowledgeDocumentFile(document.id, true);
    if (!data) {
        return error?.message ?? 'Dosya indirilemedi.';
    }

    const url = URL.createObjectURL(data);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.fileName;
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Give the browser a moment to start the download before revoking.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return '';
}
