import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  country: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      fullName: string;
      country: string;
    };
  };
  error?: string;
}

// Validation function
function validateRegister(data: RegisterRequest): { valid: boolean; error?: string } {
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { valid: false, error: 'Invalid email address' };
  }

  if (!data.fullName || data.fullName.length < 2 || data.fullName.length > 100) {
    return { valid: false, error: 'Full name must be between 2 and 100 characters' };
  }

  if (!/^[a-zA-Z\s'-]+$/.test(data.fullName)) {
    return { valid: false, error: 'Full name can only contain letters, spaces, hyphens, and apostrophes' };
  }

  if (!data.password || data.password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  const hasUpperCase = /[A-Z]/.test(data.password);
  const hasLowerCase = /[a-z]/.test(data.password);
  const hasNumber = /[0-9]/.test(data.password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(data.password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    return {
      valid: false,
      error:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    };
  }

  if (data.password !== data.confirmPassword) {
    return { valid: false, error: "Passwords don't match" };
  }

  if (!data.country || data.country.length < 2 || data.country.length > 100) {
    return { valid: false, error: 'Country must be between 2 and 100 characters' };
  }

  return { valid: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Parse request body
    const registerData: RegisterRequest = await req.json();

    // Validate input
    const validation = validateRegister(registerData);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: validation.error,
          error: 'Validation failed',
        } as RegisterResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { email, password, fullName, country } = registerData;

    // Check if user already exists
    const { data: existingUser } = await supabase.from('users').select('id, email').eq('email', email.toLowerCase()).single();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'User with this email already exists',
          error: 'Email already registered',
        } as RegisterResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
      options: {
        data: {
          full_name: fullName,
          country: country,
        },
      },
    });

    if (authError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: authError.message || 'Failed to create user account',
          error: 'Authentication error',
        } as RegisterResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to create user account',
          error: 'No user data returned',
        } as RegisterResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create user profile in database
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email.toLowerCase(),
        full_name: fullName,
        country: country,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: profileError.message || 'Failed to create user profile',
          error: 'Database error',
        } as RegisterResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            country: profileData.country,
          },
        },
      } as RegisterResponse),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      } as RegisterResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});


