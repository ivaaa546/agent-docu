# Spec: Asistente de IA para Documentos Markdown (Estilo Hermes)

## 1. Visión General
El objetivo de este proyecto es desarrollar una aplicación web que actúe como un agente de IA interactivo (similar a la experiencia de usuario de Hermes). Los usuarios podrán subir archivos en formato Markdown (`.md`), realizar preguntas sobre su contenido, generar resúmenes, redactar nuevo contenido basado en la información proporcionada y mantener un historial completo de sus conversaciones. La aplicación priorizará respuestas rápidas y fluidas mediante streaming.

## 2. Requerimientos Funcionales Core

### 2.1 Gestión de Archivos Markdown
- **Carga de Archivos:** Permitir la subida de uno o múltiples archivos `.md` a través de la interfaz de usuario (Drag & Drop o seleccionador de archivos).
- **Lectura e Indexación:** Extraer y procesar el contenido de texto de los archivos subidos para que la IA pueda tenerlos como contexto.
- **Eliminación y Gestión de Archivos:** Los usuarios deben tener acceso a un panel o indicador visual con la lista de todos los archivos `.md` subidos en la sesión actual. Desde allí, podrán eliminar archivos individualmente o vaciar toda la lista, asegurando que la IA deje de considerar esa información inmediatamente para sus próximas respuestas y liberando espacio.

### 2.2 Interfaz de Chat (Web UI)
- **Área de Conversación:** Una interfaz limpia y moderna (similar a ChatGPT/Hermes) donde los usuarios pueden interactuar con el agente.
- **Streaming de Respuestas:** El texto de la respuesta generada por la IA debe aparecer progresivamente (streaming) a medida que se genera para una mejor experiencia de usuario.
- **Soporte Markdown en Respuestas:** La interfaz del chat debe renderizar correctamente código, listas, tablas y otros elementos Markdown que genere el agente.
- **Acciones Rápidas:** Botones para acciones sugeridas (Ej. "Resume este documento", "Extrae los puntos clave", "Ayúdame a redactar una respuesta basándome en esto").

### 2.3 Historial de Conversaciones
- **Sesiones Persistentes:** Las conversaciones pasadas deben guardarse para que el usuario pueda retomarlas en cualquier momento.
- **Navegación del Historial:** Una barra lateral (sidebar) listando las conversaciones anteriores, permitiendo seleccionar, renombrar o eliminar sesiones de chat.

## 3. Historias de Usuario

- **HU-01:** Como usuario, quiero poder arrastrar y soltar un archivo `.md` en la aplicación para que la IA lo lea y me permita hacer preguntas sobre él.
- **HU-02:** Como usuario, quiero ver cómo la IA escribe la respuesta palabra por palabra (streaming) para no tener que esperar a que termine de procesar todo antes de empezar a leer.
- **HU-03:** Como usuario, quiero poder borrar un archivo que subí anteriormente si ya no quiero que la IA lo tenga en cuenta en sus respuestas futuras.
- **HU-04:** Como usuario, quiero tener un historial lateral de mis chats para poder volver a una conversación que tuve ayer y continuarla.
- **HU-05:** Como usuario, quiero pedirle a la IA que tome mi archivo Markdown y me redacte un correo electrónico formal basándose en su contenido.

## 4. Arquitectura Técnica Recomendada

### 4.1 Frontend (Cliente Web)
- **Framework:** Next.js (React) o Vite (React/Vue).
- **Estilos:** Vanilla CSS (para máximo control del diseño, animaciones dinámicas y evitar que frameworks como Tailwind restrinjan el diseño inicial, logrando una estética muy premium).
- **Componentes de Chat:** Vercel AI SDK (ideal para manejar streaming de IA y estado del chat).
- **Parseo de Markdown:** `react-markdown` para renderizar las respuestas del bot.

### 4.2 Backend (API y Procesamiento)
- **API Routes:** Integradas en Next.js (Serverless functions) o un backend en Node.js/Express.
- **IA Provider:** OpenAI (gpt-4o) o Anthropic (Claude 3.5 Sonnet) para la comprensión del texto y respuestas.
- **Procesamiento de Documentos:** Inserción directa en el contexto o fragmentación ligera.

### 4.3 Almacenamiento y Base de Datos
- **Base de Datos (Historial):** PostgreSQL (Supabase/Neon) o MongoDB para guardar las sesiones de chat.
- **Almacenamiento de Archivos:** Supabase Storage o AWS S3 para los archivos `.md`.

## 5. Casos Límite y Consideraciones
- **Archivos Grandes:** Si el usuario sube un Markdown inmenso, la aplicación debe advertir sobre los límites de tamaño o utilizar fragmentación (chunking).
- **Errores de Red / Streaming:** Manejo elegante en caso de que la conexión se corte mientras la respuesta se está haciendo streaming.
- **Seguridad:** Los archivos de los usuarios deben ser privados y estar asociados únicamente a su sesión/cuenta.

## 6. Fuera de Alcance (MVP)
- Subida de formatos complejos como PDF, DOCX o imágenes.
- Ejecución de código (Code Interpreter).
