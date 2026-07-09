# Plan Técnico: Asistente de IA para Documentos Markdown

> Este documento traduce el spec funcional (`001-spec.md`) en decisiones técnicas concretas: stack, arquitectura, modelo de datos y estructura de carpetas. El spec define el "qué"; este documento define el "cómo".

## 1. Resumen de Stack

| Capa | Tecnología | Justificación |
|---|---|---|
| Runtime | Node.js + TypeScript | Consistencia con stack existente |
| Backend framework | Fastify | Liviano, bajo overhead, soporte nativo para streaming |
| Base de datos | SQLite (`better-sqlite3`) | Un solo archivo, sin servidor separado, ideal para app liviana |
| Búsqueda vectorial | `sqlite-vec` | Extensión de SQLite; evita levantar una DB vectorial aparte |
| IA (chat + embeddings) | Gemini API (`@google/genai`) | Requisito del usuario |
| Streaming | Server-Sent Events (SSE) | Unidireccional servidor→cliente, más simple que WebSockets |
| Frontend | Next.js (App Router) | Consistencia con admin panel existente, soporta streaming nativo |
| Render markdown | `react-markdown` + `remark-gfm` | Tablas, listas, código |
| Validación | Zod | Consistente con TS, valida entrada de API y variables de entorno |

---

## 2. Arquitectura General

Arquitectura de **monolito modular** (un solo proceso desplegable, módulos internos desacoplados por responsabilidad). No se justifica microservicios para este alcance.

```
┌─────────────────────────────────────────────────────────────┐
│                        Cliente (Next.js)                     │
│  Chat UI · Sidebar Historial · Panel de Archivos · SSE Client│
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────▼───────────────────────────────────┐
│                     Backend (Fastify)                        │
│                                                               │
│  ┌────────────┐  ┌───────────────┐  ┌─────────────────────┐ │
│  │  Módulo     │  │   Módulo      │  │   Módulo             │ │
│  │  Archivos   │  │   Chat        │  │   Sesiones/Historial │ │
│  │  (upload,   │  │  (mensajes,   │  │   (conversaciones,   │ │
│  │  chunking)  │  │   streaming)  │  │    metadata)          │ │
│  └──────┬──────┘  └───────┬───────┘  └──────────┬───────────┘ │
│         │                 │                     │             │
│  ┌──────▼─────────────────▼─────────────────────▼──────────┐ │
│  │              Módulo RAG (orquestador)                    │ │
│  │   - Decide si el contenido cabe directo en el prompt     │ │
│  │   - Si no, hace retrieval sobre sqlite-vec                │ │
│  └──────┬──────────────────────────────────┬────────────────┘ │
│         │                                  │                  │
│  ┌──────▼────────┐                 ┌───────▼─────────────┐   │
│  │  Gemini Client │                 │   SQLite + sqlite-vec │   │
│  │  (chat stream, │                 │  (archivos, chunks,   │   │
│  │   embeddings)  │                 │   embeddings, chats)  │   │
│  └────────────────┘                 └───────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Comunicación entre módulos:** llamadas directas a funciones/servicios (in-process), sin bus de eventos — el alcance no lo justifica. Si el proyecto crece (multi-usuario con notificaciones en tiempo real, por ejemplo), se puede introducir un event emitter interno más adelante.

---

## 3. Flujo de Datos Clave

### 3.1 Carga de archivo
```
Usuario sube .md → Backend valida tamaño/tipo → Guarda contenido en SQLite
   → ¿Excede umbral de tokens? 
        NO → se guarda tal cual, se inyecta completo en el prompt cuando se use
        SÍ → se trocea (chunking) → se generan embeddings (Gemini) → se guardan en sqlite-vec
```

### 3.2 Pregunta del usuario (streaming)
```
Usuario envía mensaje → Backend arma contexto:
   - Si archivo(s) son pequeños: contenido completo
   - Si son grandes: retrieval de chunks relevantes vía sqlite-vec (similaridad coseno)
→ Se llama a Gemini con generateContentStream()
→ Backend reenvía cada chunk de texto al cliente vía SSE
→ Cliente renderiza progresivamente (markdown parcial tolerante a streaming)
→ Al finalizar, se persiste el mensaje completo en SQLite (historial)
```

### 3.3 Manejo de cortes de conexión (caso límite del spec)
- El backend persiste cada chunk recibido de Gemini a medida que llega (no solo al final).
- Si la conexión SSE se corta, al reconectar el cliente puede pedir el estado actual del mensaje en curso y retomar desde donde quedó, en vez de perder la respuesta completa.

---

## 4. Modelo de Datos (SQLite)

```sql
-- Sesiones de chat
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Mensajes dentro de una conversación
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Archivos subidos (metadata + contenido si es pequeño)
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  raw_content TEXT,              -- NULL si se trocea (contenido grande)
  size_bytes INTEGER NOT NULL,
  is_chunked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Chunks de archivos grandes (para RAG)
CREATE TABLE file_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL
);

-- Tabla virtual de embeddings (sqlite-vec)
CREATE VIRTUAL TABLE file_chunk_embeddings USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding FLOAT[768]            -- dimensión según modelo de embeddings de Gemini
);
```

**Nota:** `ON DELETE CASCADE` cubre el requerimiento del spec de que al borrar un archivo, la IA deje de considerarlo inmediatamente (se eliminan también sus chunks y embeddings).

---

## 5. Estructura de Carpetas

```
asistente-md/
├── apps/
│   ├── api/                          # Backend Fastify
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── files/
│   │   │   │   │   ├── files.routes.ts
│   │   │   │   │   ├── files.service.ts
│   │   │   │   │   └── files.repository.ts
│   │   │   │   ├── chat/
│   │   │   │   │   ├── chat.routes.ts
│   │   │   │   │   ├── chat.service.ts        # orquesta streaming
│   │   │   │   │   └── chat.repository.ts
│   │   │   │   ├── conversations/
│   │   │   │   │   ├── conversations.routes.ts
│   │   │   │   │   ├── conversations.service.ts
│   │   │   │   │   └── conversations.repository.ts
│   │   │   │   └── rag/
│   │   │   │       ├── chunking.ts             # división de texto
│   │   │   │       ├── embeddings.service.ts   # llamadas a Gemini embeddings
│   │   │   │       └── retrieval.service.ts    # búsqueda en sqlite-vec
│   │   │   ├── lib/
│   │   │   │   ├── gemini-client.ts
│   │   │   │   ├── db.ts                       # conexión better-sqlite3 + migraciones
│   │   │   │   └── sse.ts                      # helper para respuestas streaming
│   │   │   ├── config/
│   │   │   │   └── env.ts                      # validación de env vars con Zod
│   │   │   ├── plugins/                        # plugins Fastify (cors, error handler)
│   │   │   └── server.ts
│   │   ├── migrations/
│   │   └── package.json
│   │
│   └── web/                          # Frontend Next.js
│       ├── app/
│       │   ├── chat/
│       │   │   └── [conversationId]/page.tsx
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── chat/
│       │   │   ├── ChatWindow.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   └── QuickActions.tsx
│       │   ├── files/
│       │   │   ├── FileUploader.tsx
│       │   │   └── FileList.tsx
│       │   └── sidebar/
│       │       └── ConversationList.tsx
│       ├── hooks/
│       │   └── useChatStream.ts                # maneja SSE + reconexión
│       ├── lib/
│       │   └── api-client.ts
│       └── package.json
│
├── packages/
│   └── shared/                       # tipos compartidos entre api y web
│       └── src/
│           └── types.ts
│
└── package.json                      # workspace root (monorepo simple)
```

---

## 6. API (contrato entre frontend y backend)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/conversations` | Crea nueva conversación |
| `GET` | `/conversations` | Lista conversaciones (sidebar) |
| `PATCH` | `/conversations/:id` | Renombrar |
| `DELETE` | `/conversations/:id` | Eliminar conversación |
| `POST` | `/conversations/:id/files` | Sube archivo(s) `.md` |
| `DELETE` | `/files/:id` | Elimina archivo (y sus chunks/embeddings) |
| `POST` | `/conversations/:id/messages` | Envía mensaje → responde vía SSE (`text/event-stream`) |
| `GET` | `/conversations/:id/messages` | Historial de mensajes |

---

## 7. Seguridad y Privacidad

- Los archivos y conversaciones se asocian a un `session_id` (cookie firmada) o a un `user_id` si se agrega autenticación en una v2.
- Todas las queries a SQLite deben filtrar por esa sesión/usuario — nunca exponer datos entre sesiones.
- La API key de Gemini vive únicamente en el backend (variable de entorno), nunca se expone al cliente.
- Validar tipo y tamaño de archivo en el backend antes de procesarlo (no confiar solo en validación del cliente).

---

## 8. Decisiones Explícitamente Descartadas

Para que quede documentado el porqué, y no se revisiten sin razón:

- **Prisma**: descartado en favor de `better-sqlite3` — para este alcance, el overhead de un ORM completo no se justifica frente a queries directas y síncronas.
- **Base de datos vectorial dedicada (Chroma/Pinecone)**: descartada — `sqlite-vec` cubre el caso de uso sin añadir infraestructura ni otra dependencia de almacenamiento.
- **WebSockets**: descartados en favor de SSE — el flujo es unidireccional (servidor→cliente), SSE es más simple de implementar, depurar y desplegar.
- **Bus de eventos entre módulos**: descartado en este alcance — la comunicación in-process directa es suficiente; se puede introducir si el proyecto escala a más módulos independientes.

---

## 9. Próximos Pasos

Siguiendo el flujo SDD, el siguiente artefacto es `004-tasks.md`: desglose de este plan en tareas ejecutables por un agente de código, ordenadas por dependencia (ej. primero schema + conexión DB, luego módulo de archivos, luego RAG, luego chat con streaming, luego frontend).