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
import { JelloLogo } from '@/components/jello-logo';
import Image from 'next/image';

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
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error('Signup error:', error);
        throw error;
      }

      // Check if email confirmation is required
      if (data?.user && !data.session) {
        // Email confirmation required
        setError('Por favor, verifique seu email para confirmar sua conta antes de fazer login.');
        setLoading(false);
        return;
      }

      // User is automatically logged in (email confirmation disabled)
      if (data?.session) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 1000);
      } else {
        setError('Erro ao criar sessão. Por favor, tente fazer login após confirmar seu email.');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Signup error details:', error);
      setError(error.message || 'Erro ao criar conta');
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
      {/* Left Side - Banner */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="/banner.jpg"
          alt="Banner"
          fill
          priority
          className="object-cover"
        />
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
