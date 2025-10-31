import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpCircle, Mail, MessageSquare, FileText, ExternalLink } from 'lucide-react';

export default async function SupportPage() {
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
      title="Help & Support"
      description="Obtenha ajuda e suporte para o ChatWidget"
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Documentation */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Documentação</CardTitle>
                  <CardDescription>Guias e tutoriais</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Acesse nossa documentação completa para aprender a usar o ChatWidget
              </p>
              <Button variant="outline" className="w-full" asChild>
                <a href="/dashboard/docs">
                  Acessar Docs
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Email Support */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Mail className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Email</CardTitle>
                  <CardDescription>Envie-nos um email</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Entre em contato conosco por email para suporte personalizado
              </p>
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:support@jellox.com">
                  Enviar Email
                  <Mail className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Live Chat */}
          <Card className="card-clean">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Chat ao Vivo</CardTitle>
                  <CardDescription>Fale conosco agora</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Chat em tempo real com nossa equipe de suporte
              </p>
              <Button variant="outline" className="w-full" disabled>
                Em Breve
                <MessageSquare className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card className="card-clean">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <HelpCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>Perguntas Frequentes</CardTitle>
                <CardDescription>Respostas para dúvidas comuns</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Como instalo o widget no meu site?</h4>
              <p className="text-sm text-muted-foreground">
                Acesse a página de configurações do seu widget e copie o código de instalação. Cole-o antes do fechamento da tag &lt;/body&gt; no seu site.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Posso personalizar as cores do widget?</h4>
              <p className="text-sm text-muted-foreground">
                Sim! Acesse as configurações do widget e personalize a cor principal, posição e mensagem de boas-vindas.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Como faço para responder mensagens?</h4>
              <p className="text-sm text-muted-foreground">
                Acesse a página Inbox no menu lateral para ver todas as conversas e responder em tempo real.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


