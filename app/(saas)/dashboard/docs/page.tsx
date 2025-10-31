import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Zap, Palette, Shield, Code, Rocket } from 'lucide-react';

export default async function DocsPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <DashboardLayout
      email={user.email || ''}
      title="Documentação"
      description="Guias e tutoriais para usar o ChatWidget"
    >
      <div className="space-y-6">
        {/* Getting Started */}
        <Card className="card-clean">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Começando</CardTitle>
                <CardDescription>Primeiros passos com o ChatWidget</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                1. Criar um Widget
                <Badge variant="outline" className="text-xs">Básico</Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Vá para Widgets → Novo Widget e configure as informações básicas como nome e cor.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                2. Instalar no seu Site
                <Badge variant="outline" className="text-xs">Básico</Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Copie o código de instalação nas configurações do widget e cole antes do <code className="bg-muted px-1.5 py-0.5 rounded text-xs">&lt;/body&gt;</code>
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                3. Começar a Responder
                <Badge variant="outline" className="text-xs">Básico</Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Acesse a Inbox para ver e responder mensagens em tempo real.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Feature Guides */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Installation */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Code className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Instalação</CardTitle>
                  <CardDescription>Como adicionar o widget</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Código Básico</h4>
                  <pre className="bg-slate-950 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`<!-- ChatWidget -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  window.ChatWidgetConfig = {
    publicKey: 'SUA_PUBLIC_KEY_AQUI',
  };
</script>
<script src="https://jellox.vercel.app/widget.js"></script>`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customization */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Palette className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Personalização</CardTitle>
                  <CardDescription>Customize o visual</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong>Cor Principal:</strong> Altere nas configurações do widget</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong>Posição:</strong> Escolha entre inferior direito ou esquerdo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span><strong>Mensagem:</strong> Personalize a mensagem de boas-vindas</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Proteja seu widget</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Configure domínios permitidos para aumentar a segurança:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  Restrinja por domínio
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  Previna uso não autorizado
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                  Gerencie múltiplos sites
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}


