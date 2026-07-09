# Tasks: Asistente de IA para Documentos Markdown

> Desglose ejecutable de `003-plan.md`, ordenado por dependencia. Cada tarea es lo suficientemente acotada para que un agente de código (o vos) la complete y valide de forma aislada. Las fases están ordenadas para minimizar retrabajo: primero infraestructura, luego lógica de negocio, luego streaming, al final UI.

**Convención de estado:** `[ ]` pendiente · `[~]` en progreso · `[x]` completa

---

## Fase 0 — Bootstrap del proyecto

- [x] **T001** Crear monorepo con workspaces (`apps/api`, `apps/web`, `packages/shared`) y `package.json` raíz.
- [x] **T002** Configurar TypeScript compartido (`tsconfig.base.json`) y linting (ESLint + Prettier) en ambos apps.
- [x] **T003** Configurar `apps/api` con Fastify mínimo (`server.ts` que levanta en un puerto y responde `/health`).
- [x] **T004** Configurar `apps/web` con Next.js App Router mínimo (página en blanco que compila).
- [x] **T005** Crear `config/env.ts` con validación Zod de variables de entorno (`GEMINI_API_KEY`, `DATABASE_PATH`, `PORT`, `SESSION_SECRET`).

**Criterio de salida de fase:** `pnpm dev` (o equivalente) levanta API y web sin errores, `/health` responde 200.

---

## Fase 1 — Base de datos

- [x] **T006** Instalar `better-sqlite3` y `sqlite-vec`, crear `lib/db.ts` con la conexión y carga de la extensión vec0.
- [x] **T007** Escribir migración inicial con las tablas: `conversations`, `messages`, `files`, `file_chunks`, `file_chunk_embeddings` (según schema de `003-plan.md` §4).
- [x] **T008** Crear script de migración ejecutable (`npm run migrate`) y verificar que corre limpio sobre una DB nueva.
- [x] **T009** Escribir un test de humo que inserta y lee una fila de cada tabla, para validar que el schema y los constraints (`ON DELETE CASCADE`, `CHECK`) funcionan.

**Criterio de salida de fase:** migraciones corren de forma reproducible; test de humo pasa.

---

## Fase 2 — Módulo de sesiones/conversaciones

- [x] **T010** Implementar `conversations.repository.ts` (CRUD directo sobre SQLite).
- [x] **T011** Implementar `conversations.service.ts` (lógica: título por defecto, timestamps).
- [x] **T012** Implementar rutas: `POST /conversations`, `GET /conversations`, `PATCH /conversations/:id`, `DELETE /conversations/:id`.
- [x] **T013** Middleware/plugin de sesión: generar `session_id` (cookie firmada) si no existe, y filtrar todas las queries de conversaciones por esa sesión.
- [x] **T014** Tests de integración de las 4 rutas (crear, listar, renombrar, borrar — incluyendo que borrar una conversación borra en cascada sus mensajes y archivos).

**Criterio de salida de fase:** se puede crear, listar, renombrar y borrar conversaciones vía HTTP, aisladas por sesión.

---

## Fase 3 — Módulo de archivos (sin RAG todavía)

- [x] **T015** Implementar `files.repository.ts` (insertar, listar por conversación, eliminar).
- [x] **T016** Implementar `files.service.ts`: validar tipo (`.md`) y tamaño máximo antes de guardar.
- [x] **T017** Implementar `POST /conversations/:id/files` (soporta múltiples archivos en una sola request).
- [x] **T018** Implementar `DELETE /files/:id` — debe eliminar también chunks/embeddings asociados (verificar cascade).
- [x] **T019** Tests: subir archivo pequeño, listar archivos de una conversación, eliminar archivo y confirmar que ya no aparece.

**Criterio de salida de fase:** se pueden subir, listar y eliminar archivos `.md`, con su contenido guardado en `raw_content` cuando son pequeños.

---

## Fase 4 — RAG (chunking + embeddings + retrieval)

*Depende de: Fase 3*

- [x] **T020** Definir umbral de tamaño (tokens o caracteres) que decide si un archivo se guarda completo o se trocea. Documentar el valor elegido y por qué.
- [x] **T021** Implementar `chunking.ts`: función pura que divide texto en fragmentos (con overlap razonable) respetando límites de párrafo/sección de Markdown cuando sea posible.
- [x] **T022** Implementar `embeddings.service.ts`: llamada a la API de embeddings de Gemini, con manejo de rate limit/reintentos.
- [x] **T023** Al subir un archivo grande: trocear → generar embeddings → insertar en `file_chunks` and `file_chunk_embeddings`. Marcar `files.is_chunked = 1`.
- [x] **T024** Implementar `retrieval.service.ts`: dado un query, generar su embedding y buscar los N chunks más similares en `sqlite-vec`.
- [x] **T025** Tests: subir archivo que supera el umbral, confirmar que se trocea y que el retrieval devuelve chunks relevantes para una pregunta de prueba.

**Criterio de salida de fase:** archivos grandes se indexan automáticamente; retrieval devuelve resultados coherentes.

---

## Fase 5 — Chat con streaming

*Depende de: Fases 2, 3, 4*

- [x] **T026** Implementar `gemini-client.ts`: wrapper sobre `@google/genai` con método de chat en streaming (`generateContentStream`).
- [x] **T027** Implementar `chat.service.ts`: arma el contexto por mensaje —
  - si los archivos de la conversación son pequeños → contenido completo
  - si hay archivos troceados → resultado de `retrieval.service.ts`
- [x] **T028** Implementar `lib/sse.ts`: helper para responder con `text/event-stream` desde una ruta Fastify.
- [x] **T029** Implementar `POST /conversations/:id/messages`: guarda el mensaje del usuario, llama a Gemini en streaming, reenvía cada chunk por SSE, y persiste la respuesta completa en `messages` al finalizar.
- [x] **T030** Manejo de corte de conexión: persistir chunks parciales a medida que llegan (no solo al final), y exponer forma de recuperar el último estado de un mensaje en curso.
- [x] **T031** Implementar `GET /conversations/:id/messages` (historial completo, sin streaming).
- [x] **T032** Tests: enviar mensaje y verificar que se reciben eventos SSE en orden; verificar que el mensaje queda persistido tras finalizar el stream.

**Criterio de salida de fase:** se puede sostener una conversación completa vía API, con contexto de archivos y streaming funcionando de punta a punta (probable con `curl` o Postman antes de tocar el frontend).

---

## Fase 6 — Frontend: layout y navegación

*Depende de: Fase 2*

- [x] **T033** Layout base: sidebar + área principal (`app/layout.tsx`).
- [x] **T034** `ConversationList.tsx`: lista conversaciones desde `GET /conversations`, permite seleccionar una.
- [x] **T035** Acciones de conversación en sidebar: renombrar, eliminar (con confirmación).
- [x] **T036** Botón "Nueva conversación" → `POST /conversations` → navega a la nueva conversación.

**Criterio de salida de fase:** se puede navegar, crear, renombrar y borrar conversaciones desde la UI.

---

## Fase 7 — Frontend: archivos

*Depende de: Fases 3, 6*

- [x] **T037** `FileUploader.tsx`: drag & drop + selector de archivos, restringido a `.md`.
- [x] **T038** `FileList.tsx`: panel con archivos subidos en la conversación actual, con opción de eliminar individualmente y "vaciar todo".
- [x] **T039** Feedback visual de carga y de error (archivo muy grande, tipo inválido).

**Criterio de salida de fase:** el usuario puede subir y gestionar archivos desde la UI, viendo reflejado el estado real del backend.

---

## Fase 8 — Frontend: chat y streaming

*Depende de: Fases 5, 6, 7*

- [x] **T040** `useChatStream.ts`: hook que abre conexión SSE, acumula chunks, y expone reconexión ante corte.
- [x] **T041** `ChatWindow.tsx` + `MessageBubble.tsx`: renderiza historial y mensaje en curso, con `react-markdown` + `remark-gfm`.
- [x] **T042** `QuickActions.tsx`: botones de acciones rápidas (resumir, extraer puntos clave, redactar) que prellenan/envían un mensaje predefinido.
- [x] **T043** Manejo de error de red en la UI: mostrar estado "reconectando" en vez de perder el mensaje en curso.

**Criterio de salida de fase:** flujo completo de usuario funcionando: subir archivo → preguntar → ver respuesta en streaming → historial persistido → recuperación ante corte de red.

---

## Fase 9 — Endurecimiento

- [x] **T044** Revisar que todas las queries (archivos, mensajes, conversaciones) filtran correctamente por sesión — auditoría de seguridad básica.
- [x] **T045** Rate limiting básico en rutas de chat y de subida de archivos (evitar abuso de la API de Gemini).
- [x] **T046** Manejo de errores consistente en toda la API (formato de error uniforme, códigos HTTP correctos).
- [x] **T047** Revisar límites de tamaño de archivo y de mensajes de forma consistente entre frontend y backend.

**Criterio de salida de fase:** la app está lista para un despliegue inicial (no producción crítica, pero sí uso real).

---

## Resumen de dependencias entre fases

```
Fase 0 (bootstrap)
   └─▶ Fase 1 (DB)
          └─▶ Fase 2 (conversaciones) ──▶ Fase 6 (UI: layout)
          └─▶ Fase 3 (archivos) ──▶ Fase 4 (RAG) ──▶ Fase 5 (chat+streaming)
                     │                                     │
                     └─▶ Fase 7 (UI: archivos)              │
                                                             ▼
                                                    Fase 8 (UI: chat)
                                                             │
                                                             ▼
                                                    Fase 9 (endurecimiento)
```

Las Fases 3 y 2 pueden trabajarse en paralelo una vez completa la Fase 1, si hay más de un desarrollador o agente disponible.