import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { userProfileUpdateSchema, validateInput, sanitizeName, sanitizeHtml } from '@/lib/validation-schemas';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Parse and validate request body
    const body = await req.json();
    const validation = validateInput(userProfileUpdateSchema, body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid input data',
        details: validation.errors 
      }, { status: 400 });
    }
    
    const validatedData = validation.data!;
    
    // Get the current session
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
    
    const userId = session.user.id;
    
    // Sanitize inputs
    const updateData: any = {};
    
    if (validatedData.name) {
      updateData.name = sanitizeName(validatedData.name);
    }
    
    if (validatedData.location) {
      updateData.location = sanitizeHtml(validatedData.location);
    }
    
    if (validatedData.blood_type) {
      updateData.blood_type = validatedData.blood_type;
    }
    
    if (validatedData.allow_location !== undefined) {
      updateData.allow_location = validatedData.allow_location;
    }
    
    if (validatedData.receive_alerts !== undefined) {
      updateData.receive_alerts = validatedData.receive_alerts;
    }
    
    if (validatedData.available !== undefined) {
      updateData.available = validatedData.available;
    }
    
    if (validatedData.medical_conditions !== undefined) {
      updateData.medical_conditions = validatedData.medical_conditions 
        ? sanitizeHtml(validatedData.medical_conditions) 
        : null;
    }
    
    // Add audit fields
    updateData.updated_at = new Date().toISOString();
    updateData.last_active = new Date().toISOString();
    
    // Update the user in the users table
    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, name, phone, blood_type, location, allow_location, receive_alerts, available, points, role, verification_status, updated_at')
      .single();
    
    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update profile' 
      }, { status: 500 });
    }
    
    // Log the profile update for audit
    try {
      await supabase
        .from('audit_log')
        .insert([{
          user_id: userId,
          action: 'profile_update',
          table_name: 'users',
          record_id: userId,
          new_data: updateData,
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip,
          user_agent: req.headers.get('user-agent'),
          created_at: new Date().toISOString()
        }]);
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error('Audit logging error:', auditError);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: user,
      message: 'Profile updated successfully' 
    });
    
  } catch (error: any) {
    console.error('Profile update error:', error);
    
    // Don't expose internal errors to client
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 