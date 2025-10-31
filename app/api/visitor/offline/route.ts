import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to create CORS headers
function getCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  try {
    let roomId: string | null = null;

    // Try to get roomId from JSON body
    try {
      const body = await request.json();
      roomId = body.roomId;
    } catch {
      // If JSON parsing fails, try FormData (sendBeacon might send as FormData)
      try {
        const formData = await request.formData();
        roomId = formData.get('roomId') as string;
      } catch {
        // If both fail, try URLSearchParams
        const text = await request.text();
        const params = new URLSearchParams(text);
        roomId = params.get('roomId');
      }
    }

    console.log('[Offline API] Received roomId:', roomId);

    if (!roomId) {
      console.error('[Offline API] No roomId provided');
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = await createClient();

    // Set last_activity to far past to immediately show as offline
    const offlineTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    console.log('[Offline API] Setting offline for room:', roomId, 'at:', offlineTime);

    const { error } = await supabase
      .from('rooms')
      .update({ 
        last_activity: offlineTime
      })
      .eq('id', roomId);

    if (error) {
      console.error('[Offline API] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('[Offline API] Successfully marked offline');
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Offline API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

