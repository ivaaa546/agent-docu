import { db } from '../lib/db';
import { retrieveRelevantChunks } from './retrieval.service';
import { listByConversation } from './files.service';
import { randomUUID } from 'crypto';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const getHistory = (conversationId: string): Message[] => {
  const stmt = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  );
  return stmt.all(conversationId) as Message[];
};

export const saveMessage = (
  id: string,
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Message => {
  const stmt = db.prepare(
    'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content'
  );
  stmt.run(id, conversationId, role, content);
  return { id, conversation_id: conversationId, role, content, created_at: new Date().toISOString() };
};

export const buildChatContext = async (conversationId: string, userMessage: string) => {
  const files = listByConversation(conversationId);
  
  let context = '';

  const chunkedFiles = files.filter(f => f.is_chunked === 1);
  const smallFiles = files.filter(f => f.is_chunked === 0);

  // 1. Agregar contenido de archivos pequeños directamente
  if (smallFiles.length > 0) {
    context += '--- DOCUMENTOS COMPLETOS ADJUNTOS ---\n';
    for (const file of smallFiles) {
      context += `Documento: ${file.filename}\nContenido:\n${file.raw_content}\n\n`;
    }
  }

  // 2. Realizar RAG para archivos grandes
  if (chunkedFiles.length > 0) {
    const relevantChunks = await retrieveRelevantChunks(conversationId, userMessage, 5);
    if (relevantChunks.length > 0) {
      context += '--- FRAGMENTOS RELEVANTES EXTRAÍDOS ---\n';
      for (const chunk of relevantChunks) {
        context += `Documento original: ${chunk.filename}\nFragmento:\n${chunk.content}\n\n`;
      }
    }
  }

  const systemInstruction = `Actúas como Docu AI, un asistente de IA experto en analizar y redactar sobre documentos Markdown.
Responde de forma clara, directa y estructurada en Markdown.
Usa única y estrictamente el contexto proporcionado abajo para responder a la pregunta del usuario. Si el contexto no tiene la respuesta o no es suficiente, adviértelo pero responde lo mejor que puedas con lo que tengas.

Contexto actual de la conversación:
${context || 'No hay documentos cargados en esta sesión.'}
`;

  return systemInstruction;
};
