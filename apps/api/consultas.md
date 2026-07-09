1. Entra a tu base de datos desde la terminal
bash


sqlite3 apps/api/local.db
2. Ejecuta estas consultas de verificación:
Para comprobar que la conversación ya no existe:

sql


SELECT * FROM conversations;
(Solo verás los IDs de los chats que NO hayas borrado. El que borraste habrá desaparecido).

Para comprobar que el archivo asociado al chat se eliminó:

sql


SELECT id, filename FROM files;
(El archivo que subiste en ese chat ya no debe listarse aquí).

Para comprobar que los chunks de texto y los vectores se borraron:

sql


SELECT COUNT(*) FROM file_chunks;
SELECT COUNT(*) FROM file_chunk_embeddings;
(Si el chat borrado era el único con un archivo grande, ambos contadores deberían dar 0 o haber disminuido exactamente en la cantidad de chunks que tenía el documento).