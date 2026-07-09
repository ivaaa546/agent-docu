'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit3,
  FileText,
  Paperclip,
  Send,
  X,
  Loader2,
  Sparkles,
  Upload,
  BookOpen,
} from 'lucide-react';
import { useChatStream } from '../hooks/useChatStream';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface FileItem {
  id: string;
  filename: string;
  is_chunked: number;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hook del chat
  const {
    messages,
    isStreaming,
    error: chatError,
    sendMessage,
    fetchHistory,
    setMessages,
  } = useChatStream(activeConvId || '');

  // Cargar lista de conversaciones
  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0 && !activeConvId) {
          setActiveConvId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error cargando conversaciones:', e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Cargar historial y archivos cuando cambia la conversación activa
  useEffect(() => {
    if (activeConvId) {
      fetchHistory(activeConvId);
      loadFiles(activeConvId);
    } else {
      setMessages([]);
      setFiles([]);
    }
  }, [activeConvId, fetchHistory]);

  // Hacer scroll automático al final de los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Cargar archivos asociados
  const loadFiles = async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Crear nueva conversación
  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nueva Conversación' }),
      });
      if (res.ok) {
        const newConv = await res.json();
        setConversations(prev => [newConv, ...prev]);
        setActiveConvId(newConv.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Renombrar conversación
  const handleRename = async (id: string, currentTitle: string) => {
    const newTitle = prompt('Nuevo título para la conversación:', currentTitle);
    if (!newTitle || !newTitle.trim()) return;

    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConversations(prev => prev.map(c => (c.id === id ? updated : c)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Eliminar conversación
  const handleDeleteConversation = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta conversación? Todos los archivos y mensajes se perderán.')) {
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConvId === id) {
          const remaining = conversations.filter(c => c.id !== id);
          setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Subir archivos `.md`
  const handleFileUpload = async (eventFiles: FileList | null) => {
    if (!eventFiles || eventFiles.length === 0 || !activeConvId) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < eventFiles.length; i++) {
      const file = eventFiles[i];
      if (!file.name.endsWith('.md')) {
        alert('Solo se admiten archivos Markdown (.md)');
        setIsUploading(false);
        return;
      }
      formData.append('files', file);
    }

    try {
      const res = await fetch(`/api/conversations/${activeConvId}/files`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await loadFiles(activeConvId);
      } else {
        let errMsg = 'Error en el servidor';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch {
          errMsg = res.statusText || errMsg;
        }
        alert(`Error al subir archivos: ${errMsg}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión al subir archivos.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Eliminar archivo individual
  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('¿Eliminar este archivo? La IA dejará de considerarlo en la conversación.')) return;

    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });
      if (res.ok && activeConvId) {
        await loadFiles(activeConvId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Vaciar todos los archivos de la conversación
  const handleClearAllFiles = async () => {
    if (!confirm('¿Eliminar todos los archivos adjuntos en esta conversación?')) return;
    for (const f of files) {
      await fetch(`/api/files/${f.id}`, { method: 'DELETE' });
    }
    if (activeConvId) await loadFiles(activeConvId);
  };

  // Enviar mensaje en el chat
  const handleSend = () => {
    if (!inputVal.trim() || isStreaming) return;
    sendMessage(inputVal);
    setInputVal('');
  };

  // Acciones rápidas (chips)
  const handleQuickAction = (actionText: string) => {
    if (isStreaming) return;
    sendMessage(actionText);
  };

  // Manejo de drag & drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  return (
    <div className="app-container" onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-section">
          <h1 className="brand-name">Docu AI</h1>
        </div>

        <button className="new-chat-btn" onClick={handleNewConversation}>
          <Plus size={18} />
          Nueva conversación
        </button>

        <span className="section-label">Tus conversaciones</span>
        <div className="conversations-section">
          {conversations.map(c => (
            <div key={c.id} className={`conv-item ${activeConvId === c.id ? 'active' : ''}`} onClick={() => setActiveConvId(c.id)}>
              <div className="conv-title-wrapper">
                <MessageSquare size={16} />
                <span className="conv-title">{c.title}</span>
              </div>
              <div className="conv-actions">
                <button
                  className="conv-action-btn"
                  onClick={e => {
                    e.stopPropagation();
                    handleRename(c.id, c.title);
                  }}
                  title="Renombrar"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  className="conv-action-btn"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteConversation(c.id);
                  }}
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Area */}
      <main className="main-area">
        {/* Header */}
        <header className="header">
          <h2 className="header-title">{activeConv ? activeConv.title : 'Docu AI'}</h2>
          <div className="header-actions">
            {activeConvId && (
              <button className="file-panel-toggle" onClick={() => setIsFilePanelOpen(!isFilePanelOpen)}>
                <Paperclip size={16} />
                <span>Archivos ({files.length})</span>
              </button>
            )}
          </div>
        </header>

        {/* File Drawer / Panel */}
        {isFilePanelOpen && activeConvId && (
          <div className="file-panel-wrapper">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-label" style={{ padding: 0 }}>Gestor de Documentos</span>
              <button onClick={() => setIsFilePanelOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div onClick={() => fileInputRef.current?.click()} className={`dropzone ${dragActive ? 'drag-active' : ''}`}>
              <Upload size={24} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Arrastra tus archivos aquí</span>
              <span className="dropzone-text">o haz clic para explorar tu dispositivo (.md)</span>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".md"
                multiple
                onChange={e => handleFileUpload(e.target.files)}
              />
            </div>

            {isUploading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Subiendo e indexando documentos...</span>
              </div>
            )}

            <div className="file-list">
              {files.map(f => (
                <div key={f.id} className="file-item">
                  <div className="file-name-wrapper">
                    <FileText size={14} style={{ color: 'var(--primary)' }} />
                    <span className="file-name" title={f.filename}>
                      {f.filename}
                    </span>
                    {f.is_chunked === 1 && (
                      <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--primary-light)', padding: '2px 4px', borderRadius: 4, fontWeight: 600, color: 'var(--primary)' }}>
                        RAG
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleDeleteFile(f.id)} style={{ color: 'var(--accent-red)', padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {files.length > 0 && (
              <button
                onClick={handleClearAllFiles}
                style={{ width: '100%', padding: '8px', borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                Vaciar todos los archivos
              </button>
            )}
          </div>
        )}

        {/* Chat Window */}
        {!activeConvId ? (
          <div className="welcome-screen">
            <h3 className="welcome-title">Te damos la bienvenida a Docu AI</h3>
            <p className="welcome-subtitle">
              Sube tus archivos Markdown y chatea sobre su contenido. Crea una nueva conversación en la barra lateral para empezar.
            </p>
            <button className="new-chat-btn" onClick={handleNewConversation} style={{ margin: 0 }}>
              Crear nueva conversación
            </button>
          </div>
        ) : (
          <>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="welcome-screen" style={{ flex: 'none', margin: 'auto' }}>
                  <Sparkles size={32} style={{ color: 'var(--primary)' }} />
                  <h4 style={{ fontWeight: 600, fontSize: '1.25rem' }}>La conversación está lista</h4>
                  <p className="welcome-subtitle">
                    Adjunta algún archivo Markdown (.md) desde el botón superior o escribe un mensaje para empezar.
                  </p>
                </div>
              )}

              {messages.map(m => (
                <div key={m.id} className="message-wrapper">
                  <div className="message-bubble">
                    <span className="message-sender">{m.role === 'user' ? 'Tú' : 'Docu AI'}</span>
                    <div className="message-content">
                      {m.id === 'temp_assistant' && m.content === '' ? (
                        <div className="loading-dots">
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                        </div>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isStreaming && messages[messages.length - 1]?.role === 'user' && (
                <div className="message-wrapper">
                  <div className="message-bubble">
                    <span className="message-sender">Docu AI</span>
                    <div className="message-content">
                      <div className="loading-dots">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {chatError && (
                <div style={{ color: 'var(--accent-red)', padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, fontSize: '0.9rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <X size={16} />
                  <span>{chatError}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="input-area-wrapper">
              {files.length > 0 && messages.length === 0 && (
                <div className="quick-actions-bar">
                  <button className="quick-action-chip" onClick={() => handleQuickAction('Haz un resumen estructurado de los documentos subidos')}>
                    Resumir documentos
                  </button>
                  <button className="quick-action-chip" onClick={() => handleQuickAction('Extrae los puntos clave y lecciones más importantes')}>
                    Puntos clave
                  </button>
                  <button className="quick-action-chip" onClick={() => handleQuickAction('¿Cuáles son los temas o secciones principales de esta información?')}>
                    Estructura
                  </button>
                </div>
              )}

              <div className="input-box">
                <textarea
                  className="chat-input"
                  placeholder={files.length > 0 ? "Pregunta a Docu AI sobre tus documentos..." : "Escribe un mensaje..."}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="input-controls">
                  <div style={{ display: 'flex', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem', alignItems: 'center' }}>
                    {files.length > 0 ? (
                      <>
                        <BookOpen size={14} />
                        <span>Contexto activo ({files.length} doc)</span>
                      </>
                    ) : (
                      <span>Sin archivos adjuntos</span>
                    )}
                  </div>
                  <button className="send-btn" onClick={handleSend} disabled={!inputVal.trim() || isStreaming}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
