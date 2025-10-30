import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp'
];

// Magic bytes for image validation
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a or GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
};

/**
 * Validate file by checking magic bytes (file signature)
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return true; // If no signature defined, skip check
  
  // Check if buffer starts with any of the valid signatures
  return signatures.some(signature => {
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }
    return true;
  });
}

// Helper function to create CORS headers
function getCorsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
  // Add CORS headers
  const origin = request.headers.get('origin') || '*';
  
  try {
    // Rate limiting: 10 uploads per minute per IP
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const rateLimitResult = checkRateLimit(ip, {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
    });

    if (!rateLimitResult.allowed) {
      const waitTime = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: 'Too many uploads', 
          message: `Rate limit exceeded. Wait ${waitTime} seconds.`,
          retryAfter: waitTime 
        },
        { 
          status: 429,
          headers: {
            ...getCorsHeaders(origin),
            ...getRateLimitHeaders(rateLimitResult, { maxRequests: 10, windowMs: 60000 }),
            'Retry-After': waitTime.toString(),
          }
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const roomId = formData.get('roomId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { error: 'No room ID provided' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          error: 'Invalid file type', 
          allowedTypes: ALLOWED_TYPES,
          receivedType: file.type 
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: 'File too large', 
          maxSize: MAX_FILE_SIZE,
          receivedSize: file.size 
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Verify room exists and is open
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
                            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, status, widget_id, widgets:widget_id(domains)')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    if (room.status !== 'open') {
      return NextResponse.json(
        { error: 'Cannot upload to closed conversation' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // CSRF Protection: Verify origin matches widget's allowed domains
    if (origin && origin !== '*') {
      const widget = room.widgets as any;
      const allowedDomains = widget?.domains || [];
      
      if (allowedDomains.length > 0) {
        try {
          const originUrl = new URL(origin);
          const originHost = originUrl.hostname;
          
          const isAllowed = allowedDomains.some((domain: string) => {
            const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return originHost === cleanDomain || originHost.endsWith('.' + cleanDomain);
          });
          
          if (!isAllowed) {
            console.warn('CSRF: Origin not in allowed domains', { origin, allowedDomains });
            return NextResponse.json(
              { error: 'Origin not allowed' },
              { status: 403, headers: getCorsHeaders(origin) }
            );
          }
        } catch (err) {
          console.error('CSRF: Invalid origin URL', origin);
          return NextResponse.json(
            { error: 'Invalid origin' },
            { status: 400, headers: getCorsHeaders(origin) }
          );
        }
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}-${randomString}.${fileExt}`;
    const filePath = `chat/${fileName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate magic bytes (actual file content)
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { 
          error: 'Invalid file content', 
          message: 'File content does not match declared type. Possible malicious file.',
          receivedType: file.type 
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image', details: uploadError.message },
        { status: 500, headers: getCorsHeaders(origin) }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      imageName: file.name,
      filePath: filePath
    }, {
      headers: getCorsHeaders(origin)
    });

  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: getCorsHeaders(origin)
      }
    );
  }
}

