/**
 * XUMM (Xaman) API Service
 * Handles XUMM API interactions for wallet signing
 */

interface XUMMCreatePayloadResponse {
  uuid: string;
  next: {
    always: string;
  };
  refs: {
    qr_png: string;
    qr_uri: string;
    qr_websocket: string;
    websocket: string;
  };
}

interface XUMMPayloadStatusResponse {
  meta: {
    exists: boolean;
    uuid: string;
    multisign: boolean;
    submit: boolean;
    destination: string;
    resolved_destination: string;
    resolved: boolean;
    signed: boolean;
    cancelled: boolean;
    expired: boolean;
    pushed: boolean;
    app_opened: boolean;
    return_url_app: string | null;
    return_url_web: string | null;
  };
  application: {
    name: string;
    description: string;
    disabled: number;
    uuidv4: string;
    icon_url: string;
    issued_user_token: string | null;
  };
  payload: {
    tx_type: string;
    tx_destination: string;
    tx_destination_tag: number | null;
    request_json: any;
    created_at: string;
    expires_at: string;
    expires_in_seconds: number;
  };
  response: {
    hex: string | null;
    txid: string | null;
    resolved: boolean;
    dispatched_to: string | null;
    dispatched_result: string | null;
    multisign_account: string | null;
    account: string | null;
  } | null;
}

export class XUMMService {
  private readonly API_KEY: string;
  private readonly API_SECRET: string;
  private readonly BASE_URL = 'https://xumm.app/api/v1';

  constructor() {
    this.API_KEY = process.env.XUMM_API_KEY || '';
    this.API_SECRET = process.env.XUMM_API_SECRET || '';

    if (!this.API_KEY || !this.API_SECRET) {
      console.warn('XUMM API credentials not configured. Wallet signing will not work.');
    }
  }

  /**
   * Create a XUMM payload for user signing
   */
  async createPayload(transaction: any): Promise<XUMMCreatePayloadResponse> {
    if (!this.API_KEY || !this.API_SECRET) {
      throw new Error('XUMM API credentials not configured');
    }

    try {
      const response = await fetch(`${this.BASE_URL}/platform/payload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.API_KEY,
          'X-API-Secret': this.API_SECRET,
        },
        body: JSON.stringify({
          txjson: transaction,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`XUMM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as XUMMCreatePayloadResponse;
      return data;
    } catch (error) {
      console.error('Error creating XUMM payload:', error);
      throw error;
    }
  }

  /**
   * Get payload status
   */
  async getPayloadStatus(uuid: string): Promise<XUMMPayloadStatusResponse> {
    if (!this.API_KEY || !this.API_SECRET) {
      throw new Error('XUMM API credentials not configured');
    }

    try {
      const response = await fetch(`${this.BASE_URL}/platform/payload/${uuid}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.API_KEY,
          'X-API-Secret': this.API_SECRET,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`XUMM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as XUMMPayloadStatusResponse;
      return data;
    } catch (error) {
      console.error('Error getting XUMM payload status:', error);
      throw error;
    }
  }

  /**
   * Cancel a payload
   */
  async cancelPayload(uuid: string): Promise<void> {
    if (!this.API_KEY || !this.API_SECRET) {
      throw new Error('XUMM API credentials not configured');
    }

    try {
      const response = await fetch(`${this.BASE_URL}/platform/payload/${uuid}/cancel`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': this.API_KEY,
          'X-API-Secret': this.API_SECRET,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`XUMM API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error cancelling XUMM payload:', error);
      throw error;
    }
  }
}

export const xummService = new XUMMService();
