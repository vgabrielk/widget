'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SetupServiceKeyPage() {
  const [serviceKey, setServiceKey] = useState('');
  const [copied, setCopied] = useState(false);

  const envContent = serviceKey 
    ? `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`
    : 'SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-aqui';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">🔑</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Adicionar Service Role Key
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Necessário para o widget funcionar com RLS
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Problema */}
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                ⚠️ Por que preciso disso?
              </h3>
              <p className="text-yellow-800 dark:text-yellow-400 text-sm">
                A RLS (Row Level Security) do Supabase está bloqueando o acesso ao widget. 
                A Service Role Key permite que o servidor Next.js busque a configuração do widget 
                (nunca é exposta ao cliente!).
              </p>
            </div>

            {/* Segurança */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">
                🔒 É Seguro?
              </h3>
              <ul className="text-green-800 dark:text-green-400 text-sm space-y-1">
                <li>✅ A chave fica <strong>apenas no servidor</strong> (variável de ambiente)</li>
                <li>✅ <strong>NUNCA</strong> é enviada para o cliente</li>
                <li>✅ O cliente recebe apenas a chave anônima (pública)</li>
                <li>✅ O widget continua protegido por domínios permitidos</li>
              </ul>
            </div>

            {/* Passos */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">
                📋 Como Adicionar (3 Passos):
              </h3>
              
              <div className="space-y-4">
                {/* Passo 1 */}
                <div className="border-l-4 border-indigo-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded font-semibold text-sm">
                      Passo 1
                    </span>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Acesse o Supabase Dashboard
                    </h4>
                  </div>
                  <a
                    href="https://supabase.com/dashboard/project/eyjtfyasmzrptmzjeiza/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                  >
                    <span>Abrir Project Settings → API</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Procure pela seção <strong>"Project API keys"</strong> e localize <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">service_role</code> <span className="text-red-600 dark:text-red-400 font-semibold">[secret]</span>
                  </p>
                </div>

                {/* Passo 2 */}
                <div className="border-l-4 border-indigo-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded font-semibold text-sm">
                      Passo 2
                    </span>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Cole a Service Role Key aqui
                    </h4>
                  </div>
                  <input
                    type="password"
                    value={serviceKey}
                    onChange={(e) => setServiceKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    A chave começa com <code>eyJ...</code> e é bem longa
                  </p>
                </div>

                {/* Passo 3 */}
                <div className="border-l-4 border-indigo-500 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded font-semibold text-sm">
                      Passo 3
                    </span>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      Adicione ao arquivo .env.local
                    </h4>
                  </div>
                  
                  <div className="bg-gray-900 rounded-lg p-4 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-xs font-mono">.env.local</span>
                      <button
                        onClick={copyToClipboard}
                        disabled={!serviceKey}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {copied ? '✓ Copiado!' : '📋 Copiar'}
                      </button>
                    </div>
                    <pre className="text-sm text-gray-100 overflow-x-auto">
                      <code>{envContent}</code>
                    </pre>
                  </div>
                  
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <p className="text-sm text-blue-900 dark:text-blue-300">
                      <strong>Como editar:</strong>
                    </p>
                    <ol className="text-sm text-blue-800 dark:text-blue-400 mt-2 space-y-1 list-decimal list-inside">
                      <li>Abra o arquivo <code>.env.local</code> na raiz do projeto</li>
                      <li>Adicione a linha copiada acima no final do arquivo</li>
                      <li>Salve o arquivo</li>
                      <li>Reinicie o servidor (Ctrl+C e <code>npm run dev</code>)</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            {/* Aviso importante */}
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2 flex items-center gap-2">
                <span>⚠️</span>
                IMPORTANTE - Segurança
              </h3>
              <ul className="text-red-800 dark:text-red-400 text-sm space-y-1 list-disc list-inside">
                <li><strong>NUNCA</strong> commite o arquivo <code>.env.local</code> no Git</li>
                <li><strong>NUNCA</strong> exponha esta chave no frontend/cliente</li>
                <li>Use apenas no servidor (API Routes, Server Components)</li>
                <li>Está bloqueada pelo <code>.gitignore</code> por padrão ✓</li>
              </ul>
            </div>

            {/* Verificar */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                🧪 Como Verificar se Funcionou
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Após adicionar a chave e reiniciar o servidor, execute no terminal:
              </p>
              <div className="bg-gray-900 rounded p-3 font-mono text-xs text-gray-100 overflow-x-auto">
                curl http://localhost:3000/api/debug/widget/f14808783824755ad6827ddee776975e75271054bff6e31d1a5d9f9fd077d6d9
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Você deve ver <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">"withServiceRole": &#123; "data": &#123; ... &#125; &#125;</code>
              </p>
            </div>

            {/* Navegação */}
            <div className="flex gap-4 pt-4">
              <Link
                href="/"
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-center font-medium"
              >
                ← Voltar
              </Link>
              <a
                href="https://supabase.com/dashboard/project/eyjtfyasmzrptmzjeiza/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-center font-medium"
              >
                Abrir Supabase →
              </a>
            </div>
          </div>
        </div>

        {/* Ajuda */}
        <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
            📚 Documentação Completa
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Para mais detalhes, consulte:
          </p>
          <code className="text-sm text-indigo-600 dark:text-indigo-400 block">
            ADICIONAR_SERVICE_KEY.md
          </code>
        </div>
      </div>
    </div>
  );
}


