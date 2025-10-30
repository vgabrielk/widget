import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { MessageSquare, Zap, Palette, BarChart3, Smartphone, Shield, ArrowRight, CheckCircle2 } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users to dashboard
  if (user) {
    redirect('/dashboard');
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-950">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">ChatWidget</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/auth/login">
                Login
              </Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">
                Começar Grátis
              </Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <div className="container mx-auto px-4 py-20 text-center">
        <Badge className="mb-4" variant="secondary">
          🎉 Novo: Agora com suporte a Dark Mode
        </Badge>
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
          Chat em Tempo Real<br/>
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Para Seu Site
          </span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
          Conecte-se com seus visitantes instantaneamente. Widget de chat profissional com mensagens em tempo real, fácil de instalar e totalmente customizável.
        </p>

        <div className="flex flex-wrap gap-4 justify-center mb-12">
          <Button size="lg" asChild className="text-lg h-14 px-8">
            <Link href="/auth/signup">
              Começar Grátis - 14 dias trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="text-lg h-14 px-8">
            <Link href="/demo">
              Ver Demo
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span>Sem cartão de crédito</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span>Instalação em 2 minutos</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span>Cancele quando quiser</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Tudo que você precisa para conversar com seus clientes
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Recursos poderosos para criar uma experiência de chat excepcional
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="border-2 hover:border-indigo-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <CardTitle>Mensagens em Tempo Real</CardTitle>
              <CardDescription>
                Converse com seus visitantes instantaneamente usando Supabase Realtime. Zero latência, 100% confiável.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-purple-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <Palette className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>Totalmente Customizável</CardTitle>
              <CardDescription>
                Personalize cores, mensagens, posição e muito mais. O widget se adapta perfeitamente ao design do seu site.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-pink-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-pink-600 dark:text-pink-400" />
              </div>
              <CardTitle>Dashboard Profissional</CardTitle>
              <CardDescription>
                Gerencie todas as conversas em um único lugar. Responda rápido e mantenha seus clientes satisfeitos.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                <Smartphone className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Mobile Friendly</CardTitle>
              <CardDescription>
                Funciona perfeitamente em todos os dispositivos. Seus visitantes podem conversar de qualquer lugar.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-yellow-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <CardTitle>Fácil de Instalar</CardTitle>
              <CardDescription>
                Apenas cole um código no seu site e pronto. Não precisa de conhecimento técnico.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-red-500 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle>Seguro e Confiável</CardTitle>
              <CardDescription>
                Construído com Supabase. Seus dados estão seguros e protegidos com RLS.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 border-0 text-white shadow-2xl max-w-4xl mx-auto">
          <CardHeader className="text-center space-y-4 pb-8">
            <CardTitle className="text-4xl text-white">
              Pronto para Começar?
            </CardTitle>
            <CardDescription className="text-xl text-white/90">
              Junte-se a centenas de empresas que usam ChatWidget
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button size="lg" variant="secondary" asChild className="text-lg h-14 px-8">
              <Link href="/auth/signup">
                Criar Conta Grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t dark:border-gray-800">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground text-center">
            © 2025 ChatWidget. Powered by Supabase.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Button variant="link" asChild className="h-auto p-0">
              <Link href="/setup-saas">Setup</Link>
            </Button>
            <Button variant="link" asChild className="h-auto p-0">
              <Link href="/realtime-demo">Demo</Link>
            </Button>
            <Button variant="link" asChild className="h-auto p-0">
              <Link href="/comparison">Comparação</Link>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
