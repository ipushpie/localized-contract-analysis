import { config } from '../utils/config';
import { logger, elapsed } from '../utils/logger';

const TAG = 'Embed';
const EMBED_RETRIES = 3;
const EMBED_RETRY_DELAY_MS = 5000;
const EMBED_TIMEOUT_MS = 300_000; // Increased to 5 minutes for remote server bottlenecks

export async function embed(text: string): Promise<number[]> {
  for (let attempt = 1; attempt <= EMBED_RETRIES; attempt++) {
    const t0 = Date.now();
    try {
      const response = await fetch(`${config.ollamaBaseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.embedModel, prompt: text }),
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Ollama embed HTTP ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { embedding: number[] };
      if (!data.embedding || data.embedding.length === 0) {
        throw new Error(`Ollama embed returned empty embedding for model "${config.embedModel}"`);
      }
      
      const took = Date.now() - t0;
      if (took > 5000) {
        logger.info(TAG, `Embedded chunk (Slow)`, { dims: data.embedding.length, ms: took, attempt });
      } else {
        logger.debug(TAG, `Embedded chunk`, { dims: data.embedding.length, ms: took, attempt });
      }
      return data.embedding;
    } catch (err) {
      if (attempt === EMBED_RETRIES) {
        logger.error(TAG, `All ${EMBED_RETRIES} attempts failed`, err, { textSnippet: text?.slice(0, 60) ?? '(undefined text)', elapsed: elapsed(t0) });
        throw err;
      }
      logger.warn(TAG, `Attempt ${attempt}/${EMBED_RETRIES} failed, retrying in ${EMBED_RETRY_DELAY_MS}ms`, { error: String(err), elapsed: elapsed(t0) });
      await new Promise((r) => setTimeout(r, EMBED_RETRY_DELAY_MS));
    }
  }
  throw new Error('Unreachable');
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const CONCURRENCY = 1; // Limit concurrency to 1 to prevent overloading remote Ollama server
  const results: number[][] = new Array(texts.length);

  let idx = 0;
  const worker = async () => {
    while (true) {
      const i = idx++;
      if (i >= texts.length) return;
      results[i] = await embed(texts[i]);
    }
  };

  const workers: Promise<void>[] = [];
  for (let w = 0; w < Math.min(CONCURRENCY, texts.length); w++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}
