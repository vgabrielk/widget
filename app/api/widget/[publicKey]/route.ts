import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Helper to build CORS headers based on allowed domains
function getCorsHeaders(origin: string, allowedDomains: string[] = []): Record<string, string> | null {
  // Extract hostname from origin
  let requestDomain = '';
  try {
    requestDomain = origin ? new URL(origin).hostname : '';
  } catch {
    // Invalid origin - if no domain restrictions, allow wildcard
    if (allowedDomains.length === 0) {
      return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
      };
    }
    return null;
  }

  // Allow localhost for development
  const isLocalhost = requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1');
  
  // If no domain restrictions, allow any domain
  if (allowedDomains.length === 0) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
  }

  // Check if origin is allowed
  const isAllowed = isLocalhost || allowedDomains.some((allowedDomain: string) => {
    // Remove protocol and trailing slash
    const domain = allowedDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    // Check if matches exactly or is a subdomain
    return requestDomain === domain || requestDomain.endsWith('.' + domain);
  });

  if (!isAllowed) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  
  // For OPTIONS, we need to be permissive but we'll validate on GET
  // This allows the browser to make the preflight request
  const headers = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
  
  return NextResponse.json({}, { headers });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicKey: string }> }
) {
  const { publicKey } = await context.params;
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  
  try {
    // Use service role for server-side access (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                           process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                           process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!;
    
    // Use service role if available, otherwise anon (for widget query)
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    // Get widget config - fetch all and filter manually (RLS workaround)
    const { data: widgets, error } = await supabase
      .from('widgets')
      .select('id, name, brand_color, position, welcome_message, company_name, domains, is_active, public_key, user_id')
      .eq('is_active', true);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Widget not found or inactive', details: error.message },
        { status: 404 }
      );
    }

    // Find widget by public_key (manual filter)
    const widget = widgets?.find(w => w.public_key === publicKey);

    if (!widget) {
      return NextResponse.json(
        { 
          error: 'Widget not found or inactive', 
          publicKey,
          widgetsFound: widgets?.length || 0,
        },
        { status: 404 }
      );
    }

    // Get user profile avatar if user_id exists
    let avatarUrl = null;
    if (widget.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', widget.user_id)
        .single();
      
      if (profile?.avatar_url) {
        // Convert avatar path to public URL
        // avatar_url is stored as: user-id/avatar-xxx.ext
        // Need to create public URL: {supabaseUrl}/storage/v1/object/public/avatars/{path}
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          avatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_url}`;
        } catch (err) {
          console.warn('Error generating avatar URL:', err);
        }
      }
    }

    // Build CORS headers based on widget's allowed domains
    // Se não tiver domínios configurados (null, undefined ou array vazio), permite todos
    const allowedDomains = widget.domains && Array.isArray(widget.domains) && widget.domains.length > 0 
      ? widget.domains 
      : [];
    
    const corsHeaders = getCorsHeaders(origin, allowedDomains);

    if (!corsHeaders) {
      let requestDomain = 'unknown';
      try {
        if (origin) {
          requestDomain = new URL(origin).hostname;
        }
      } catch {
        requestDomain = origin || 'unknown';
      }
      
      return NextResponse.json(
        { 
          error: 'Domain not allowed', 
          requestDomain, 
          allowedDomains: widget.domains || [] 
        },
        { status: 403 }
      );
    }

    // Return widget config with Supabase credentials
    return NextResponse.json({
      widget: {
        ...widget,
        avatar_url: avatarUrl,
      },
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
             process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
             process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
      }
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error loading widget:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

