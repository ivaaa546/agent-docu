import { FastifyInstance } from 'fastify';
import * as chatService from '../services/chat.service';
import * as convRepo from '../repositories/conversations.repository';
import { streamChat } from '../lib/gemini-client';
import { SSEStream } from '../lib/sse';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const messageSchema = z.object({
  content: z.string().min(1),
});

export const chatRoutes = async (fastify: FastifyInstance) => {
  // GET /conversations/:id/messages
  fastify.get('/conversations/:id/messages', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const conv = convRepo.getConversation(conversationId, request.sessionId);
    if (!conv) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }

    const history = chatService.getHistory(conversationId);
    return reply.send(history);
  });

  // POST /conversations/:id/messages (Streaming SSE)
  fastify.post('/conversations/:id/messages', async (request, reply) => {
    const { id: conversationId } = request.params as { id: string };
    const conv = convRepo.getConversation(conversationId, request.sessionId);
    if (!conv) {
      return reply.code(404).send({ error: 'Conversation not found' });
    }

    const body = messageSchema.parse(request.body);

    // 1. Guardar mensaje del usuario
    const userMsgId = `msg_${randomUUID()}`;
    chatService.saveMessage(userMsgId, conversationId, 'user', body.content);

    // 2. Obtener historial para la IA
    const history = chatService.getHistory(conversationId);
    // Remover el último mensaje (el actual del usuario) del historial porque se pasa por separado
    const formattedHistory = history
      .slice(0, -1)
      .map(h => ({ role: h.role, content: h.content }));

    // 3. Compilar contexto de archivos y RAG
    const systemInstruction = await chatService.buildChatContext(conversationId, body.content);

    // 4. Crear mensaje inicial vacío para el asistente
    const assistantMsgId = `msg_${randomUUID()}`;
    chatService.saveMessage(assistantMsgId, conversationId, 'assistant', '');

    // 5. Iniciar stream SSE
    const sse = new SSEStream(reply);

    // Enviar metadatos iniciales (como el ID del mensaje del asistente)
    sse.send({ assistantMsgId, userMsgId }, 'meta');

    let fullContent = '';

    try {
      const chatGen = streamChat(systemInstruction, formattedHistory, body.content);

      for await (const chunk of chatGen) {
        fullContent += chunk;
        
        // Enviar chunk por SSE
        sse.send({ chunk }, 'chunk');

        // Persistir progresivamente en la base de datos (Fase 5 - T030)
        chatService.saveMessage(assistantMsgId, conversationId, 'assistant', fullContent);
      }
    } catch (err: any) {
      console.error('Error durante el streaming de chat:', err);
      sse.send({ error: 'Error al generar la respuesta.' }, 'error');
    } finally {
      sse.close();
    }
  });
};
