'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Mail, 
  Shield, 
  Bell, 
  Palette,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Key,
  Globe,
  Moon,
  Sun,
  Sparkles
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User Settings
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUser(user);
      setEmail(user.email || '');
      
      // Load user metadata/preferences if you have a profiles table
      // For now, using auth user data
      setDisplayName(user.user_metadata?.display_name || user.email?.split('@')[0] || '');
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading user:', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          email_notifications: emailNotifications,
          push_notifications: pushNotifications,
          weekly_reports: weeklyReports,
        }
      });

      if (updateError) throw updateError;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      setError(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // Note: Supabase doesn't have a direct delete user endpoint from client
      // You'd need to implement this via an Edge Function or admin SDK
      alert('Para deletar sua conta, entre em contato com o suporte.');
    } catch (error: any) {
      setError(error.message);
    }
  };

  const getInitials = (email: string) => {
    return email.split('@')[0].substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <DashboardLayout email={email} title="Configurações">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      email={email}
      title="Configurações"
      description="Gerencie suas preferências e informações da conta"
    >
      <div className="max-w-5xl space-y-6">
        {/* Success/Error Messages */}
        {saved && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Configurações salvas com sucesso!</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Suas alterações foram aplicadas.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-destructive">Erro ao salvar</p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Section */}
        <Card className="card-clean overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />
          <CardContent className="space-y-6 -mt-12">
            {/* Avatar */}
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-2xl">
                  {email ? getInitials(email) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 pt-8">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold">{displayName || 'Usuário'}</h3>
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    Ativo
                  </Badge>
                </div>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {email}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nome de Exibição
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Como você quer ser chamado"
                />
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email não pode ser alterado
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="card-clean">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>
                  Configure como você quer receber atualizações
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notif" className="text-base font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    Notificações por Email
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receba emails quando houver novas mensagens
                  </p>
                </div>
                <Switch
                  id="email-notif"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-notif" className="text-base font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4 text-purple-500" />
                    Notificações Push
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receba notificações no navegador em tempo real
                  </p>
                </div>
                <Switch
                  id="push-notif"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekly-reports" className="text-base font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Relatório Semanal
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receba um resumo semanal de suas conversas
                  </p>
                </div>
                <Switch
                  id="weekly-reports"
                  checked={weeklyReports}
                  onCheckedChange={setWeeklyReports}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Preferences Section */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Palette className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Aparência</CardTitle>
                  <CardDescription>
                    Personalize o visual
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Sun className="h-4 w-4 text-orange-500" />
                  Tema
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use o botão no header para alternar entre claro/escuro
                </p>
                <div className="flex gap-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 flex-1 p-3 rounded-md bg-white dark:bg-gray-950 border-2">
                    <Sun className="h-4 w-4" />
                    <span className="text-xs font-medium">Claro</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 flex-1 p-3 rounded-md bg-gray-900 text-white border-2">
                    <Moon className="h-4 w-4" />
                    <span className="text-xs font-medium">Escuro</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language & Region */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Idioma & Região</CardTitle>
                  <CardDescription>
                    Configurações regionais
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Idioma</Label>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🇧🇷</div>
                    <div>
                      <p className="font-medium">Português (Brasil)</p>
                      <p className="text-xs text-muted-foreground">pt-BR</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Padrão</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security & Danger Zone */}
        <Card className="card-clean border-2 border-destructive/30 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <Shield className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-destructive flex items-center gap-2">
                  Zona de Perigo
                  <Badge variant="destructive" className="text-xs">Cuidado</Badge>
                </CardTitle>
                <CardDescription>
                  Ações irreversíveis da conta
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-destructive/20 bg-background">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <p className="font-semibold text-destructive">Deletar Conta</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Remove permanentemente sua conta e todos os dados associados.
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="shrink-0">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Deletar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                      </div>
                      <div>
                        <AlertDialogTitle>Deletar sua conta?</AlertDialogTitle>
                        <p className="text-sm text-muted-foreground">Esta ação é permanente</p>
                      </div>
                    </div>
                    <AlertDialogDescription className="text-base">
                      Isso irá permanentemente deletar sua conta e remover todos os seus dados dos nossos servidores, incluindo:
                      <ul className="list-disc list-inside mt-3 space-y-1">
                        <li>Todos os seus widgets</li>
                        <li>Histórico de conversas</li>
                        <li>Configurações e preferências</li>
                        <li>Dados de cobrança</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Sim, deletar minha conta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Card className="card-clean border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Save className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Salvar Alterações</p>
                  <p className="text-sm text-muted-foreground">
                    Suas configurações serão aplicadas imediatamente
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => loadUserData()}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="lg"
                  className="min-w-[180px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

