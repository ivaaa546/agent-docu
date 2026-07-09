import { FastifyInstance } from 'fastify';
import * as filesService from '../services/files.service';
import * as convRepo from '../repositories/conversations.repository';

export const filesRoutes = async (fastify: FastifyInstance) => {
  // POST /conversations/:id/files
  fastify.post('/conversations/:id/files', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    
    // Validar que la conversación existe y pertenece a la sesión
    const conv = convRepo.getConversation(conversationId, request.sessionId);
    if (!conv) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }

    console.log(`[Files] Iniciando subida para conversación: ${conversationId}`);
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: 'Request must be multipart' });
    }

    const parts = request.files();
    const savedFiles = [];
    let errorOccurred: Error | null = null;

    try {
      for await (const part of parts) {
        if (errorOccurred) {
          try { await part.toBuffer(); } catch {}
          continue;
        }

        if (part.type !== 'file') {
          continue;
        }
        
        console.log(`[Files] Subiendo archivo: ${part.filename} (${part.fieldname})`);
        const buffer = await part.toBuffer();
        const content = buffer.toString('utf8');
        const size = buffer.length;

        try {
          const file = await filesService.saveFile(
            conversationId,
            part.filename,
            content,
            size
          );
          console.log(`[Files] Archivo procesado con éxito: ${part.filename}`);
          savedFiles.push(file);
        } catch (err: any) {
          console.error(`[Files] Error procesando ${part.filename}:`, err.message);
          errorOccurred = err;
        }
      }
    } catch (streamErr: any) {
      console.error('[Files] Error en el flujo de subida:', streamErr.message);
      errorOccurred = streamErr;
    }

    if (errorOccurred) {
      return reply.code(400).send({ error: errorOccurred.message });
    }

    return reply.code(201).send(savedFiles);
  });

  // GET /conversations/:id/files
  fastify.get('/conversations/:id/files', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const conv = convRepo.getConversation(conversationId, request.sessionId);
    if (!conv) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }

    const list = filesService.listByConversation(conversationId);
    return reply.send(list);
  });

  // DELETE /files/:id
  fastify.delete('/files/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return deleteHandler(id, request.sessionId, reply);
  });
};

import { db } from '../lib/db';
import { FastifyReply } from 'fastify';

const deleteHandler = (id: string, sessionId: string, reply: FastifyReply) => {
  const check = db.prepare(
    'SELECT f.id FROM files f JOIN conversations c ON f.conversation_id = c.id WHERE f.id = ? AND c.session_id = ?'
  ).get(id, sessionId);

  if (!check) {
    return reply.code(404).send({ error: 'File not found or access denied' });
  }

  const result = filesService.removeFile(id);
  return reply.send(result);
};
