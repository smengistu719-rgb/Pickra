import { generateSafeDocId } from '../firebase';
import { CalloutColorTheme } from '../types';

export type StoryBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'subheading'; text: string }
  | { id: string; type: 'quote'; text: string }
  | {
      id: string;
      type: 'callout';
      theme: CalloutColorTheme;
      title: string;
      text: string;
    }
  | {
      id: string;
      type: 'image';
      src: string;
      caption: string;
      linkUrl: string;
      wide: boolean;
    }
  | {
      id: string;
      type: 'video';
      url: string;
      caption: string;
    }
  | {
      id: string;
      type: 'bookmark';
      url: string;
      title: string;
      description: string;
      ctaLabel: string;
    }
  | { id: string; type: 'offer'; offerId: string }
  | { id: string; type: 'product'; productId: string }
  | { id: string; type: 'divider' };

const VALID_CALLOUT_THEMES: CalloutColorTheme[] = [
  'amber',
  'sage',
  'terracotta',
  'slate',
  'midnight',
];

export function createBlockId(): string {
  return generateSafeDocId('blk');
}

export function createEmptyParagraphBlock(text = ''): StoryBlock {
  return { id: createBlockId(), type: 'paragraph', text };
}

function sanitizeBracketText(input: string): string {
  return input.replace(/[\[\]\n\r]/g, ' ').replace(/\|/g, '—').trim();
}

export function blocksToMarkdown(blocks: StoryBlock[]): string {
  const serialized: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph': {
        const t = block.text.trim();
        if (t) serialized.push(t);
        break;
      }
      case 'heading': {
        const t = block.text.trim();
        if (t) serialized.push(`## ${t}`);
        break;
      }
      case 'subheading': {
        const t = block.text.trim();
        if (t) serialized.push(`### ${t}`);
        break;
      }
      case 'quote': {
        const t = block.text.trim();
        if (t) {
          const lines = t
            .split('\n')
            .map((l) => `> ${l.trim()}`)
            .join('\n');
          serialized.push(lines);
        }
        break;
      }
      case 'callout': {
        const cleanTitle = sanitizeBracketText(block.title || 'Editorial Note');
        const cleanBody = block.text.trim();
        if (cleanTitle || cleanBody) {
          const theme: CalloutColorTheme = VALID_CALLOUT_THEMES.includes(block.theme)
            ? block.theme
            : 'amber';
          const bodyLines = (cleanBody || cleanTitle)
            .split('\n')
            .map((l) => `> ${l.trim()}`)
            .join('\n');
          serialized.push(`> [!${theme}] ${cleanTitle}\n${bodyLines}`);
        }
        break;
      }
      case 'divider': {
        serialized.push('---');
        break;
      }
      case 'offer': {
        if (block.offerId.trim()) {
          serialized.push(`[[offer:${block.offerId.trim()}]]`);
        }
        break;
      }
      case 'product': {
        if (block.productId.trim()) {
          serialized.push(`[[product:${block.productId.trim()}]]`);
        }
        break;
      }
      case 'image': {
        const src = block.src.trim();
        if (!src) break;
        const cleanCaption = sanitizeBracketText(block.caption);
        const altPayload = block.wide ? `wide|${cleanCaption}` : cleanCaption;
        const cleanLink = block.linkUrl.trim();
        if (cleanLink && cleanLink.startsWith('https://')) {
          serialized.push(`[![${altPayload}](${src})](${cleanLink})`);
        } else {
          serialized.push(`![${altPayload}](${src})`);
        }
        break;
      }
      case 'video': {
        const url = block.url.trim();
        if (!url) break;
        const cleanCaption = sanitizeBracketText(block.caption);
        serialized.push(`@[video:${cleanCaption}](${url})`);
        break;
      }
      case 'bookmark': {
        const url = block.url.trim();
        if (!url) break;
        const safeTitle = sanitizeBracketText(block.title || extractHostnameLabel(url));
        const safeDesc = sanitizeBracketText(block.description);
        const safeCta = sanitizeBracketText(block.ctaLabel || 'Visit Link');
        serialized.push(`@[bookmark:${safeTitle} | ${safeDesc} | ${safeCta}](${url})`);
        break;
      }
    }
  }

  return serialized.join('\n\n');
}

function parseSingleChunk(chunk: string): StoryBlock {
  const trimmed = chunk.trim();

  if (trimmed === '---' || trimmed === '***') {
    return { id: createBlockId(), type: 'divider' };
  }

  const offerMatch = trimmed.match(/^\[\[offer:([a-zA-Z0-9_-]+)\]\]$/);
  if (offerMatch) {
    return { id: createBlockId(), type: 'offer', offerId: offerMatch[1] };
  }

  const productMatch = trimmed.match(/^\[\[product:([a-zA-Z0-9_-]+)\]\]$/);
  if (productMatch) {
    return { id: createBlockId(), type: 'product', productId: productMatch[1] };
  }

  const videoMatch = trimmed.match(/^@\[video:([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
  if (videoMatch) {
    return {
      id: createBlockId(),
      type: 'video',
      caption: videoMatch[1].trim(),
      url: videoMatch[2].trim(),
    };
  }

  const bookmarkMatch = trimmed.match(/^@\[bookmark:([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
  if (bookmarkMatch) {
    const parts = bookmarkMatch[1].split('|').map((s) => s.trim());
    const url = bookmarkMatch[2].trim();
    return {
      id: createBlockId(),
      type: 'bookmark',
      title: parts[0] || extractHostnameLabel(url),
      description: parts[1] || '',
      ctaLabel: parts[2] || 'Visit Link',
      url,
    };
  }

  const linkedImgMatch = trimmed.match(
    /^\[!\[([^\]]*)\]\(([^)]+)\)\]\((https?:\/\/[^)]+)\)$/
  );
  if (linkedImgMatch) {
    const rawAlt = linkedImgMatch[1];
    const wide = rawAlt.startsWith('wide|');
    const caption = wide ? rawAlt.slice(5).trim() : rawAlt.trim();
    return {
      id: createBlockId(),
      type: 'image',
      src: linkedImgMatch[2].trim(),
      caption,
      linkUrl: linkedImgMatch[3].trim(),
      wide,
    };
  }

  const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (imgMatch) {
    const rawAlt = imgMatch[1];
    const wide = rawAlt.startsWith('wide|');
    const caption = wide ? rawAlt.slice(5).trim() : rawAlt.trim();
    return {
      id: createBlockId(),
      type: 'image',
      src: imgMatch[2].trim(),
      caption,
      linkUrl: '',
      wide,
    };
  }

  if (trimmed.startsWith('### ')) {
    return {
      id: createBlockId(),
      type: 'subheading',
      text: trimmed.slice(4).trim(),
    };
  }

  if (trimmed.startsWith('## ')) {
    return {
      id: createBlockId(),
      type: 'heading',
      text: trimmed.slice(3).trim(),
    };
  }

  // Inline Color Theme Callout: > [!sage] Heading \n > Body
  const calloutHeaderMatch = trimmed.match(
    /^>\s*\[!(amber|sage|terracotta|slate|midnight)\]\s*(.*)$/m
  );
  if (calloutHeaderMatch && trimmed.startsWith('>')) {
    const lines = trimmed.split('\n');
    const firstLineMatch = lines[0].match(
      /^>\s*\[!(amber|sage|terracotta|slate|midnight)\]\s*(.*)$/
    );
    const theme = (firstLineMatch?.[1] as CalloutColorTheme) || 'amber';
    const title = (firstLineMatch?.[2] || 'Editorial Note').trim();
    const bodyText = lines
      .slice(1)
      .map((line) => line.replace(/^>\s?/, '').trim())
      .filter(Boolean)
      .join('\n');
    return {
      id: createBlockId(),
      type: 'callout',
      theme,
      title,
      text: bodyText,
    };
  }

  if (trimmed.startsWith('> ')) {
    return {
      id: createBlockId(),
      type: 'quote',
      text: trimmed
        .split('\n')
        .map((line) => line.replace(/^>\s?/, '').trim())
        .join(' '),
    };
  }

  return {
    id: createBlockId(),
    type: 'paragraph',
    text: trimmed,
  };
}

export function markdownToBlocks(raw: string): StoryBlock[] {
  if (!raw || !raw.trim()) {
    return [createEmptyParagraphBlock('')];
  }

  const rawChunks = raw
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);

  const blocks: StoryBlock[] = [];

  for (const chunk of rawChunks) {
    const hasEmbeddedToken =
      (chunk.includes('[[offer:') && !chunk.match(/^\[\[offer:[a-zA-Z0-9_-]+\]\]$/)) ||
      (chunk.includes('[[product:') &&
        !chunk.match(/^\[\[product:[a-zA-Z0-9_-]+\]\]$/));

    if (hasEmbeddedToken) {
      const subParts = chunk.split(/(\[\[(?:offer|product):[a-zA-Z0-9_-]+\]\])/g);
      for (const sp of subParts) {
        if (sp.trim()) {
          blocks.push(parseSingleChunk(sp));
        }
      }
    } else {
      blocks.push(parseSingleChunk(chunk));
    }
  }

  return blocks.length > 0 ? blocks : [createEmptyParagraphBlock('')];
}

export function extractHostnameLabel(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'External Link';
  }
}

export interface ParsedVideoDescriptor {
  kind: 'iframe' | 'video' | 'external';
  embedSrc: string;
  provider: string;
}

export function parseVideoEmbedUrl(rawUrl: string): ParsedVideoDescriptor | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;

  try {
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = u.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{6,}$/.test(vParam)) {
        return {
          kind: 'iframe',
          embedSrc: `https://www.youtube.com/embed/${vParam}`,
          provider: 'YouTube',
        };
      }
      const pathMatch = u.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{6,})/);
      if (pathMatch) {
        return {
          kind: 'iframe',
          embedSrc: `https://www.youtube.com/embed/${pathMatch[1]}`,
          provider: 'YouTube',
        };
      }
    }

    if (host === 'youtu.be') {
      const shortId = u.pathname.replace(/^\//, '').split('/')[0];
      if (shortId && /^[a-zA-Z0-9_-]{6,}$/.test(shortId)) {
        return {
          kind: 'iframe',
          embedSrc: `https://www.youtube.com/embed/${shortId}`,
          provider: 'YouTube',
        };
      }
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const vimeoMatch = u.pathname.match(/\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        return {
          kind: 'iframe',
          embedSrc: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
          provider: 'Vimeo',
        };
      }
    }

    if (host === 'loom.com') {
      const loomMatch = u.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (loomMatch) {
        return {
          kind: 'iframe',
          embedSrc: `https://www.loom.com/embed/${loomMatch[1]}`,
          provider: 'Loom',
        };
      }
    }

    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u.pathname)) {
      return {
        kind: 'video',
        embedSrc: u.toString(),
        provider: 'Direct Video',
      };
    }

    return {
      kind: 'external',
      embedSrc: u.toString(),
      provider: extractHostnameLabel(u.toString()),
    };
  } catch {
    return null;
  }
}

export function computeWordCountAndReadTime(blocks: StoryBlock[]): {
  words: number;
  minutes: number;
} {
  let textAccumulator = '';
  for (const b of blocks) {
    if (
      b.type === 'paragraph' ||
      b.type === 'heading' ||
      b.type === 'subheading' ||
      b.type === 'quote'
    ) {
      textAccumulator += ` ${b.text}`;
    } else if (b.type === 'callout') {
      textAccumulator += ` ${b.title} ${b.text}`;
    } else if (b.type === 'image' || b.type === 'video') {
      textAccumulator += ` ${b.caption}`;
    } else if (b.type === 'bookmark') {
      textAccumulator += ` ${b.title} ${b.description}`;
    }
  }
  const words = textAccumulator
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.min(60, Math.ceil(words / 210)));
  return { words, minutes };
}

export function extractOfferIdsFromBlocks(blocks: StoryBlock[]): string[] {
  const ids: string[] = [];
  for (const b of blocks) {
    if (b.type === 'offer' && b.offerId && !ids.includes(b.offerId)) {
      ids.push(b.offerId);
    }
  }
  return ids;
}

export function extractProductIdsFromBlocks(blocks: StoryBlock[]): string[] {
  const ids: string[] = [];
  for (const b of blocks) {
    if (b.type === 'product' && b.productId && !ids.includes(b.productId)) {
      ids.push(b.productId);
    }
  }
  return ids;
}
