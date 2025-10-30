import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicKey: string }> }
) {
  const { publicKey } = await params;
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const results: any = {
      publicKey,
      env: {
        hasServiceKey: !!supabaseServiceKey,
        hasAnonKey: !!supabaseAnonKey,
        supabaseUrl,
      }
    };

    // Try with anon key
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('widgets')
      .select('*')
      .eq('public_key', publicKey)
      .eq('is_active', true)
      .single();
    
    results.withAnonKey = {
      data: anonData,
      error: anonError?.message,
      errorDetails: anonError,
    };

    // Try with service role if available
    if (supabaseServiceKey) {
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      
      // First, try to get all widgets to see what's there
      const { data: allWidgets, error: allError } = await supabaseService
        .from('widgets')
        .select('*');
      
      // Then try to get specific widget
      const { data: serviceData, error: serviceError } = await supabaseService
        .from('widgets')
        .select('*')
        .eq('public_key', publicKey)
        .maybeSingle();
      
      results.withServiceRole = {
        allWidgetsCount: allWidgets?.length || 0,
        allWidgetsSample: allWidgets?.slice(0, 2),
        data: serviceData,
        error: serviceError?.message,
      };
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

