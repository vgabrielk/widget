'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, ArrowLeft, CheckCircle2, Mail, Lock, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { JelloLogo, JelloLogoCompact } from '@/components/jello-logo';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/dashboard');
      } else {
        setChecking(false);
      }
    };
    checkAuth();
  }, [router, supabase]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);
    } catch (error: any) {
      setError(error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking authentication
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Conta Criada com Sucesso!</h2>
            <p className="text-muted-foreground">
              Redirecionando para o dashboard...
            </p>
          </div>
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 w-fit">
            <JelloLogoCompact size={48} />
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur">
            <Sparkles className="h-4 w-4 text-white" />
            <span className="text-sm text-white font-medium">Comece grátis hoje</span>
          </div>
          
          <h1 className="text-4xl font-bold text-white leading-tight">
            Configure em minutos, venda por anos
          </h1>
          <p className="text-lg text-white/90">
            Junte-se a milhares de empresas que já melhoraram seu atendimento com nossa plataforma.
          </p>
          
          {/* Features */}
          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Setup em 2 minutos</p>
                <p className="text-white/80 text-sm">Copie e cole o código no seu site</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Chat em tempo real</p>
                <p className="text-white/80 text-sm">Responda instantaneamente seus clientes</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-white flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">14 dias grátis</p>
                <p className="text-white/80 text-sm">Sem cartão de crédito necessário</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <JelloLogo width={160} height={42} priority />
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">
              Criar Conta Grátis
            </h2>
            <p className="text-muted-foreground">
              Comece a conversar com seus visitantes em 2 minutos
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
                    disabled={loading}
                    className="pl-10 h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    disabled={loading}
                    className="pl-10 h-12"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo de 6 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    disabled={loading}
                    className="pl-10 h-12"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {loading ? 'Criando conta...' : 'Criar Conta Grátis'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao criar uma conta, você concorda com nossos{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Termos de Serviço
              </Link>{' '}
              e{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
            </p>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Já tem uma conta?
              </span>
            </div>
          </div>

          {/* Login Link */}
          <div className="space-y-4">
            <Button variant="outline" asChild className="w-full h-12">
              <Link href="/auth/login">
                Fazer Login
              </Link>
            </Button>

            <Button variant="ghost" asChild className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
