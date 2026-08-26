// ============================================
// BudMed News — Supabase Edge Function
// POST { action: "send_code" | "validate_code" | "resend_code", email, code }
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
    const { action, email, code } = body;
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    // ─── SEND CODE ───
    if (action === "send_code") {
      if (!email || !email.includes("@")) {
        return new Response(JSON.stringify({ error: "Invalid email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit check
      const { count } = await supabase
        .from("premium_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .eq("attempt_type", "send_code")
        .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if ((count || 0) >= 5) {
        return new Response(JSON.stringify({ error: "Too many attempts. Try again in 1 hour." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate code
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let gen = "";
      for (let i = 0; i < 8; i++) gen += chars[Math.floor(Math.random() * chars.length)];
      const finalCode = gen.slice(0, 4) + "-" + gen.slice(4);

      // Invalidate old unused codes for this email
      await supabase
        .from("premium_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("email", email)
        .is("used_at", null);

      // Store new code
      const { error: insertErr } = await supabase.from("premium_codes").insert({
        email,
        code: finalCode,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        verified: true,
      });

      if (insertErr) {
        console.error("Insert error:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to generate code" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record attempt
      await supabase.from("premium_attempts").insert({
        email, ip_address: ip, attempt_type: "send_code", success: true,
      });

      // Send email via Resend
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "BudMed News <noreply@budmedsolution.com>",
              to: email,
              subject: "Your BudMed Premium Access Code",
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
                  <h1 style="font-size:24px;color:#1a1410;text-align:center;">BudMed News <span style="color:#c9a050;">Premium</span></h1>
                  <p style="font-size:16px;color:#333;line-height:1.6;">Your access code:</p>
                  <div style="background:#f5f0e8;border:2px dashed #c9a050;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                    <span style="font-size:32px;font-weight:700;color:#1a1410;letter-spacing:4px;font-family:monospace;">${finalCode}</span>
                  </div>
                  <p style="font-size:14px;color:#666;line-height:1.6;">This code is valid for <strong>24 hours</strong>. Enter it on the BudMed News website to unlock premium articles.</p>
                  <p style="font-size:12px;color:#999;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">If you didn't request this code, you can safely ignore this email.</p>
                </div>`,
            }),
          });
        } catch (e) { console.error("Email send failed:", e); }
      }

      return new Response(JSON.stringify({ success: true, message: "Code sent to " + email }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── VALIDATE CODE ───
    if (action === "validate_code") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Code required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedCode = code.trim().toUpperCase();

      // Find valid code
      const { data: codeRow, error: findErr } = await supabase
        .from("premium_codes")
        .select("*")
        .eq("code", normalizedCode)
        .is("used_at", null)
        .eq("verified", true)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .single();

      if (findErr || !codeRow) {
        // Record failed attempt
        await supabase.from("premium_attempts").insert({
          email: email || "unknown", ip_address: ip, attempt_type: "verify_code", success: false,
        });
        return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as used
      await supabase
        .from("premium_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", codeRow.id);

      // Record success
      await supabase.from("premium_attempts").insert({
        email: codeRow.email, ip_address: ip, attempt_type: "verify_code", success: true,
      });

      return new Response(JSON.stringify({
        success: true, email: codeRow.email, message: "Access granted",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── RESEND CODE ───
    if (action === "resend_code") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cooldown: 60s
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
          return new Response(JSON.stringify({ error: `Wait ${wait}s before resending` }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Reuse send_code logic
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let gen = "";
      for (let i = 0; i < 8; i++) gen += chars[Math.floor(Math.random() * chars.length)];
      const finalCode = gen.slice(0, 4) + "-" + gen.slice(4);

      await supabase.from("premium_codes").update({ used_at: new Date().toISOString() })
        .eq("email", email).is("used_at", null);

      await supabase.from("premium_codes").insert({
        email, code: finalCode,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        verified: true,
      });

      await supabase.from("premium_attempts").insert({
        email, ip_address: ip, attempt_type: "send_code", success: true,
      });

      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "BudMed News <noreply@budmedsolution.com>",
              to: email,
              subject: "Your BudMed Premium Access Code",
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
                  <h1 style="font-size:24px;color:#1a1410;text-align:center;">BudMed News <span style="color:#c9a050;">Premium</span></h1>
                  <p style="font-size:16px;color:#333;">Your access code:</p>
                  <div style="background:#f5f0e8;border:2px dashed #c9a050;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                    <span style="font-size:32px;font-weight:700;color:#1a1410;letter-spacing:4px;font-family:monospace;">${finalCode}</span>
                  </div>
                  <p style="font-size:14px;color:#666;">Valid for 24 hours.</p>
                </div>`,
            }),
          });
        } catch (e) { console.error("Email resend failed:", e); }
      }

      return new Response(JSON.stringify({ success: true, message: "New code sent to " + email }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
