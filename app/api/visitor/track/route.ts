import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  // Try various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback - try to get from connection or return unknown
  return 'unknown';
}

// Helper function to get user agent
function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Track visitor with fingerprinting data
 * POST /api/visitor/track
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { visitor_id, fingerprint_data, page_url, page_title } = body;

    if (!visitor_id) {
      return NextResponse.json(
        { error: 'visitor_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const ip_address = getClientIP(request);
    const user_agent = getUserAgent(request);

    // Check if visitor exists (get all fields for update)
    const { data: existingVisitor, error: fetchError } = await supabase
      .from('visitors')
      .select('*')
      .eq('visitor_id', visitor_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[Visitor Track API] Error checking visitor:', fetchError);
      // Continue even if error, don't block the request
    }

    // If visitor is banned, return error
    if (existingVisitor?.banned) {
      return NextResponse.json(
        {
          error: 'Visitor is banned',
          banned: true,
          reason: existingVisitor.ban_reason || 'No reason provided',
        },
        { status: 403 }
      );
    }

    // Upsert visitor record
    if (existingVisitor) {
      // Update existing visitor
      const { data: updatedVisitor, error: updateError } = await supabase
        .from('visitors')
        .update({
          ip_address,
          user_agent,
          fingerprint_data: fingerprint_data || (existingVisitor as any).fingerprint_data,
          last_page_url: page_url || null,
          last_page_title: page_title || null,
          last_seen_at: new Date().toISOString(),
        })
        .eq('visitor_id', visitor_id)
        .select()
        .single();

      if (updateError) {
        console.error('[Visitor Track API] Error updating visitor:', updateError);
        return NextResponse.json(
          { error: 'Failed to update visitor' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        visitor: updatedVisitor,
        banned: false,
      });
    } else {
      // Create new visitor
      const { data: newVisitor, error: createError } = await supabase
        .from('visitors')
        .insert({
          visitor_id,
          ip_address,
          user_agent,
          fingerprint_data: fingerprint_data || null,
          last_page_url: page_url || null,
          last_page_title: page_title || null,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          total_sessions: 1,
        })
        .select()
        .single();

      if (createError) {
        console.error('[Visitor Track API] Error creating visitor:', createError);
        return NextResponse.json(
          { error: 'Failed to create visitor' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        visitor: newVisitor,
        banned: false,
      });
    }
  } catch (error: any) {
    console.error('[Visitor Track API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check if visitor is banned
 * GET /api/visitor/track?visitor_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const visitor_id = searchParams.get('visitor_id');

    if (!visitor_id) {
      return NextResponse.json(
        { error: 'visitor_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: visitor, error } = await supabase
      .from('visitors')
      .select('banned, ban_reason')
      .eq('visitor_id', visitor_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Visitor Track API] Error checking visitor:', error);
      return NextResponse.json(
        { error: 'Failed to check visitor' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      banned: visitor?.banned || false,
      reason: visitor?.ban_reason || null,
      exists: !!visitor,
    });
  } catch (error: any) {
    console.error('[Visitor Track API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

