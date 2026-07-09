import { describe, it } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables del .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import { sessionPlugin } from '../plugins/session';
import { conversationsRoutes } from '../routes/conversations.routes';
import { filesRoutes } from '../routes/files.routes';
import { retrieveRelevantChunks } from '../services/retrieval.service';
import { db } from '../lib/db';

describe('RAG Integration', async () => {
  const server = Fastify();
  await server.register(multipart);
  await server.register(sessionPlugin);
  await server.register(conversationsRoutes, { prefix: '/conversations' });
  await server.register(filesRoutes);

  let cookie = '';
  let convId = '';

  it('should set up conversation', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/conversations',
      payload: { title: 'RAG Test' }
    });
    assert.strictEqual(res.statusCode, 201);
    convId = res.json().id;

    let setCookie = res.headers['set-cookie'];
    if (typeof setCookie === 'string') setCookie = [setCookie];
    cookie = setCookie[0].split(';')[0];
  });

  it('should upload a large file and trigger chunking + embeddings', async () => {
    // Generar un archivo Markdown de más de 4000 caracteres
    const header = '# Documento RAG de Inteligencia Artificial\n\n';
    const paragraphs = [];
    for (let i = 1; i <= 20; i++) {
      paragraphs.push(
        `## Sección ${i}\nEste es el contenido detallado de la sección número ${i}. ` +
        `Hablamos de conceptos de Inteligencia Artificial, Large Language Models, embeddings vectoriales, y sqlite-vec como base de datos en local. ` +
        `Es importante recordar que el número clave para este test es: CLAVE_SECRETA_${i * 7}. ` +
        `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n`
      );
    }
    const content = header + paragraphs.join('');
    assert.ok(content.length > 4000, 'El archivo de prueba debe superar el umbral');

    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="large_doc.md"',
      'Content-Type: text/markdown',
      '',
      content,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const res = await server.inject({
      method: 'POST',
      url: `/conversations/${convId}/files`,
      headers: {
        cookie,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    assert.strictEqual(res.statusCode, 201);
    const json = res.json();
    assert.strictEqual(json[0].is_chunked, 1); // Debe ser chunked

    // Verificar en la DB directamente
    const fileId = json[0].id;
    const chunks = db.prepare('SELECT * FROM file_chunks WHERE file_id = ?').all(fileId);
    assert.ok(chunks.length > 1, 'Deben existir múltiples chunks creados');
    console.log(`Creados ${chunks.length} chunks para el archivo.`);
  });

  it('should retrieve relevant chunks based on a query', async () => {
    // Buscamos algo relacionado con la sección 5: "CLAVE_SECRETA_35" (5 * 7 = 35)
    const results = await retrieveRelevantChunks(convId, '¿Cuál es el número clave de la sección 5?', 2);
    assert.ok(results.length > 0, 'Debe retornar al menos un chunk');
    
    const containsSecret = results.some(r => r.content.includes('CLAVE_SECRETA_35'));
    assert.ok(containsSecret, 'El chunk retornado debe contener la información relevante');
    console.log('Resultados del retrieval:', results.map(r => r.content));
  });
});
