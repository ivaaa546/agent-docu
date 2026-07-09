import { describe, it } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { sessionPlugin } from '../plugins/session';
import { conversationsRoutes } from '../routes/conversations.routes';
import { chatRoutes } from '../routes/chat.routes';
import { db } from '../lib/db';

describe('Chat API', async () => {
  const server = Fastify();
  await server.register(multipart);
  await server.register(sessionPlugin);
  await server.register(conversationsRoutes, { prefix: '/conversations' });
  await server.register(chatRoutes);

  let cookie = '';
  let convId = '';

  it('should set up conversation', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/conversations',
      payload: { title: 'Chat Test' }
    });
    assert.strictEqual(res.statusCode, 201);
    convId = res.json().id;

    let setCookie = res.headers['set-cookie'];
    if (typeof setCookie === 'string') setCookie = [setCookie];
    cookie = setCookie[0].split(';')[0];
  });

  it('should stream response for a message', async () => {
    const res = await server.inject({
      method: 'POST',
      url: `/conversations/${convId}/messages`,
      headers: { cookie },
      payload: { content: 'Di la palabra "Hermes" y nada más.' }
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['content-type'], 'text/event-stream');

    const lines = res.payload.split('\n');
    let hasMeta = false;
    let chunksText = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.slice(6));
        if (json.assistantMsgId) {
          hasMeta = true;
        }
        if (json.chunk) {
          chunksText += json.chunk;
        }
      }
    }

    assert.ok(hasMeta, 'Debe retornar metadatos del mensaje');
    assert.ok(chunksText.toLowerCase().includes('hermes'), 'La respuesta debe incluir la palabra solicitada');
    console.log('Respuesta acumulada por streaming:', chunksText);
  });

  it('should return complete history', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${convId}/messages`,
      headers: { cookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    // Debe haber al menos 2 mensajes (el del usuario y el del asistente)
    assert.ok(json.length >= 2);
    assert.strictEqual(json[0].role, 'user');
    assert.strictEqual(json[1].role, 'assistant');
    assert.ok(json[1].content.length > 0, 'El mensaje del asistente debe haber quedado guardado en base de datos');
  });
});
