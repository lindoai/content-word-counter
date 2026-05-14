# Content Word Counter

Count words, sentences, paragraphs, headings, and estimate reading time from a page.

## API

```
GET /api/count?url=https://example.com
```

Returns JSON with word count, character count, sentence count, paragraph count, heading count, link count, image count, and estimated reading time.

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lindoai/content-word-counter)

## Environment

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
