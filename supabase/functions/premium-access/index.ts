// ============================================
// BudMed News — Supabase Edge Function
// POST /premium/send-code
// POST /premium/verify-email
// POST /premium/validate-code
// POST /premium/resend-code
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    const { action, email, code, token } = body;
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    // ─── SEND CODE (after email verification) ───
    if (action === "send_code") {
      if (!email || !email.includes("@")) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: 5 codes per hour
      const { data: rateOk } = await supabase.rpc("check_rate_limit", {
        p_email: email,
        p_type: "send_code",
        p_max_attempts: 5,
        p_window_minutes: 60,
      });

      if (rateOk === false) {
        await supabase.rpc("record_attempt", {
          p_email: email,
          p_type: "send_code",
          p_ip: ip,
          p_success: false,
        });
        return new Response(
          JSON.stringify({ error: "Too many attempts. Try again in 1 hour." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate 4-char code
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
      code = code.slice(0, 4) + "-" + code.slice(4, 8) || code + "-" + "XXXX";

      // Actually generate 8-char code
      let genCode = "";
      for (let i = 0; i < 8; i++) genCode += chars[Math.floor(Math.random() * chars.length)];
      const finalCode = genCode.slice(0, 4) + "-" + genCode.slice(4);

      // Store code (expires in 24h)
      const { error: insertErr } = await supabase.from("premium_codes").insert({
        email,
        code: finalCode,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        verified: true,
      });

      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to generate code" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record attempt
      await supabase.rpc("record_attempt", {
        p_email: email,
        p_type: "send_code",
        p_ip: ip,
        p_success: true,
      });

      // Send email via Resend (if configured)
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "BudMed News <noreply@budmedsolution.com>",
              to: email,
              subject: "Your BudMed Premium Access Code",
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                  <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="font-size: 24px; color: #1a1410; margin: 0;">BudMed News <span style="color: #c9a050;">Premium</span></h1>
                  </div>
                  <p style="font-size: 16px; color: #333; line-height: 1.6;">Your access code:</p>
                  <div style="background: #f5f0e8; border: 2px dashed #c9a050; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: 700; color: #1a1410; letter-spacing: 4px; font-family: monospace;">${finalCode}</span>
                  </div>
                  <p style="font-size: 14px; color: #666; line-height: 1.6;">This code is valid for <strong>24 hours</strong>. Enter it on the BudMed News website to unlock premium articles.</p>
                  <p style="font-size: 12px; color: #999; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">If you didn't request this code, you can safely ignore this email.</p>
                </div>
              `,
            }),
          });
        } catch (e) {
          console.error("Email send failed:", e);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Code sent to " + email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── VALIDATE CODE ───
    if (action === "validate_code") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Code required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit: 5 attempts per hour
      const { data: rateOk } = await supabase.rpc("check_rate_limit", {
        p_email: email || "unknown",
        p_type: "verify_code",
        p_max_attempts: 5,
        p_window_minutes: 60,
      });

      if (rateOk === false) {
        return new Response(
          JSON.stringify({ error: "Too many attempts. Try again in 1 hour." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate
      const { data: result } = await supabase.rpc("validate_premium_code", {
        p_code: code,
      });

      if (result && result[0] && result[0].valid) {
        await supabase.rpc("record_attempt", {
          p_email: result[0].email,
          p_type: "verify_code",
          p_ip: ip,
          p_success: true,
        });

        return new Response(
          JSON.stringify({
            success: true,
            email: result[0].email,
            message: "Access granted",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.rpc("record_attempt", {
        p_email: email || "unknown",
        p_type: "verify_code",
        p_ip: ip,
        p_success: false,
      });

      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── RESEND CODE ───
    if (action === "resend_code") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check cooldown: last code sent > 60s ago
      const { data: lastCode } = await supabase
        .from("premium_codes")
        .select("created_at")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastCode) {
        const elapsed = Date.now() - new Date(lastCode.created_at).getTime();
        if (elapsed < 60000) {
          const wait = Math.ceil((60000 - elapsed) / 1000);
          return new Response(
            JSON.stringify({ error: `Wait ${wait}s before resending` }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Invalidate old codes
      await supabase
        .from("premium_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("email", email)
        .is("used_at", null);

      // Reuse send_code logic
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let genCode = "";
      for (let i = 0; i < 8; i++) genCode += chars[Math.floor(Math.random() * chars.length)];
      const finalCode = genCode.slice(0, 4) + "-" + genCode.slice(4);

      await supabase.from("premium_codes").insert({
        email,
        code: finalCode,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        verified: true,
      });

      await supabase.rpc("record_attempt", {
        p_email: email,
        p_type: "send_code",
        p_ip: ip,
        p_success: true,
      });

      // Send email
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "BudMed News <noreply@budmedsolution.com>",
              to: email,
              subject: "Your BudMed Premium Access Code (resent)",
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                  <h1 style="font-size: 24px; color: #1a1410; text-align: center;">BudMed News <span style="color: #c9a050;">Premium</span></h1>
                  <p style="font-size: 16px; color: #333;">Your new access code:</p>
                  <div style="background: #f5f0e8; border: 2px dashed #c9a050; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 32px; font-weight: 700; color: #1a1410; letter-spacing: 4px; font-family: monospace;">${finalCode}</span>
                  </div>
                  <p style="font-size: 14px; color: #666;">Valid for 24 hours.</p>
                </div>
              `,
            }),
          });
        } catch (e) {
          console.error("Email resend failed:", e);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "New code sent to " + email }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
