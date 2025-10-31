'use client';

import { RealtimeChat } from '@/components/realtime-chat';
import { useState } from 'react';
import Link from 'next/link';

export default function RealtimeDemoPage() {
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('general');
  const [hasJoined, setHasJoined] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setHasJoined(true);
    }
  };

  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              💬 Realtime Chat
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Componente oficial do Supabase UI Library
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Seu Nome
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu nome..."
                className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label htmlFor="room" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sala
              </label>
              <select
                id="room"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="general">Geral</option>
                <option value="support">Suporte</option>
                <option value="random">Aleatório</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Entrar no Chat
            </button>
          </form>

          <div className="mt-6 pt-6 border-t dark:border-gray-700">
            <Link
              href="/"
              className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
            >
              ← Voltar para a home
            </Link>
          </div>

          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              ℹ️ Sobre este chat
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• Usa Supabase Broadcast (não persiste no banco)</li>
              <li>• Mensagens em tempo real via WebSocket</li>
              <li>• Múltiplas salas disponíveis</li>
              <li>• Componente oficial da Supabase UI Library</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Sala: {roomName}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Conectado como {username}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                ← Voltar
              </Link>
              <button
                onClick={() => setHasJoined(false)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 container mx-auto p-4 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl h-[calc(100vh-200px)] overflow-hidden">
          <RealtimeChat
            roomName={roomName}
            username={username}
            onMessage={(messages) => {
              // Você pode salvar as mensagens no banco de dados aqui
              console.log('Mensagens:', messages);
            }}
          />
        </div>

        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            💡 <strong>Dica:</strong> Abra em outra aba ou dispositivo para testar o chat em tempo real!
          </p>
        </div>
      </div>
    </div>
  );
}


