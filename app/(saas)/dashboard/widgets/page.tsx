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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgets.map((widget: Widget) => (
              <Card key={widget.id} className="card-clean hover:border-primary/50 transition-all group">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-12 h-12 rounded-xl border-2 flex items-center justify-center flex-shrink-0"
                        style={{ 
                          backgroundColor: widget.brand_color,
                          borderColor: widget.brand_color
                        }}
                      >
                        <MessageSquare className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                          {widget.name}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {widget.company_name || 'Sem nome da empresa'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge 
                      variant={widget.is_active ? 'default' : 'secondary'}
                      className="flex-shrink-0"
                    >
                      {widget.is_active ? (
                        <>
                          <Eye className="w-3 h-3 mr-1" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3 mr-1" />
                          Inativo
                        </>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 py-4 border-t border-b">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{widget.total_conversations || 0}</p>
                      <p className="text-xs text-muted-foreground">Conversas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{widget.total_messages || 0}</p>
                      <p className="text-xs text-muted-foreground">Mensagens</p>
                    </div>
                  </div>

                  {/* Widget Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Posição:</span>
                      <span className="font-medium">
                        {widget.position === 'bottom-right' ? 'Inferior Direito' : 'Inferior Esquerdo'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cor:</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: widget.brand_color }}
                        />
                        <span className="font-mono text-xs">{widget.brand_color}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="default" asChild className="w-full">
                      <Link href={`/dashboard/widgets/${widget.id}/inbox`}>
                        <Inbox className="mr-2 h-4 w-4" />
                        Inbox
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link href={`/dashboard/widgets/${widget.id}/settings`}>
                        <Settings className="mr-2 h-4 w-4" />
                        Config
                      </Link>
                    </Button>
                  </div>

                  {/* View Details Link */}
                  <Button variant="ghost" asChild className="w-full">
                    <Link href={`/dashboard/widgets/${widget.id}/settings`}>
                      Ver Detalhes
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </CardContent>
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

