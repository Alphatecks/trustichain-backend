"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = exports.supabase = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv = require("dotenv");
dotenv.config();
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
}
// Client for user-facing operations (uses anon key)
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
// Admin client for server-side operations (uses service role key)
exports.supabaseAdmin = supabaseServiceRoleKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;
