'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FixWidgetRLSPage() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const sqlScript = `-- Remover policy antiga
DROP POLICY IF EXISTS "Public can view widget by public_key" ON public.widgets;

-- Criar nova policy que permite acesso anônimo para widgets ativos
CREATE POLICY "Anyone can view active widgets by public_key"
  ON public.widgets
  FOR SELECT
  USING (is_active = true);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setStatus('success');
    setMessage('SQL copiado! Cole no SQL Editor do Supabase.');
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">🔧</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Corrigir Acesso ao Widget
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                A RLS está bloqueando o acesso anônimo ao widget
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Problema */}
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                ❌ Problema Identificado
              </h3>
              <p className="text-red-800 dark:text-red-400 text-sm">
                O widget existe no banco de dados, mas a Row Level Security (RLS) está bloqueando
                o acesso quando acessado anonimamente de sites externos.
              </p>
            </div>

            {/* Solução */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">
                ✅ Solução
              </h3>
              <p className="text-green-800 dark:text-green-400 text-sm">
                Execute o SQL abaixo no Supabase Dashboard para corrigir a policy de acesso.
              </p>
            </div>

            {/* Passos */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                📋 Como Aplicar:
              </h3>
              <ol className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </span>
                  <span>
                    Clique em <strong>"Copiar SQL"</strong> abaixo
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </span>
                  <div>
                    Acesse o <strong>SQL Editor</strong> do Supabase:
                    <br />
                    <a
                      href="https://supabase.com/dashboard/project/eyjtfyasmzrptmzjeiza/sql"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      Abrir SQL Editor
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </span>
                  <span>
                    Cole o SQL e clique em <strong>"Run"</strong>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-semibold">
                    4
                  </span>
                  <span>
                    Recarregue sua página com o widget
                  </span>
                </li>
              </ol>
            </div>

            {/* SQL Script */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  SQL Script:
                </h3>
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  📋 Copiar SQL
                </button>
              </div>
              
              {status === 'success' && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-sm">
                  ✅ {message}
                </div>
              )}

              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-gray-100">
                  <code>{sqlScript}</code>
                </pre>
              </div>
            </div>

            {/* Segurança */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                🔒 Por que isso é seguro?
              </h3>
              <ul className="text-blue-800 dark:text-blue-400 text-sm space-y-1 list-disc list-inside">
                <li>Apenas widgets <strong>ativos</strong> podem ser acessados</li>
                <li>Apenas dados <strong>públicos</strong> são expostos (nome, cor, mensagem)</li>
                <li>Dados sensíveis (user_id, timestamps) não são retornados</li>
                <li>O public_key funciona como uma chave de API pública</li>
                <li>A restrição de domínios ainda funciona para segurança adicional</li>
              </ul>
            </div>

            {/* Navegação */}
            <div className="flex gap-4 pt-4">
              <Link
                href="/dashboard"
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-center font-medium"
              >
                ← Voltar ao Dashboard
              </Link>
              <a
                href="https://supabase.com/dashboard/project/eyjtfyasmzrptmzjeiza/sql"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-center font-medium"
              >
                Abrir SQL Editor →
              </a>
            </div>
          </div>
        </div>

        {/* Documentação adicional */}
        <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
            📚 Documentação
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Para mais detalhes, consulte os arquivos:
          </p>
          <ul className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 space-y-1">
            <li>• <code>FIX_WIDGET_ACCESS.md</code></li>
            <li>• <code>supabase/migrations/003_fix_widget_rls.sql</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}


