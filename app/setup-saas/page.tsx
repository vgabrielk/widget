'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SetupSaaSPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<{
    profiles: boolean | null;
    subscriptions: boolean | null;
    widgets: boolean | null;
    rooms: boolean | null;
    messages: boolean | null;
  }>({
    profiles: null,
    subscriptions: null,
    widgets: null,
    rooms: null,
    messages: null,
  });

  const checkDatabase = async () => {
    setIsChecking(true);
    const supabase = createClient();

    try {
      const checks = await Promise.all([
        supabase.from('profiles').select('id').limit(1),
        supabase.from('subscriptions').select('id').limit(1),
        supabase.from('widgets').select('id').limit(1),
        supabase.from('rooms').select('id').limit(1),
        supabase.from('messages').select('id').limit(1),
      ]);

      setResults({
        profiles: !checks[0].error,
        subscriptions: !checks[1].error,
        widgets: !checks[2].error,
        rooms: !checks[3].error,
        messages: !checks[4].error,
      });
    } catch (error) {
      console.error('Error checking database:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const copySQL = () => {
    const link = document.createElement('a');
    link.href = '/supabase/migrations/002_saas_platform.sql';
    link.download = '002_saas_platform.sql';
    link.click();
    alert('Abrindo arquivo SQL. Cole o conteúdo no Supabase SQL Editor.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              🛠️ Setup da Plataforma SaaS
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Configure o banco de dados multi-tenant completo
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
              {Object.entries(results).map(([table, status]) => (
                <div key={table} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    Tabela: {table}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    status === null ? 'bg-gray-200 text-gray-600' :
                    status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {status === null ? 'Não verificado' :
                     status ? '✓ OK' : '✗ Não encontrada'}
                  </span>
                </div>
              ))}
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
                    Execute a Migration SQL
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Cole o conteúdo do arquivo <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">supabase/migrations/002_saas_platform.sql</code> e execute.
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      ⚠️ Este SQL cria: profiles, subscriptions, widgets, rooms, messages + RLS + triggers
                    </p>
                  </div>
                  <a
                    href="https://github.com/seu-repo/blob/main/supabase/migrations/002_saas_platform.sql"
                    target="_blank"
                    className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Ver SQL no GitHub →
                  </a>
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
                    <li><code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">public.messages</code></li>
                    <li><code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">public.rooms</code></li>
                    <li><code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">public.widgets</code></li>
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
                    Pronto! Crie sua conta
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Agora você pode criar uma conta e começar a usar a plataforma SaaS.
                  </p>
                  <Link
                    href="/auth/signup"
                    className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    🚀 Criar Minha Conta
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Info */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-8 border-2 border-indigo-200 dark:border-indigo-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
              🏗️ Arquitetura Multi-Tenant
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Esta migration cria uma estrutura completa de SaaS:
            </p>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>• <strong>Profiles</strong> - Dados dos clientes</li>
              <li>• <strong>Subscriptions</strong> - Controle de planos e pagamentos</li>
              <li>• <strong>Widgets</strong> - Configurações personalizadas por cliente</li>
              <li>• <strong>Rooms</strong> - Conversas isoladas por widget</li>
              <li>• <strong>Messages</strong> - Mensagens em tempo real</li>
              <li>• <strong>RLS</strong> - Segurança e isolamento de dados</li>
              <li>• <strong>Triggers</strong> - Automação de stats e timestamps</li>
            </ul>
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
    </div>
  );
}

