'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useUser } from '@/lib/contexts/user-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  Globe,
  Moon,
  Sun,
  Upload,
  Camera
} from 'lucide-react';
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
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, loading: profileLoading, updateProfile, uploadAvatar } = useUser();
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setCompanyName(profile.company_name || '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updateProfile({
        full_name: fullName || null,
        company_name: companyName || null,
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setError(null);

    try {
      await uploadAvatar(file);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload do avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // Call delete account endpoint
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        credentials: 'include', // CRITICAL: Include cookies for auth
      });

      if (!response.ok) throw new Error('Failed to delete account');

      await supabase.auth.signOut();
      router.push('/');
    } catch (err) {
      setError('Erro ao excluir conta. Por favor, entre em contato com o suporte.');
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return email.substring(0, 2).toUpperCase();
  };

  if (profileLoading) {
    return (
      <DashboardLayout email={user?.email || ''}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout email={user?.email || ''}>
      <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6">
        <div className="w-full mx-auto space-y-6 sm:space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Configurações</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Gerencie suas configurações de conta e preferências
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive break-words">
                  {error}
                </p>
              </div>
            </div>
          )}

          {saved && (
            <div className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">
                  Configurações salvas com sucesso!
                </p>
              </div>
            </div>
          )}

          {/* Profile Section */}
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <User className="h-5 w-5 text-primary flex-shrink-0" />
                <CardTitle className="text-base sm:text-lg">Perfil</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Atualize suas informações pessoais e avatar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <div className="relative group">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt={fullName || user?.email || ''} />
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl sm:text-2xl">
                        {getInitials(fullName, user?.email || '')}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-semibold text-base sm:text-lg">{fullName || user?.email?.split('@')[0]}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground break-all">{user?.email}</p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    size="sm"
                    className="mt-3 sm:mt-4"
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Alterar Avatar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="h-9 sm:h-10"
                />
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm">Nome da Empresa</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Digite o nome da sua empresa"
                  className="h-9 sm:h-10"
                />
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="pl-10 h-9 sm:h-10 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  O email não pode ser alterado. Entre em contato com o suporte se necessário.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Bell className="h-5 w-5 text-primary flex-shrink-0" />
                <CardTitle className="text-base sm:text-lg">Notificações</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Gerencie como você recebe notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="emailNotifications" className="text-sm font-medium cursor-pointer">
                    Notificações por Email
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Receba notificações por email
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  className="flex-shrink-0"
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="pushNotifications" className="text-sm font-medium cursor-pointer">
                    Notificações Push
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Receba notificações push no navegador
                  </p>
                </div>
                <Switch
                  id="pushNotifications"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                  className="flex-shrink-0"
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="weeklyReports" className="text-sm font-medium cursor-pointer">
                    Relatórios Semanais
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Receba relatórios resumidos semanais
                  </p>
                </div>
                <Switch
                  id="weeklyReports"
                  checked={weeklyReports}
                  onCheckedChange={setWeeklyReports}
                  className="flex-shrink-0"
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Palette className="h-5 w-5 text-primary flex-shrink-0" />
                <CardTitle className="text-base sm:text-lg">Aparência</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Personalize a aparência do aplicativo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium">Tema</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Alterne entre modo claro e escuro
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Sun className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Moon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Idioma e Região */}
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                <CardTitle className="text-base sm:text-lg">Idioma e Região</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Configure seu idioma e fuso horário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm">Idioma</Label>
                <select
                  id="language"
                  className="w-full h-9 sm:h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Zona de Perigo */}
          <Card className="border-destructive/50">
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Shield className="h-5 w-5 text-destructive flex-shrink-0" />
                <CardTitle className="text-base sm:text-lg text-destructive">Zona de Perigo</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Ações irreversíveis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium">Excluir Conta</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Exclua permanentemente sua conta e todos os dados
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full sm:w-auto flex-shrink-0">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso excluirá permanentemente sua
                        conta e removerá todos os seus dados de nossos servidores.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir Conta
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto sm:flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFullName(profile?.full_name || '');
                    setCompanyName(profile?.company_name || '');
                  }}
                  disabled={saving}
                  className="w-full sm:w-auto sm:flex-none"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
