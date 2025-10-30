import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Set last_activity to far past to immediately show as offline
    const { error } = await supabase
      .from('rooms')
      .update({ 
        last_activity: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      })
      .eq('id', roomId);

    if (error) {
      console.error('Offline update error:', error);
      return NextResponse.json(
        { error: 'Failed to update status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Offline error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

