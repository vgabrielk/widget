import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Widget } from '@/lib/types/saas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  MessageSquare, 
  Plus, 
  Settings, 
  Inbox,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';

export default async function WidgetsPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's widgets
  const { data: widgets } = await supabase
    .from('widgets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <DashboardLayout
      email={user.email || ''}
      title="Meus Widgets"
      description="Gerencie todos os seus widgets de chat em um só lugar"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              {widgets?.length || 0} {widgets?.length === 1 ? 'widget criado' : 'widgets criados'}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/dashboard/widgets/new">
              <Plus className="mr-2 h-5 w-5" />
              Novo Widget
            </Link>
          </Button>
        </div>

        {/* Widgets Grid */}
        {!widgets || widgets.length === 0 ? (
          <Card className="card-clean">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  Nenhum widget criado
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Crie seu primeiro widget para começar a conversar com seus visitantes em tempo real
                </p>
                <Button asChild size="lg">
                  <Link href="/dashboard/widgets/new">
                    <Plus className="mr-2 h-5 w-5" />
                    Criar Meu Primeiro Widget
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 lg:gap-8 auto-rows-fr items-stretch">
            {widgets.map((widget: Widget) => (
              <Card
                key={widget.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-6 text-card-foreground shadow-[0_15px_35px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_25px_55px_rgba(79,70,229,0.18)] dark:border-border/40 dark:bg-card/70 dark:text-card-foreground"
              >
                <div className="pointer-events-none absolute inset-0 opacity-70">
                  <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
                  <div className="absolute -bottom-14 -left-10 h-28 w-28 rounded-full bg-muted/40 blur-3xl dark:bg-muted/20" />
                </div>

                <div className="relative flex h-full flex-col space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-white shadow-inner"
                        style={{ backgroundColor: widget.brand_color, borderColor: widget.brand_color }}
                      >
                        <MessageSquare className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Widget</p>
                        <CardTitle className="text-xl font-semibold leading-tight">
                          {widget.name}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {widget.company_name || 'Sem nome da empresa'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={widget.is_active ? 'outline' : 'secondary'}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        widget.is_active
                          ? 'border-green-200 bg-green-50 text-green-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-200'
                      }`}
                    >
                      {widget.is_active ? (
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          Inativo
                        </span>
                      )}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 text-center dark:border-primary/30 dark:bg-primary/15">
                      <p className="text-3xl font-semibold">{widget.total_conversations || 0}</p>
                      <p className="text-xs font-medium text-primary/80 dark:text-primary/60">Conversas</p>
                      <p className="text-[11px] text-muted-foreground">Total acumulado</p>
                    </div>
                    <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4 text-center dark:border-purple-500/30 dark:bg-purple-500/15">
                      <p className="text-3xl font-semibold text-purple-700 dark:text-purple-200">{widget.total_messages || 0}</p>
                      <p className="text-xs font-medium text-purple-700/80 dark:text-purple-200/80">Mensagens</p>
                      <p className="text-[11px] text-muted-foreground">Fluxo recente</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-background/70 p-4 dark:border-border/40 dark:bg-background/40">
                    <div className="flex items-center justify-between text-sm">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Posição</p>
                        <p className="font-medium">
                          {widget.position === 'bottom-right' ? 'Inferior Direito' : 'Inferior Esquerdo'}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cor</p>
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className="h-5 w-5 rounded-full border"
                            style={{ backgroundColor: widget.brand_color }}
                          />
                          <span className="font-mono text-xs text-muted-foreground">{widget.brand_color}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto grid gap-2 sm:grid-cols-2">
                    <Button variant="default" asChild className="h-12 rounded-2xl">
                      <Link href={`/dashboard/widgets/${widget.id}/inbox`}>
                        <Inbox className="mr-2 h-4 w-4" />
                        Inbox
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="h-12 rounded-2xl">
                      <Link href={`/dashboard/widgets/${widget.id}/settings`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Config
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild className="h-12 rounded-2xl sm:col-span-2">
                      <Link href={`/dashboard/widgets/${widget.id}/settings`}>
                        Ver Detalhes
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Tips */}
        {widgets && widgets.length > 0 && (
          <Card className="card-clean bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                💡 Dica Rápida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Você pode criar múltiplos widgets para diferentes sites ou páginas. 
                Cada widget tem suas próprias configurações e conversas separadas.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

