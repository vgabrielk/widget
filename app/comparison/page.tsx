import Link from 'next/link';

export default function ComparisonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Comparação de Implementações
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Duas abordagens para chat em tempo real com Supabase
            </p>
          </div>

          {/* Comparison Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Custom Widget Implementation */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Widget Customizado
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Implementação completa do zero
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Persistência no Banco</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Mensagens salvas em tabelas do PostgreSQL
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Painel Admin</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Interface completa para responder chats
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Gerenciamento de Rooms</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Sistema completo de salas e visitantes
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Widget Embutível</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Script para adicionar em qualquer site
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Badge de Não Lidas</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Contador de mensagens não lidas
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">LocalStorage</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Mantém identidade entre sessões
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/widget-demo"
                  className="block w-full bg-indigo-600 text-white text-center py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Ver Demo do Widget
                </Link>
                <Link
                  href="/admin"
                  className="block w-full bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 text-center py-3 px-4 rounded-lg border-2 border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Painel Admin
                </Link>
              </div>
            </div>

            {/* Supabase UI Library Implementation */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Supabase UI Library
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Componente oficial pré-construído
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Instalação Rápida</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Um comando via shadcn CLI
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Broadcast Realtime</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Mensagens via WebSocket (não persiste)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Múltiplas Salas</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Sistema simples de channels
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Animações Suaves</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      UI polida com Tailwind CSS
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-1">~</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Sem Persistência</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Mensagens não são salvas no banco
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-yellow-500 mt-1">~</span>
                  <div>
                    <strong className="text-gray-900 dark:text-white">Sem Painel Admin</strong>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Apenas componente de chat
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  href="/realtime-demo"
                  className="block w-full bg-green-600 text-white text-center py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Ver Demo Realtime
                </Link>
                <a
                  href="https://supabase.com/ui"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-white dark:bg-gray-900 text-green-600 dark:text-green-400 text-center py-3 px-4 rounded-lg border-2 border-green-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Docs Supabase UI →
                </a>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              🎯 Qual escolher?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6">
                <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-3">
                  Use o Widget Customizado se:
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>• Precisa de suporte ao cliente (widget estilo Intercom)</li>
                  <li>• Quer histórico de conversas persistente</li>
                  <li>• Precisa de painel admin para responder</li>
                  <li>• Quer embedar em sites externos</li>
                  <li>• Precisa rastrear visitantes</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
                <h3 className="font-bold text-green-900 dark:text-green-300 mb-3">
                  Use o Supabase UI se:
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>• Quer algo rápido e simples</li>
                  <li>• Chat temporário (sem persistência necessária)</li>
                  <li>• Múltiplas salas de chat</li>
                  <li>• Protótipo ou MVP</li>
                  <li>• Componente já testado e oficial</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Back Home */}
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline text-lg"
            >
              ← Voltar para a Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


