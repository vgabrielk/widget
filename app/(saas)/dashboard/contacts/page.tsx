'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Mail, MessageSquare, Calendar } from 'lucide-react';
import { useUser } from '@/lib/contexts/user-context';
import { useInfiniteQueryApi } from '@/lib/hooks/use-infinite-query-api';
import { Skeleton } from '@/components/ui/skeleton';

interface Contact {
  id: string;
  visitor_name: string | null;
  visitor_email: string;
  created_at: string;
  widget_id: string;
}

export default function ContactsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Use infinite query for contacts
  const {
    data: contacts,
    isLoading,
    isFetching,
    hasMore,
    fetchNextPage,
    count,
  } = useInfiniteQueryApi<Contact>({
    apiEndpoint: '/api/user/contacts',
    pageSize: 10,
    queryKey: 'contacts',
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isFetching || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetching) {
          fetchNextPage();
        }
      },
      {
        rootMargin: '100px',
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isFetching, isLoading, fetchNextPage]);

  // Group contacts by email to count conversations
  const contactsWithCount = contacts.reduce((acc: Map<string, { contact: Contact; count: number }>, contact) => {
    const existing = acc.get(contact.visitor_email);
    if (existing) {
      existing.count++;
    } else {
      acc.set(contact.visitor_email, { contact, count: 1 });
    }
    return acc;
  }, new Map());

  const uniqueContacts = Array.from(contactsWithCount.values()).map(item => ({
    ...item.contact,
    conversationsCount: item.count,
  }));

  // Calculate total conversations count (total contacts loaded)
  const totalConversations = contacts.length;
  
  // Total unique contacts from the API count
  // Since the API returns unique contacts, count represents the total unique contacts
  const totalUniqueContacts = count || uniqueContacts.length;

  if (userLoading) {
    return (
      <DashboardLayout email="" title="Contatos" description="Carregando...">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      email={user?.email || ''}
      title="Contatos"
      description="Visitantes que já conversaram com você"
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Contatos</p>
                  <p className="text-3xl font-bold">{totalUniqueContacts}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversas</p>
                  <p className="text-3xl font-bold">{totalConversations}</p>
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
                  <p className="text-sm text-muted-foreground">Média por Contato</p>
                  <p className="text-3xl font-bold">
                    {totalUniqueContacts > 0 ? Math.round(totalConversations / totalUniqueContacts) : 0}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contacts List */}
        <Card className="card-clean">
          <CardHeader>
            <CardTitle className="text-2xl">Lista de Contatos</CardTitle>
            <CardDescription>
              Todos os visitantes que forneceram email
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : uniqueContacts.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Nenhum contato ainda
                </h3>
                <p className="text-muted-foreground">
                  Quando visitantes fornecerem seus emails, eles aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {uniqueContacts.map((contact: any, index: number) => (
                  <div
                    key={contact.visitor_email}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:border-primary/50 transition-all"
                  >
                    <Avatar className="h-12 w-12 border-2 border-primary">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {contact.visitor_name 
                          ? contact.visitor_name.substring(0, 2).toUpperCase()
                          : contact.visitor_email.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">
                          {contact.visitor_name || 'Visitante'}
                        </p>
                        <Badge variant="outline">
                          {contact.conversationsCount} {contact.conversationsCount === 1 ? 'conversa' : 'conversas'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <p className="truncate">{contact.visitor_email}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <p>
                          Primeiro contato: {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Load more trigger */}
                <div ref={loadMoreRef} style={{ height: '1px' }} />
                
                {/* Loading skeleton */}
                {isFetching && (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                )}
                
                {/* End message */}
                {!hasMore && uniqueContacts.length > 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Você chegou ao fim da lista
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
