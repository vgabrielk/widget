'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewWidgetPage() {
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#6366f1');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [welcomeMessage, setWelcomeMessage] = useState('Olá! Como posso ajudar você hoje?');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          brand_color: brandColor,
          position,
          welcome_message: welcomeMessage,
          company_name: companyName || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create widget: ${res.statusText}`);
      }

      const data = await res.json();
      router.push(`/dashboard/widgets/${data.widget.id}/settings`);
    } catch (error: any) {
      setError(error.message || 'Erro ao criar widget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              ← Voltar
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Criar Novo Widget
            </h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          {/* Form */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <form onSubmit={handleCreate} className="space-y-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Widget *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Suporte Site Principal"
                  className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Minha Empresa"
                  className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cor Principal
                </label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-12 w-20 cursor-pointer rounded-lg border dark:border-gray-700"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="flex-1 px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Posição
                </label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as 'bottom-right' | 'bottom-left')}
                  className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="bottom-right">Inferior Direito</option>
                  <option value="bottom-left">Inferior Esquerdo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mensagem de Boas-vindas
                </label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
              >
                {loading ? 'Criando...' : 'Criar Widget'}
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="bg-gray-100 dark:bg-gray-950 rounded-xl p-8 relative" style={{ minHeight: '600px' }}>
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preview do Widget
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Veja como ficará no seu site
              </p>
            </div>

            {/* Widget Button */}
            <button
              className={`fixed ${position === 'bottom-right' ? 'right-8' : 'left-8'} bottom-8 w-16 h-16 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center`}
              style={{ backgroundColor: brandColor }}
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>

            {/* Simulated chat window */}
            <div className={`fixed ${position === 'bottom-right' ? 'right-8' : 'left-8'} bottom-28 w-96 max-w-[calc(100vw-4rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden`}>
              <div className="p-4 text-white" style={{ backgroundColor: brandColor }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold">{companyName || 'Chat de Suporte'}</h4>
                    <p className="text-xs text-white/80">Online</p>
                  </div>
                </div>
              </div>
              <div className="p-4 h-64 bg-gray-50 dark:bg-gray-900">
                <div className="flex gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: `${brandColor}20` }}>
                    <svg className="w-8 h-8 p-1" style={{ color: brandColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none p-3 max-w-[80%]">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {welcomeMessage}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Digite sua mensagem..."
                  disabled
                  className="w-full px-4 py-2 border dark:border-gray-700 rounded-full bg-gray-100 dark:bg-gray-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


