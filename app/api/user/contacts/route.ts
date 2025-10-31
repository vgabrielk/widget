import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/user/contacts - Get all contacts (visitors with emails) from user's widgets
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First, get user's widget IDs
    const { data: widgets, error: widgetsError } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id);

    if (widgetsError) {
      console.error('Error loading widgets:', widgetsError);
      return NextResponse.json(
        { error: widgetsError.message },
        { status: 500 }
      );
    }

    const widgetIds = widgets?.map(w => w.id) || [];

    if (widgetIds.length === 0) {
      return NextResponse.json({ contacts: [], count: 0 });
    }

    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url);
    const from = parseInt(searchParams.get('from') || '0', 10);
    const to = parseInt(searchParams.get('to') || '19', 10);

    // Load all contacts first to get unique ones, then paginate
    const { data: allContacts, error: contactsError } = await supabase
      .from('rooms')
      .select('visitor_name, visitor_email, created_at, widget_id')
      .in('widget_id', widgetIds)
      .not('visitor_email', 'is', null)
      .order('created_at', { ascending: false });

    if (contactsError) {
      console.error('Error loading contacts:', contactsError);
      return NextResponse.json(
        { error: contactsError.message },
        { status: 500 }
      );
    }

    // Remove duplicates by email (keep most recent)
    const uniqueContacts = allContacts?.reduce((acc: any[], contact) => {
      const existing = acc.find(c => c.visitor_email === contact.visitor_email);
      if (!existing) {
        acc.push({
          ...contact,
          id: contact.visitor_email, // Use email as ID for unique contacts
        });
      }
      return acc;
    }, []) || [];

    // Sort by most recent first
    uniqueContacts.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Paginate the unique contacts
    const paginatedContacts = uniqueContacts.slice(from, to + 1);
    const count = uniqueContacts.length;

    return NextResponse.json({ 
      contacts: paginatedContacts,
      count 
    });
  } catch (error: any) {
    console.error('Error in user contacts API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

