'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Ban, 
  RotateCcw,
  Loader2,
  AlertTriangle,
  Globe,
  Calendar,
  MessageSquare,
  Search,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUser } from '@/lib/contexts/user-context';
import { useInfiniteQueryApi } from '@/lib/hooks/use-infinite-query-api';
import Link from 'next/link';

interface BannedVisitor {
  id: string;
  visitor_id: string;
  ip_address: string | null;
  user_agent: string | null;
  banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  first_seen_at: string;
  last_seen_at: string;
  total_sessions: number;
  widget_name?: string;
  widget_id?: string;
}

export default function AllBannedVisitorsPage() {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<BannedVisitor | null>(null);
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  const [unbanning, setUnbanning] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const { error: showError, success: showSuccess, ToastContainer } = useToast();

  // Use infinite query hook - only initialize when user is available
  const userId = user?.id || null;
  const {
    data: visitors,
    isLoading,
    isFetching,
    hasMore,
    fetchNextPage,
    count: totalCount,
    reset,
  } = useInfiniteQueryApi<BannedVisitor>({
    apiEndpoint: userId ? '/api/banned-visitors' : '', // Disable if no user
    pageSize: 20,
    queryKey: userId ? `banned-visitors-${userId}` : 'disabled',
  });

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isFetching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isFetching, fetchNextPage]);

  const handleUnban = useCallback(async () => {
    if (!selectedVisitor || !selectedVisitor.widget_id) return;

    setUnbanning(true);
    try {
      const res = await fetch(`/api/widgets/${selectedVisitor.widget_id}/visitors/${selectedVisitor.visitor_id}/ban`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          banned: false,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to unban visitor');
      }

      showSuccess('Visitante desbanido com sucesso');
      setUnbanDialogOpen(false);
      setSelectedVisitor(null);
      await reset(); // Reload data after unban
    } catch (error: any) {
      console.error('Error unbanning visitor:', error);
      showError(error.message || 'Erro ao desbanir visitante. Tente novamente.');
    } finally {
      setUnbanning(false);
    }
  }, [selectedVisitor, reset, showError, showSuccess]);

  const filteredVisitors = useMemo(() => {
    if (!searchTerm.trim()) return visitors;

    const term = searchTerm.toLowerCase();
    return visitors.filter(visitor => 
      visitor.visitor_id.toLowerCase().includes(term) ||
      visitor.ip_address?.toLowerCase().includes(term) ||
      visitor.user_agent?.toLowerCase().includes(term) ||
      visitor.ban_reason?.toLowerCase().includes(term) ||
      visitor.widget_name?.toLowerCase().includes(term)
    );
  }, [visitors, searchTerm]);

  const userEmail = useMemo(() => user?.email || '', [user?.email]);
  
  // Memoize visitor count to avoid unnecessary re-renders
  const visitorCount = useMemo(() => filteredVisitors.length, [filteredVisitors.length]);

  return (
    <DashboardLayout
      email={userEmail}
      title="Visitantes Banidos"
      description="Gerencie visitantes banidos de todos os seus widgets"
    >
      <div className="space-y-6">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por ID, IP, motivo, widget..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="secondary" className="text-sm">
            {visitorCount} {visitorCount === 1 ? 'visitante banido' : 'visitantes banidos'}
          </Badge>
        </div>

        {/* Loading */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : filteredVisitors.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'Nenhum visitante banido encontrado com esse filtro' : 'Nenhum visitante banido'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVisitors.map((visitor) => (
              <Card key={`${visitor.widget_id}-${visitor.visitor_id}`} className="border-destructive/20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-mono text-sm">
                          {visitor.visitor_id.substring(0, 24)}...
                        </CardTitle>
                        <Badge variant="destructive" className="text-xs">
                          <Ban className="h-3 w-3 mr-1" />
                          Banido
                        </Badge>
                        {visitor.widget_name && visitor.widget_id && (
                          <Link href={`/dashboard/widgets/${visitor.widget_id}/banned`} className="inline-flex">
                            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                              {visitor.widget_name}
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Badge>
                          </Link>
                        )}
                      </div>
                      {visitor.ban_reason && (
                        <CardDescription className="text-xs">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          {visitor.ban_reason}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVisitor(visitor);
                        setUnbanDialogOpen(true);
                      }}
                      disabled={unbanning}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Desbanir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    {visitor.ip_address && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">IP</p>
                          <p className="font-mono text-xs">{visitor.ip_address}</p>
                        </div>
                      </div>
                    )}
                    
                    {visitor.banned_at && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Banido em</p>
                          <p className="text-xs">
                            {new Date(visitor.banned_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sessões</p>
                        <p className="text-xs">{visitor.total_sessions}</p>
                      </div>
                    </div>

                    {visitor.user_agent && (
                      <div className="md:col-span-2 lg:col-span-3">
                        <p className="text-xs text-muted-foreground mb-1">User Agent</p>
                        <p className="text-xs font-mono break-all">{visitor.user_agent.substring(0, 100)}...</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Load more trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex items-center justify-center py-8">
                {isFetching ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetching}
                  >
                    Carregar mais
                  </Button>
                )}
              </div>
            )}

            {/* Loading indicator at bottom */}
            {isFetching && visitors.length > 0 && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unban Dialog */}
      <AlertDialog open={unbanDialogOpen} onOpenChange={setUnbanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbanir Visitante</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desbanir este visitante? Ele poderá usar o widget novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedVisitor && (
            <div className="mt-4 space-y-2">
              <div className="text-sm">
                <strong>ID:</strong> <code className="font-mono text-xs bg-muted px-1 rounded">{selectedVisitor.visitor_id}</code>
              </div>
              {selectedVisitor.ban_reason && (
                <div className="text-sm">
                  <strong>Motivo do banimento:</strong> {selectedVisitor.ban_reason}
                </div>
              )}
              {selectedVisitor.widget_name && (
                <div className="text-sm">
                  <strong>Widget:</strong> {selectedVisitor.widget_name}
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unbanning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnban}
              disabled={unbanning}
              className="bg-green-600 hover:bg-green-700"
            >
              {unbanning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desbanindo...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Desbanir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ToastContainer}
    </DashboardLayout>
  );
}

