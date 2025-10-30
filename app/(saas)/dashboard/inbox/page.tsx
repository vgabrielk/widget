'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, MessageSquare, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Room } from '@/lib/types/saas';
import { useInfiniteQuery } from '@/lib/hooks/use-infinite-query';

type RoomWithWidget = Room & {
  widgets: {
    name: string;
    brand_color: string;
  };
};

export default function InboxPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [widgetIds, setWidgetIds] = useState<string[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Load user and widget IDs
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      setUser(user);

      // Get user's widgets
      const { data: widgets } = await supabase
        .from('widgets')
        .select('id')
        .eq('user_id', user.id);

      setWidgetIds(widgets?.map(w => w.id) || []);
      setIsLoadingUser(false);
    };

    loadUser();
  }, [router]);

  // Use infinite query for rooms
  const { 
    data: rooms, 
    isLoading, 
    isFetching, 
    hasMore, 
    fetchNextPage,
    count 
  } = useInfiniteQuery<RoomWithWidget, 'rooms'>({
    tableName: 'rooms',
    columns: '*, widgets!inner(name, brand_color)',
    pageSize: 20,
    trailingQuery: (query) => {
      let q = query;
      if (widgetIds.length > 0) {
        // SEGURANÇA: Só busca rooms dos widgets do usuário
        q = q.in('widget_id', widgetIds);
      } else {
        // CRÍTICO: Se não tem widgetIds ainda, retornar vazio (filtro impossível)
        // Isso previne carregar TODAS as rooms de TODOS os usuários
        q = q.eq('widget_id', '00000000-0000-0000-0000-000000000000');
      }
      return q
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    }
  });

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver>();
  const lastRoomRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isFetching) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchNextPage();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [isLoading, isFetching, hasMore, fetchNextPage]);

  const openRooms = rooms?.filter(r => r.status === 'open') || [];
  const closedRooms = rooms?.filter(r => r.status === 'closed') || [];
  const totalUnread = rooms?.reduce((sum, r) => sum + (r.unread_count || 0), 0) || 0;

  // Skeleton components
  const RoomCardSkeleton = () => (
    <div className="flex items-start gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg border">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-muted animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-32" />
            <div className="h-3 bg-muted rounded animate-pulse w-48" />
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <div className="h-5 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-3 bg-muted rounded animate-pulse w-full" />
        <div className="h-3 bg-muted rounded animate-pulse w-24" />
      </div>
    </div>
  );

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout
      email={user.email || ''}
      title="Inbox Global"
      description="Todas as conversas de todos os seus widgets"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card">
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl sm:text-3xl font-bold">{rooms?.length || 0}</p>
                </div>
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Abertas</p>
                  <p className="text-2xl sm:text-3xl font-bold">{openRooms.length}</p>
                </div>
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-green-500/10">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Fechadas</p>
                  <p className="text-2xl sm:text-3xl font-bold">{closedRooms.length}</p>
                </div>
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gray-500/10">
                  <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-4 sm:pt-6 p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Não Lidas</p>
                  <p className="text-2xl sm:text-3xl font-bold">{totalUnread}</p>
                </div>
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-red-500/10">
                  <Inbox className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conversations List */}
        <Card className="card-clean">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-xl sm:text-2xl">Conversas Recentes</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Acesse as conversas de qualquer widget
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {isLoading ? (
              <div className="space-y-2 sm:space-y-3">
                {[...Array(5)].map((_, i) => (
                  <RoomCardSkeleton key={i} />
                ))}
              </div>
            ) : !rooms || rooms.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <div className="flex justify-center mb-4">
                  <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10">
                    <Inbox className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  Nenhuma conversa ainda
                </h3>
                <p className="text-sm text-muted-foreground mb-4 px-4">
                  Quando visitantes iniciarem conversas, elas aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3">
                {rooms.map((room: any, index: number) => (
                  <Link
                    key={room.id}
                    href={`/dashboard/widgets/${room.widget_id}/inbox`}
                    className="block"
                  >
                    <div 
                      ref={index === rooms.length - 1 ? lastRoomRef : null}
                      className="flex items-start gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: room.widgets.brand_color }}
                      >
                        <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                              <p className="font-semibold text-sm sm:text-base truncate">
                                {room.visitor_name || 'Visitante'}
                              </p>
                              <Badge variant="outline" className="text-xs w-fit">
                                {room.widgets.name}
                              </Badge>
                            </div>
                            {room.visitor_email && (
                              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                {room.visitor_email}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
                            {room.unread_count > 0 && (
                              <Badge variant="destructive" className="rounded-full text-xs h-5 min-w-[20px]">
                                {room.unread_count}
                              </Badge>
                            )}
                            <Badge variant={room.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                              {room.status === 'open' ? 'Aberta' : 'Fechada'}
                            </Badge>
                          </div>
                        </div>

                        {room.last_message_preview && (
                          <p className="text-xs sm:text-sm text-muted-foreground truncate mb-1 sm:mb-2">
                            {room.last_message_preview}
                          </p>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {room.last_message_at
                            ? new Date(room.last_message_at).toLocaleString('pt-BR', { 
                                dateStyle: 'short', 
                                timeStyle: 'short' 
                              })
                            : new Date(room.created_at).toLocaleString('pt-BR', { 
                                dateStyle: 'short', 
                                timeStyle: 'short' 
                              })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {isFetching && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

