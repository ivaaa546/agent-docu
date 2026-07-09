import { randomUUID } from 'crypto';
import * as repo from '../repositories/files.repository';
import { splitText, CHUNK_THRESHOLD } from './chunking';
import { getEmbedding } from './embeddings.service';
import { db } from '../lib/db';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const saveFile = async (
  conversationId: string,
  filename: string,
  content: string,
  size: number
) => {
  if (!filename.endsWith('.md')) {
    throw new Error('Solo se permiten archivos Markdown (.md)');
  }
  if (size > MAX_SIZE) {
    throw new Error('El archivo supera el tamaño máximo permitido (5MB)');
  }

  const id = `file_${randomUUID()}`;

  if (content.length <= CHUNK_THRESHOLD) {
    // Archivo pequeño: no se trocea
    return repo.createFile(id, conversationId, filename, content, 0);
  }

  // Archivo grande: se trocea (RAG)
  const fileRecord = repo.createFile(id, conversationId, filename, null, 1);
  const chunks = splitText(content);
  console.log(`[Files] Dividiendo ${filename} en ${chunks.length} fragmentos para indexación...`);

  const insertChunk = db.prepare(
    'INSERT INTO file_chunks (id, file_id, chunk_index, content) VALUES (?, ?, ?, ?)'
  );
  const insertEmbedding = db.prepare(
    'INSERT INTO file_chunk_embeddings (chunk_id, embedding) VALUES (?, ?)'
  );

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    let lastProgressTime = Date.now();
    // Procesamos secuencialmente para evitar saturar la API (rate limits)
    for (const chunk of chunks) {
      const chunkId = `chunk_${randomUUID()}`;
      insertChunk.run(chunkId, id, chunk.index, chunk.content);

      const start = Date.now();
      const vec = await getEmbedding(chunk.content);
      const floatArray = new Float32Array(vec);
      insertEmbedding.run(chunkId, floatArray);

      // Mostrar progreso en consola cada 15 segundos para no inundar el log de la terminal
      if (Date.now() - lastProgressTime > 15000 || chunk.index === chunks.length - 1) {
        console.log(`[Files] Procesando embeddings: fragmento ${chunk.index + 1}/${chunks.length}...`);
        lastProgressTime = Date.now();
      }

      // Mantener como mínimo un ciclo de 650ms (~92 RPM) sin sumar tiempos muertos si el embedding ya tardó en responder
      const elapsed = Date.now() - start;
      const targetCycle = 650;
      if (elapsed < targetCycle) {
        await delay(targetCycle - elapsed);
      }
    }
  } catch (err: any) {
    console.error(`[Files] Error procesando archivo ${id}:`, err.message || err);
    // Eliminar el archivo de la base de datos para no dejar registros huérfanos/incompletos
    try {
      removeFile(id);
    } catch (cleanupErr) {
      console.error('[Files] Error durante la limpieza del archivo fallido:', cleanupErr);
    }
    throw err;
  }

  return fileRecord;
};

export const listByConversation = (conversationId: string) => {
  return repo.listFilesByConversation(conversationId);
};

export const removeFile = (id: string) => {
  // Las llaves foráneas 'ON DELETE CASCADE' se encargarán de eliminar
  // las filas en file_chunks y file_chunk_embeddings automáticamente si están enlazadas.
  // Pero espera, file_chunk_embeddings no tiene FOREIGN KEY porque es una tabla virtual (vec0).
  // Por lo tanto, debemos eliminar los embeddings manualmente antes o después.
  
  const chunks = db.prepare('SELECT id FROM file_chunks WHERE file_id = ?').all(id) as { id: string }[];
  const deleteEmbedding = db.prepare('DELETE FROM file_chunk_embeddings WHERE chunk_id = ?');
  
  for (const chunk of chunks) {
    deleteEmbedding.run(chunk.id);
  }

  repo.deleteFile(id);
  return { success: true };
};
