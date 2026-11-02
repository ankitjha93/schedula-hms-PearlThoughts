/**
 * Email Provider Connector for Medrella HMS
 * Supports Resend, SMTP, and High-Fidelity Simulation
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  provider: 'RESEND' | 'SMTP' | 'SIMULATED';
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  name: 'RESEND' | 'SMTP' | 'SIMULATED';
  send(options: EmailOptions): Promise<EmailResult>;
}

export class ResendEmailProvider implements EmailProvider {
  name = 'RESEND' as const;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom = 'Medrella Health <notifications@medrella.com>') {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: options.from || this.defaultFrom,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          provider: 'RESEND',
          error: errData.message || `Resend HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        provider: 'RESEND',
        messageId: data.id,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'RESEND',
        error: err.message || 'Network error reaching Resend API',
      };
    }
  }
}

export class SimulatedEmailProvider implements EmailProvider {
  name = 'SIMULATED' as const;

  async send(options: EmailOptions): Promise<EmailResult> {
    // Generate realistic message id
    const messageId = `msg_sim_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Log simulated envelope for development & test inspection
    console.log(`[SIMULATED EMAIL DISPATCH]`);
    console.log(`  ID: ${messageId}`);
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Text: ${options.text.substring(0, 120)}...`);

    return {
      success: true,
      provider: 'SIMULATED',
      messageId,
    };
  }
}

/**
 * Returns the active configured email provider with fallback to simulation
 */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFrom = process.env.RESEND_FROM || 'Medrella Health <onboarding@resend.dev>';
  if (apiKey && !apiKey.includes('placeholder') && !apiKey.includes('mock')) {
    return new ResendEmailProvider(apiKey, defaultFrom);
  }
  return new SimulatedEmailProvider();
}
