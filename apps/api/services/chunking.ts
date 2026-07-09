export interface Chunk {
  content: string;
  index: number;
}

export const CHUNK_THRESHOLD = 4000; // 4000 chars (~1000 tokens)
export const CHUNK_SIZE = 2000;      // Target size for each chunk
export const CHUNK_OVERLAP = 200;    // Overlap size

/**
 * Splits text into chunks by respecting paragraph boundaries (\n\n) or line boundaries (\n).
 */
export const splitText = (text: string): Chunk[] => {
  if (text.length <= CHUNK_THRESHOLD) {
    return [{ content: text, index: 0 }];
  }

  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let index = 0;

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= CHUNK_SIZE) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push({ content: currentChunk, index: index++ });
      }
      
      // If a single paragraph is larger than CHUNK_SIZE, split it by line
      if (paragraph.length > CHUNK_SIZE) {
        const lines = paragraph.split('\n');
        currentChunk = '';
        for (const line of lines) {
          if ((currentChunk + line).length <= CHUNK_SIZE) {
            currentChunk += (currentChunk ? '\n' : '') + line;
          } else {
            if (currentChunk) {
              chunks.push({ content: currentChunk, index: index++ });
            }
            currentChunk = line;
          }
        }
      } else {
        // Overlap logic: prepend last few chars of previous chunk if possible
        const overlap = currentChunk.slice(-CHUNK_OVERLAP);
        currentChunk = (overlap ? overlap + '\n\n' : '') + paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push({ content: currentChunk, index: index++ });
  }

  return chunks;
};
