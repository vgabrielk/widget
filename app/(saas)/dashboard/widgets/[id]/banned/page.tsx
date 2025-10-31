'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Widget } from '@/lib/types/saas';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Ban, 
  RotateCcw,
  Loader2,
  AlertTriangle,
  Globe,
  Calendar,
  MessageSquare,
  UserX,
  ChevronLeft,
  Search,
  Trash2
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
  room_count: number;
  message_count: number;
  fingerprint_data: any;
  last_page_url: string | null;
  last_page_title: string | null;
}

export default function BannedVisitorsPage() {
  const params = useParams();
  const router = useRouter();
  const widgetId = params.id as string;
  
  const [widget, setWidget] = useState<Widget | null>(null);
  const [visitors, setVisitors] = useState<BannedVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<BannedVisitor | null>(null);
  const [unbanDialogOpen, setUnbanDialogOpen] = useState(false);
  
  const supabase = useMemo(() => createClient(), []);
  const { error: showError, success: showSuccess, ToastContainer } = useToast();

  const loadWidget = useCallback(async () => {
    if (!widgetId) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/widgets/${widgetId}`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard');
          return;
        }
        throw new Error(`Failed to load widget: ${res.statusText}`);
      }

      const data = await res.json();
      setWidget(data);
    } catch (error) {
      console.error('Error loading widget:', error);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [widgetId, router]);

  const loadBannedVisitors = useCallback(async () => {
    if (!widgetId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/widgets/${widgetId}/visitors/banned`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Failed to load banned visitors: ${res.statusText}`);
      }

      const data = await res.json();
      setVisitors(data.visitors || []);
    } catch (error) {
      console.error('Error loading banned visitors:', error);
      showError('Erro ao carregar visitantes banidos');
    } finally {
      setLoading(false);
    }
  }, [widgetId, showError]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    loadUser();
    loadWidget();
    // CRITICAL: supabase is stable via useMemo, loadWidget depends on widgetId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId]);

  useEffect(() => {
    loadBannedVisitors();
  }, [loadBannedVisitors]);

  const handleUnban = useCallback(async (visitor: BannedVisitor) => {
    try {
      const res = await fetch(`/api/widgets/${widgetId}/visitors/${visitor.visitor_id}/ban`, {
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
        const error = await res.json();
        throw new Error(error.error || 'Failed to unban visitor');
      }

      showSuccess('Visitante desbanido com sucesso');
      setUnbanDialogOpen(false);
      setSelectedVisitor(null);
      loadBannedVisitors();
    } catch (error: any) {
      console.error('Error unbanning visitor:', error);
      showError(error.message || 'Erro ao desbanir visitante');
    }
  }, [widgetId, loadBannedVisitors, showError, showSuccess]);


  const filteredVisitors = useMemo(() => {
    if (!searchTerm.trim()) return visitors;
    
    const term = searchTerm.toLowerCase();
    return visitors.filter(v => 
      v.visitor_id.toLowerCase().includes(term) ||
      v.ip_address?.toLowerCase().includes(term) ||
      v.ban_reason?.toLowerCase().includes(term) ||
      v.user_agent?.toLowerCase().includes(term)
    );
  }, [visitors, searchTerm]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Desconhecido';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Outro';
  };

  if (isLoading) {
    return (
      <DashboardLayout email={userEmail} title="Visitantes Banidos">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!widget) {
    return null;
  }

  return (
    <DashboardLayout
      email={userEmail}
      title="Visitantes Banidos"
      description={widget.name}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/widgets/${widgetId}/settings`)}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Visitantes Banidos</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie visitantes banidos deste widget
              </p>
            </div>
          </div>
          <Badge variant="destructive" className="text-sm">
            <Shield className="h-3 w-3 mr-1" />
            {visitors.length} {visitors.length === 1 ? 'banido' : 'banidos'}
          </Badge>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, IP, motivo ou user agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        ) : filteredVisitors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <UserX className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'Nenhum visitante encontrado' : 'Nenhum visitante banido'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVisitors.map((visitor) => (
              <Card key={visitor.id} className="border-destructive/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-mono text-sm">
                          {visitor.visitor_id.substring(0, 16)}...
                        </CardTitle>
                        <Badge variant="destructive" className="text-xs">
                          <Ban className="h-3 w-3 mr-1" />
                          Banido
                        </Badge>
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
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Desbanir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Informações</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-xs">{visitor.ip_address || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Navegador:</span>
                          <span>{getBrowserInfo(visitor.user_agent)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Atividade</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          <span>{visitor.room_count} conversas</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{visitor.message_count} mensagens</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{visitor.total_sessions} sessões</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Datas</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs">
                            Banido: {formatDate(visitor.banned_at)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Primeira vez: {formatDate(visitor.first_seen_at)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Última vez: {formatDate(visitor.last_seen_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  {visitor.last_page_url && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Última página visitada</p>
                      <a
                        href={visitor.last_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {visitor.last_page_title || visitor.last_page_url}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
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
              {selectedVisitor && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm">
                    <strong>ID:</strong> <code className="font-mono text-xs bg-muted px-1 rounded">{selectedVisitor.visitor_id}</code>
                  </p>
                  {selectedVisitor.ban_reason && (
                    <p className="text-sm">
                      <strong>Motivo do banimento:</strong> {selectedVisitor.ban_reason}
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedVisitor && handleUnban(selectedVisitor)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Desbanir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ToastContainer}
    </DashboardLayout>
  );
}

