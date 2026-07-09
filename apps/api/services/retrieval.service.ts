import { db } from '../lib/db';
import { getEmbedding } from './embeddings.service';

export interface RetrievalResult {
  chunkId: string;
  fileId: string;
  content: string;
  filename: string;
  distance: number;
}

export const retrieveRelevantChunks = async (
  conversationId: string,
  query: string,
  limit = 5
): Promise<RetrievalResult[]> => {
  try {
    const queryVector = await getEmbedding(query);
    const floatArray = new Float32Array(queryVector);

    // Consulta de similitud en la tabla virtual vec0.
    // Buscamos un K mayor para luego filtrar los que pertenecen a esta conversación.
    const rawMatches = db.prepare(`
      SELECT chunk_id, distance
      FROM file_chunk_embeddings
      WHERE embedding MATCH ?
        AND k = ?
    `).all(floatArray, limit * 10) as { chunk_id: string; distance: number }[];

    if (rawMatches.length === 0) return [];

    const chunkIds = rawMatches.map(m => m.chunk_id);
    const placeholders = chunkIds.map(() => '?').join(',');

    // Obtener detalles filtrando por la conversación correcta
    const chunkDetails = db.prepare(`
      SELECT fc.id as chunkId, fc.content, f.id as fileId, f.filename
      FROM file_chunks fc
      JOIN files f ON fc.file_id = f.id
      WHERE fc.id IN (${placeholders}) AND f.conversation_id = ?
    `).all(...chunkIds, conversationId) as { chunkId: string; content: string; fileId: string; filename: string }[];

    // Unir distancias, ordenar de menor a mayor distancia (más similares) y recortar al límite real
    const results: RetrievalResult[] = chunkDetails.map(detail => {
      const match = rawMatches.find(m => m.chunk_id === detail.chunkId)!;
      return {
        chunkId: detail.chunkId,
        fileId: detail.fileId,
        content: detail.content,
        filename: detail.filename,
        distance: match.distance
      };
    }).sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return results;
  } catch (err) {
    console.error('Error durante el retrieval:', err);
    return [];
  }
};
