import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Mail, MessageSquare, Calendar } from 'lucide-react';

export default async function ContactsPage() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get all unique visitors from all user's widgets
  const { data: widgets } = await supabase
    .from('widgets')
    .select('id')
    .eq('user_id', user.id);

  const widgetIds = widgets?.map(w => w.id) || [];

  const { data: rooms } = await supabase
    .from('rooms')
    .select('visitor_name, visitor_email, created_at, widget_id')
    .in('widget_id', widgetIds)
    .not('visitor_email', 'is', null)
    .order('created_at', { ascending: false });

  // Group by email to get unique contacts
  const contactsMap = new Map();
  rooms?.forEach((room: any) => {
    if (room.visitor_email && !contactsMap.has(room.visitor_email)) {
      contactsMap.set(room.visitor_email, {
        email: room.visitor_email,
        name: room.visitor_name,
        firstContact: room.created_at,
        conversationsCount: 1,
      });
    } else if (room.visitor_email) {
      const contact = contactsMap.get(room.visitor_email);
      contact.conversationsCount++;
    }
  });

  const contacts = Array.from(contactsMap.values());

  return (
    <DashboardLayout
      email={user.email || ''}
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
                  <p className="text-3xl font-bold">{contacts.length}</p>
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
                  <p className="text-3xl font-bold">{rooms?.length || 0}</p>
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
                    {contacts.length > 0 ? Math.round((rooms?.length || 0) / contacts.length) : 0}
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
            {contacts.length === 0 ? (
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
                {contacts.map((contact: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:border-primary/50 transition-all"
                  >
                    <Avatar className="h-12 w-12 border-2 border-primary">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {contact.name 
                          ? contact.name.substring(0, 2).toUpperCase()
                          : contact.email.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">
                          {contact.name || 'Visitante'}
                        </p>
                        <Badge variant="outline">
                          {contact.conversationsCount} {contact.conversationsCount === 1 ? 'conversa' : 'conversas'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <p className="truncate">{contact.email}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <p>
                          Primeiro contato: {new Date(contact.firstContact).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

