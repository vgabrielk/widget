import { ChatWidget } from '@/components/chat/ChatWidget';

export default function WidgetDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Realtime Chat Widget 💬
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Widget de chat em tempo real para qualquer website
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tempo Real</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Mensagens instantâneas com Supabase Realtime. Sem necessidade de recarregar a página.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Fácil Integração</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Adicione em qualquer site com uma única linha de código. Totalmente customizável.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-pink-600 dark:text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notificações</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Badge de mensagens não lidas e notificações visuais para não perder nenhuma mensagem.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Seguro</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Autenticação anônima e Row Level Security do Supabase garantem a privacidade.
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Como Usar
            </h2>
            <ol className="space-y-4 text-gray-600 dark:text-gray-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </span>
                <div>
                  <strong className="text-gray-900 dark:text-white">Execute a migration SQL no Supabase:</strong>
                  <p className="mt-1">
                    <a href="/setup" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                      Clique aqui para ir para a página de setup →
                    </a>
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </span>
                <div>
                  <strong className="text-gray-900 dark:text-white">Habilite o Realtime:</strong>
                  <p className="mt-1">No Supabase Dashboard, vá em Database → Replication e habilite o Realtime para as tabelas <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">messages</code> e <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">rooms</code></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </span>
                <div>
                  <strong className="text-gray-900 dark:text-white">Teste o widget:</strong>
                  <p className="mt-1">Clique no botão flutuante no canto inferior direito desta página e envie uma mensagem!</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </span>
                <div>
                  <strong className="text-gray-900 dark:text-white">Responda pelo painel admin:</strong>
                  <p className="mt-1">Acesse <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">/admin</code> para ver todas as conversas e responder em tempo real</p>
                </div>
              </li>
            </ol>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a
              href="/admin"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
              Ir para Painel Admin
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Chat Widget */}
      <ChatWidget
        position="bottom-right"
        brandColor="#6366f1"
        welcomeMessage="Olá! 👋 Bem-vindo ao nosso chat. Como posso ajudar?"
      />
    </div>
  );
}

