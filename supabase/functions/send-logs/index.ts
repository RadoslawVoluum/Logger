import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { SmtpClient } from "npm:smtp@0.1.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, logs, totalDowntime, downtimeSummary } = await req.json();

    const client = new SmtpClient();

    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: Deno.env.get("SMTP_USERNAME"),
      password: Deno.env.get("SMTP_PASSWORD"),
    });

    const currentTime = new Date().toLocaleString();
    
    await client.send({
      from: Deno.env.get("SMTP_USERNAME")!,
      to: email,
      subject: `Internet Connection Monitoring Report - ${currentTime}`,
      content: `
Internet Connection Monitoring Report
Generated at: ${currentTime}

Total Downtime: ${totalDowntime}
${downtimeSummary}

Connection Logs:
${logs}
      `,
    });

    await client.close();

    return new Response(
      JSON.stringify({ message: 'Email sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});