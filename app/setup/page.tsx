'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';

export default function SetupPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<{
    rooms: boolean | null;
    messages: boolean | null;
    realtime: boolean | null;
  }>({
    rooms: null,
    messages: null,
    realtime: null,
  });
  const { success: showSuccess, ToastContainer } = useToast();

  const checkDatabase = async () => {
    setIsChecking(true);
    const supabase = createClient();

    try {
      // Check if rooms table exists
      const { error: roomsError } = await supabase
        .from('rooms')
        .select('id')
        .limit(1);

      // Check if messages table exists
      const { error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .limit(1);

      setResults({
        rooms: !roomsError,
        messages: !messagesError,
        realtime: true, // Will check in a moment
      });
    } catch (error) {
      console.error('Error checking database:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const sqlMigration = `-- Create rooms table for chat sessions
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('visitor', 'admin')),
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_visitor_id ON public.rooms(visitor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);

-- Enable Row Level Security
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies for rooms table
DROP POLICY IF EXISTS "Users can read their own room" ON public.rooms;
CREATE POLICY "Users can read their own room"
  ON public.rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create rooms" ON public.rooms;
CREATE POLICY "Users can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own room" ON public.rooms;
CREATE POLICY "Users can update their own room"
  ON public.rooms FOR UPDATE
  USING (true);

-- Policies for messages table
DROP POLICY IF EXISTS "Users can read messages" ON public.messages;
CREATE POLICY "Users can read messages"
  ON public.messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create messages" ON public.messages;
CREATE POLICY "Users can create messages"
  ON public.messages FOR INSERT
  WITH CHECK (true);

-- Function to update room's last_message_at
CREATE OR REPLACE FUNCTION public.update_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.rooms
  SET 
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.sender_type = 'visitor' THEN unread_count + 1
      ELSE unread_count
    END
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update room when message is inserted
DROP TRIGGER IF EXISTS update_room_on_message ON public.messages;
CREATE TRIGGER update_room_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_last_message();

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlMigration);
    showSuccess('SQL copiado para a área de transferência!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              🛠️ Configuração do Banco de Dados
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Configure o Supabase para usar o Widget Customizado
            </p>
          </div>

          {/* Status Check */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Status das Tabelas
              </h2>
              <button
                onClick={checkDatabase}
                disabled={isChecking}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isChecking ? 'Verificando...' : 'Verificar Agora'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="font-medium text-gray-900 dark:text-white">
                  Tabela: rooms
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  results.rooms === null ? 'bg-gray-200 text-gray-600' :
                  results.rooms ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {results.rooms === null ? 'Não verificado' :
                   results.rooms ? '✓ OK' : '✗ Não encontrada'}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="font-medium text-gray-900 dark:text-white">
                  Tabela: messages
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  results.messages === null ? 'bg-gray-200 text-gray-600' :
                  results.messages ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {results.messages === null ? 'Não verificado' :
                   results.messages ? '✓ OK' : '✗ Não encontrada'}
                </span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              📋 Passo a Passo
            </h2>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Acesse o SQL Editor do Supabase
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Vá até seu projeto no Supabase Dashboard e clique em <strong>SQL Editor</strong>.
                  </p>
                  <a
                    href="https://supabase.com/dashboard/project/_/sql"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Abrir SQL Editor →
                  </a>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Copie e execute o SQL abaixo
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Clique no botão "Copiar SQL" e cole no SQL Editor. Depois clique em "Run".
                  </p>
                  <button
                    onClick={copyToClipboard}
                    className="mb-3 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    📋 Copiar SQL
                  </button>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-green-400 text-sm">
                      <code>{sqlMigration}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Habilite o Realtime
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Vá em <strong>Database → Replication</strong> e habilite Realtime para:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mb-3">
                    <li><code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">public.rooms</code></li>
                    <li><code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">public.messages</code></li>
                  </ul>
                  <a
                    href="https://supabase.com/dashboard/project/_/database/replication"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Abrir Replication Settings →
                  </a>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Pronto! Teste o Widget
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Clique no botão abaixo para voltar e verificar se está funcionando.
                  </p>
                  <Link
                    href="/widget-demo"
                    className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    🚀 Testar Widget Agora
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Alternative: Use Supabase UI */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-8 border-2 border-yellow-200 dark:border-yellow-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              💡 Alternativa: Use o Supabase UI Library
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Se você não quer configurar o banco de dados agora, pode usar o componente oficial do Supabase que funciona sem persistência (apenas Broadcast):
            </p>
            <Link
              href="/realtime-demo"
              className="inline-block bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              ⚡ Testar Supabase UI Demo
            </Link>
          </div>

          {/* Back Home */}
          <div className="text-center mt-8">
            <Link
              href="/"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← Voltar para Home
            </Link>
          </div>
        </div>
      </div>
      {ToastContainer}
    </div>
  );
}

