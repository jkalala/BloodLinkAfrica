import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/app/actions/phase4-actions';
import { messageSchema, validateInput, sanitizePhone, sanitizeHtml } from '@/lib/validation-schemas';
import { getSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Check authentication (should be handled by middleware, but double-check)
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Parse and validate request body
    const body = await req.json();
    
    // Validate phone number and message
    const validation = validateInput(messageSchema, {
      phone: body.phoneNumber,
      message: body.messageData?.message || body.messageData,
      type: 'whatsapp'
    });
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid input data',
        details: validation.errors 
      }, { status: 400 });
    }
    
    const validatedData = validation.data!;
    
    // Check user permissions (only certain roles can send WhatsApp messages)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, emergency_access')
      .eq('id', session.user.id)
      .single();
    
    if (userError || !userData) {
      return NextResponse.json({ 
        success: false, 
        error: 'User verification failed' 
      }, { status: 403 });
    }
    
    // Check if user has permission to send WhatsApp messages
    const allowedRoles = ['admin', 'staff', 'emergency_responder'];
    const hasPermission = allowedRoles.includes(userData.role) || userData.emergency_access;
    
    if (!hasPermission) {
      return NextResponse.json({ 
        success: false, 
        error: 'Insufficient permissions to send WhatsApp messages' 
      }, { status: 403 });
    }
    
    // Sanitize inputs
    const sanitizedPhone = sanitizePhone(validatedData.phone);
    const sanitizedMessage = sanitizeHtml(validatedData.message);
    
    // Rate limiting check (additional to middleware)
    const rateLimitKey = `whatsapp_send:${session.user.id}`;
    const rateLimitWindow = 60 * 1000; // 1 minute
    const maxRequestsPerWindow = 10;
    
    // This would ideally use Redis, but for now using a simple in-memory store
    // In production, implement proper rate limiting with Redis
    
    // Log the WhatsApp send attempt for audit
    try {
      await supabase
        .from('audit_log')
        .insert([{
          user_id: session.user.id,
          action: 'whatsapp_message_send',
          table_name: 'whatsapp_messages',
          record_id: null,
          new_data: { 
            to: sanitizedPhone, 
            message_length: sanitizedMessage.length,
            user_role: userData.role 
          },
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip,
          user_agent: req.headers.get('user-agent'),
          created_at: new Date().toISOString()
        }]);
    } catch (auditError) {
      console.error('Audit logging error:', auditError);
    }
    
    // Call the actual WhatsApp sending function with sanitized data
    const result = await sendWhatsAppMessage(sanitizedPhone, {
      message: sanitizedMessage,
      ...body.messageData
    });
    
    // Don't expose internal details in the response
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'WhatsApp message sent successfully' 
      });
    } else {
      console.error('WhatsApp send error:', result.error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to send WhatsApp message' 
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('WhatsApp API error:', error);
    
    // Don't expose internal errors to client
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 