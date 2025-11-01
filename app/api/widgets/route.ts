import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/widgets - Get all widgets for authenticated user
export async function GET(request: NextRequest) {
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

    // Load widgets for the user
    const { data: widgets, error } = await supabase
      .from('widgets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading widgets:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ widgets: widgets || [] });
  } catch (error: any) {
    console.error('Error in widgets API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/widgets - Create new widget
export async function POST(request: NextRequest) {
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

    // CRITICAL: Check user entitlements to verify they can create widgets
    const { getUserEntitlements } = await import('@/lib/stripe/entitlements');
    const entitlements = await getUserEntitlements(user.id);

    console.log('[Widgets API] User entitlements:', {
      userId: user.id,
      plan: entitlements.plan,
      isPro: entitlements.isPro,
      isFree: entitlements.isFree,
    });

    // Get current widget count
    const { data: existingWidgets, error: widgetsError } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id);

    if (widgetsError) {
      console.error('[Widgets API] Error fetching widgets:', widgetsError);
      return NextResponse.json(
        { error: 'Erro ao verificar widgets existentes' },
        { status: 500 }
      );
    }

    const widgetCount = existingWidgets?.length || 0;

    console.log('[Widgets API] Widget count:', widgetCount);

    // Free plan: allow only 1 widget
    // Pro plan: unlimited widgets
    // IMPORTANT: This check MUST happen before creating the widget
    if (entitlements.isFree && widgetCount >= 1) {
      console.log('[Widgets API] BLOCKED: Free plan user trying to create widget beyond limit', {
        userId: user.id,
        widgetCount,
        isFree: entitlements.isFree,
      });
      
      return NextResponse.json(
        { 
          error: 'Limite de widgets atingido',
          message: 'O plano gratuito permite apenas 1 widget. Faça upgrade para criar mais widgets.',
          requiresUpgrade: true,
          widgetCount,
          plan: 'free'
        },
        { status: 403 }
      );
    }

    console.log('[Widgets API] ALLOWED: User can create widget', {
      userId: user.id,
      plan: entitlements.plan,
      widgetCount,
      willHaveAfter: widgetCount + 1,
    });

    // Parse request body
    const body = await request.json();
    const { name, brand_color, position, welcome_message } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Widget name is required' },
        { status: 400 }
      );
    }

    // DOUBLE CHECK: Re-verify widget count right before creating (race condition protection)
    const { data: doubleCheckWidgets } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id);
    
    const finalWidgetCount = doubleCheckWidgets?.length || 0;
    
    console.log('[Widgets API] Final check before creation:', {
      userId: user.id,
      plan: entitlements.plan,
      isFree: entitlements.isFree,
      currentCount: finalWidgetCount,
    });

    // Block if free plan and already has 1 widget
    if (entitlements.isFree && finalWidgetCount >= 1) {
      console.error('[Widgets API] BLOCKED AT FINAL CHECK: Free plan user has widget limit reached', {
        userId: user.id,
        widgetCount: finalWidgetCount,
      });
      
      return NextResponse.json(
        { 
          error: 'Limite de widgets atingido',
          message: 'O plano gratuito permite apenas 1 widget. Faça upgrade para criar mais widgets.',
          requiresUpgrade: true,
          widgetCount: finalWidgetCount,
          plan: 'free'
        },
        { status: 403 }
      );
    }

    // Create widget
    const { data: widget, error } = await supabase
      .from('widgets')
      .insert({
        user_id: user.id,
        name: name.trim(),
        brand_color: brand_color || '#10f500',
        position: position || 'bottom-right',
        welcome_message: welcome_message || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating widget:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ widget }, { status: 201 });
  } catch (error: any) {
    console.error('Error in widgets API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

