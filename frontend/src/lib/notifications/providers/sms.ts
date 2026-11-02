/**
 * SMS Provider Connector for Medrella HMS
 * Supports Twilio and High-Fidelity Simulation
 */

export interface SmsOptions {
  to: string;
  message: string;
  from?: string;
}

export interface SmsResult {
  success: boolean;
  provider: 'TWILIO' | 'SIMULATED';
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  name: 'TWILIO' | 'SIMULATED';
  send(options: SmsOptions): Promise<SmsResult>;
}

export class TwilioSmsProvider implements SmsProvider {
  name = 'TWILIO' as const;
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async send(options: SmsOptions): Promise<SmsResult> {
    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const body = new URLSearchParams();
      body.append('To', options.to);
      body.append('From', options.from || this.fromNumber);
      body.append('Body', options.message);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          provider: 'TWILIO',
          error: errData.message || `Twilio HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        provider: 'TWILIO',
        messageId: data.sid,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'TWILIO',
        error: err.message || 'Network error reaching Twilio API',
      };
    }
  }
}

export class SimulatedSmsProvider implements SmsProvider {
  name = 'SIMULATED' as const;

  async send(options: SmsOptions): Promise<SmsResult> {
    // Generate realistic Twilio-style SID
    const messageId = `SM${Date.now().toString(16)}${Math.random().toString(36).substring(2, 10)}`;

    console.log(`[SIMULATED SMS DISPATCH]`);
    console.log(`  SID: ${messageId}`);
    console.log(`  To: ${options.to}`);
    console.log(`  Message (${options.message.length} chars): ${options.message}`);

    return {
      success: true,
      provider: 'SIMULATED',
      messageId,
    };
  }
}

/**
 * Returns the active configured SMS provider with fallback to simulation
 */
export function getSmsProvider(): SmsProvider {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (
    accountSid &&
    authToken &&
    fromNumber &&
    !accountSid.includes('placeholder') &&
    !authToken.includes('placeholder')
  ) {
    return new TwilioSmsProvider(accountSid, authToken, fromNumber);
  }

  return new SimulatedSmsProvider();
}
