import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseHTML } from 'linkedom';
import { readTurnstileTokenFromUrl, verifyTurnstileToken } from '../../_shared/turnstile';
import { renderTextToolPage, turnstileSiteKeyFromEnv } from '../../_shared/tool-page';

type Env = { Bindings: { TURNSTILE_SITE_KEY?: string; TURNSTILE_SECRET_KEY?: string } };

const app = new Hono<Env>();
app.use('/api/*', cors());

app.get('/', (c) =>
  c.html(
    renderTextToolPage({
      title: 'Content Word Counter',
      description: 'Count words, sentences, paragraphs, headings, and estimate reading time from a page.',
      endpoint: '/api/count',
      sample: '{ "url": "https://example.com", "wordCount": 500, "readingTimeMinutes": 3 }',
      siteKey: turnstileSiteKeyFromEnv(c.env),
      buttonLabel: 'Count',
      toolSlug: 'content-word-counter',
    })
  )
);

app.get('/health', (c) => c.json({ ok: true }));

app.get('/api/count', async (c) => {
  const captcha = await verifyTurnstileToken(
    c.env,
    readTurnstileTokenFromUrl(c.req.url),
    c.req.header('CF-Connecting-IP')
  );
  if (!captcha.ok) return c.json({ error: captcha.error }, 403);

  const normalized = normalizeUrl(c.req.query('url') ?? '');
  if (!normalized) return c.json({ error: 'A valid http(s) URL is required.' }, 400);

  const html = await fetchHtml(normalized);
  if (!html) return c.json({ error: 'Failed to fetch page.' }, 502);

  const { document } = parseHTML(html);

  // Count structural elements before stripping
  const headingCount = document.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const linkCount = document.querySelectorAll('a[href]').length;
  const imageCount = document.querySelectorAll('img').length;

  // Strip non-content elements for text analysis
  const body = document.body ?? document.documentElement;
  body.querySelectorAll('script, style').forEach((el: any) => el.remove());
  const text = (body.textContent || '').trim();
  if (!text) return c.json({ error: 'No readable text found.' }, 400);

  const words = text.split(/\s+/).filter((w: string) => w.length > 0);
  const wordCount = words.length;
  const characterCount = text.replace(/\s/g, '').length;

  // Sentences: split on sentence-ending punctuation
  const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  const sentenceCount = sentences.length;

  // Paragraphs: blocks separated by double newlines or block-level breaks
  const paragraphs = text.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0);
  const paragraphCount = Math.max(paragraphs.length, 1);

  const readingTimeMinutes = Math.ceil(wordCount / 200);

  return c.json({
    url: normalized,
    wordCount,
    characterCount,
    sentenceCount,
    paragraphCount,
    headingCount,
    linkCount,
    imageCount,
    readingTimeMinutes,
  });
});

async function fetchHtml(url: string) {
  const r = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Lindo Free Tools/1.0 (+https://lindo.ai/tools)' },
  }).catch(() => null);
  return r?.ok ? r.text() : null;
}

function normalizeUrl(value: string): string | null {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).toString();
  } catch {
    return null;
  }
}

export default app;
