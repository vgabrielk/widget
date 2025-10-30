'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Widget } from '@/lib/types/saas';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Copy, 
  Check, 
  Settings, 
  Code, 
  Palette, 
  Shield, 
  BarChart3,
  Loader2,
  Trash2,
  Plus,
  MessageSquare,
  Mail
} from 'lucide-react';

export default function WidgetSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const widgetId = params.id as string;
  
  const [widget, setWidget] = useState<Widget | null>(null);
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#6366f1');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const supabase = createClient();

  const loadWidget = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('widgets')
        .select('*')
        .eq('id', widgetId)
        .single();

      if (error) throw error;
      if (!data) {
        router.push('/dashboard');
        return;
      }

      setWidget(data);
      setName(data.name);
      setBrandColor(data.brand_color);
      setPosition(data.position);
      setWelcomeMessage(data.welcome_message);
      setCompanyName(data.company_name || '');
      setIsActive(data.is_active);
      setDomains(data.domains || []);
    } catch (error) {
      console.error('Error loading widget:', error);
      router.push('/dashboard');
    }
  }, [widgetId, supabase, router]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    loadUser();
    loadWidget();
  }, [widgetId, supabase, loadWidget]);

  const addDomain = useCallback(() => {
    if (newDomain.trim() && !domains.includes(newDomain.trim())) {
      setDomains([...domains, newDomain.trim()]);
      setNewDomain('');
    }
  }, [newDomain, domains]);

  const removeDomain = useCallback((domain: string) => {
    setDomains(domains.filter(d => d !== domain));
  }, [domains]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setSaved(false);

    try {
      const { error } = await supabase
        .from('widgets')
        .update({
          name,
          brand_color: brandColor,
          position,
          welcome_message: welcomeMessage,
          company_name: companyName || null,
          is_active: isActive,
          domains: domains.length > 0 ? domains : null,
        })
        .eq('id', widgetId);

      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving widget:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  }, [widgetId, supabase, name, brandColor, position, welcomeMessage, companyName, isActive, domains]);

  const copyEmbedCode = useCallback(() => {
    if (!widget) return;
    const embedCode = `<!-- ChatWidget -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  window.ChatWidgetConfig = {
    publicKey: '${widget.public_key}',
  };
</script>
<script src="${window.location.origin}/widget.js"></script>`;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [widget]);

  const embedCode = widget ? `<!-- ChatWidget -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  window.ChatWidgetConfig = {
    publicKey: '${widget.public_key}',
  };
</script>
<script src="${window.location.origin}/widget.js"></script>` : '';

  if (!widget) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout
      email={userEmail}
      title="Configurações do Widget"
      description={widget.name}
    >
      <div className="space-y-6">
        {/* Status e Estatísticas */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-2">
                    <Badge variant={isActive ? 'default' : 'secondary'} className="text-sm">
                      {isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Conversas</p>
                  <p className="text-3xl font-bold">{widget.total_conversations || 0}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Mensagens</p>
                  <p className="text-3xl font-bold">{widget.total_messages || 0}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                  <Mail className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Código de Instalação */}
        <Card className="card-clean">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Code className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Código de Instalação</CardTitle>
                <CardDescription>
                  Cole este código antes do fechamento da tag <code className="bg-muted px-1.5 py-0.5 rounded text-xs">&lt;/body&gt;</code> no seu site
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="bg-slate-950 text-green-400 p-4 rounded-lg overflow-x-auto text-sm border">
                <code>{embedCode}</code>
              </pre>
              <Button
                size="sm"
                variant="secondary"
                onClick={copyEmbedCode}
                className="absolute top-3 right-3"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </>
                )}
              </Button>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                    Public Key:
                  </h4>
                  <code className="text-sm text-blue-800 dark:text-blue-400 break-all">
                    {widget.public_key}
                  </code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Configurações Gerais */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Configurações Gerais</CardTitle>
                  <CardDescription>Informações básicas do widget</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="active">Widget Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Ative ou desative o widget no seu site
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome do Widget</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Meu Widget de Chat"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Nome da Empresa</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Minha Empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcome">Mensagem de Boas-vindas</Label>
                <Textarea
                  id="welcome"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="Olá! Como posso ajudar?"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Aparência */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Palette className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Aparência</CardTitle>
                  <CardDescription>Personalize o visual do widget</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="color">Cor Principal</Label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-20 cursor-pointer rounded-lg border"
                  />
                  <Input
                    id="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    placeholder="#6366f1"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta cor será usada no botão e no cabeçalho do chat
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Posição na Tela</Label>
                <select
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as 'bottom-right' | 'bottom-left')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="bottom-right">Inferior Direito</option>
                  <option value="bottom-left">Inferior Esquerdo</option>
                </select>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-lg p-4 bg-muted/30 h-32 relative">
                  <div 
                    className="absolute bottom-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: brandColor,
                      [position === 'bottom-right' ? 'right' : 'left']: '16px'
                    }}
                  >
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Segurança - Domínios */}
        <Card className="card-clean">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Shield className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Segurança - Domínios Permitidos</CardTitle>
                <CardDescription>
                  Adicione os domínios onde o widget pode ser usado. Deixe vazio para permitir todos os domínios.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                placeholder="exemplo.com ou https://meusite.com"
                className="flex-1"
              />
              <Button onClick={addDomain} variant="secondary">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {domains.length > 0 ? (
              <div className="space-y-2">
                {domains.map((domain, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg border"
                  >
                    <span className="text-sm font-mono">{domain}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDomain(domain)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Sem restrição de domínios - o widget pode ser usado em qualquer site
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botão Salvar */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={loading}
            size="lg"
            className="min-w-[200px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : saved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvo!
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

