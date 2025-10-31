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
      return NextResponse.json({ contacts: [] });
    }

    // Load contacts (rooms with emails) from all user's widgets
    const { data: contacts, error: contactsError } = await supabase
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
    const uniqueContacts = contacts?.reduce((acc: any[], contact) => {
      const existing = acc.find(c => c.visitor_email === contact.visitor_email);
      if (!existing) {
        acc.push(contact);
      }
      return acc;
    }, []) || [];

    return NextResponse.json({ contacts: uniqueContacts });
  } catch (error: any) {
    console.error('Error in user contacts API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

