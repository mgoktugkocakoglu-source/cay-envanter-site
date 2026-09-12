/**
 * Minimal, dependency-free Markdown renderer for assistant answers.
 *
 * The input is HTML-escaped first, then a deliberately small set of Markdown
 * constructs is converted (headings, bold/italic, inline code, bullet and
 * numbered lists, paragraphs). Citation markers such as `[2]` or `[1][3]`
 * become `<button data-citation="2">` elements so the page can wire them to
 * the source list. No raw HTML from the model ever reaches the DOM.
 */

const ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

function renderInline(text: string, maxCitation: number): string {
    let html = escapeHtml(text);

    html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');

    html = html.replace(/\[(\d{1,2})\]/g, (match, digits: string) => {
        const index = Number(digits);
        if (!index || index > maxCitation) return match;
        return `<button type="button" class="citation" data-citation="${index}" aria-label="Kaynak ${index}">${index}</button>`;
    });

    return html;
}

/**
 * Converts assistant Markdown into safe HTML. `maxCitation` caps which `[n]`
 * markers become interactive (only numbers that map to a real source).
 */
export function renderMarkdown(markdown: string, maxCitation = 0): string {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let paragraph: string[] = [];
    let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

    const flushParagraph = (): void => {
        if (!paragraph.length) return;
        out.push(`<p>${renderInline(paragraph.join(' '), maxCitation)}</p>`);
        paragraph = [];
    };

    const flushList = (): void => {
        if (!list) return;
        const items = list.items.map((item) => `<li>${renderInline(item, maxCitation)}</li>`).join('');
        out.push(`<${list.type}>${items}</${list.type}>`);
        list = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph();
            flushList();
            const level = Math.min(heading[1].length + 2, 5);
            out.push(`<h${level}>${renderInline(heading[2], maxCitation)}</h${level}>`);
            continue;
        }

        const bullet = /^[-*•]\s+(.+)$/.exec(trimmed);
        if (bullet) {
            flushParagraph();
            if (!list || list.type !== 'ul') {
                flushList();
                list = { type: 'ul', items: [] };
            }
            list.items.push(bullet[1]);
            continue;
        }

        const numbered = /^\d{1,2}[.)]\s+(.+)$/.exec(trimmed);
        if (numbered) {
            flushParagraph();
            if (!list || list.type !== 'ol') {
                flushList();
                list = { type: 'ol', items: [] };
            }
            list.items.push(numbered[1]);
            continue;
        }

        if (list && /^\s{2,}/.test(line)) {
            list.items[list.items.length - 1] += ` ${trimmed}`;
            continue;
        }

        flushList();
        paragraph.push(trimmed);
    }

    flushParagraph();
    flushList();
    return out.join('');
}
