/**
 * Cardyfie API Service (Sandbox)
 * Virtual card issuance and management
 * Docs: https://docs.cardyfie.co/
 */

import type {
  CardyfieCreateCustomerRequest,
  CardyfieCustomer,
  CardyfieIssueCardRequest,
  CardyfieCard,
  CardyfieAmountRequest,
  CardyfieTransaction,
  CardyfieCurrencyItem,
  CardyfiePaginatedCards,
} from '../../types/api/cardyfie.types';

const CARDYFIE_SANDBOX_BASE = 'https://core.cardyfie.co/api/sandbox/v1';

interface CardyfieApiResponse<T = unknown> {
  message: { success?: string[]; error?: string[] };
  data: T;
  type: 'success' | 'error';
}

function getApiKey(): string {
  const key = process.env.CARDYFIE_API_KEY;
  if (!key) {
    throw new Error(
      'CARDYFIE_API_KEY is not set. Add it to your .env file. Get it from Cardyfie Dashboard → Api Credentials → Create App.'
    );
  }
  return key;
}

async function cardyfieRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: object
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${CARDYFIE_SANDBOX_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const options: RequestInit = { method, headers };
  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const raw = (await res.json().catch(() => ({}))) as CardyfieApiResponse<unknown>;

  if (!res.ok) {
    const errMsg =
      (raw.message?.error && raw.message.error[0]) || (raw.message as unknown as string) || res.statusText;
    throw new Error(`Cardyfie API error (${res.status}): ${String(errMsg)}`);
  }

  if (raw.type === 'error') {
    const errMsg = raw.message?.error?.[0] ?? 'Unknown error';
    throw new Error(String(errMsg));
  }

  return raw.data as T;
}

export class CardyfieService {
  /**
   * Create a customer (required before issuing cards)
   * POST /card-customer/create
   */
  async createCustomer(
    payload: CardyfieCreateCustomerRequest
  ): Promise<{ success: boolean; customer?: CardyfieCustomer; message?: string }> {
    try {
      const data = await cardyfieRequest<{ customer: CardyfieCustomer }>(
        'POST',
        '/card-customer/create',
        payload
      );
      return { success: true, customer: data.customer };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Issue a virtual card
   * POST /card/issue
   */
  async issueCard(
    payload: CardyfieIssueCardRequest
  ): Promise<{ success: boolean; card?: CardyfieCard; message?: string }> {
    try {
      const data = await cardyfieRequest<{ virtual_card: CardyfieCard }>(
        'POST',
        '/card/issue',
        payload
      );
      return { success: true, card: data.virtual_card };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Deposit funds to a card
   * POST /card/deposit/{ulid}
   */
  async depositCard(
    cardUlid: string,
    payload: CardyfieAmountRequest
  ): Promise<{ success: boolean; card?: CardyfieCard; trx_id?: string; message?: string }> {
    try {
      const data = await cardyfieRequest<{
        virtual_card: CardyfieCard;
        deposit: { trx_id: string };
      }>('POST', `/card/deposit/${encodeURIComponent(cardUlid)}`, payload);
      return {
        success: true,
        card: data.virtual_card,
        trx_id: data.deposit?.trx_id,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Withdraw funds from a card
   * POST /card/withdraw/{ulid}
   */
  async withdrawCard(
    cardUlid: string,
    payload: CardyfieAmountRequest
  ): Promise<{ success: boolean; message?: string }> {
    try {
      await cardyfieRequest<null>(
        'POST',
        `/card/withdraw/${encodeURIComponent(cardUlid)}`,
        payload
      );
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Get card transactions (card_ulid and trx_id optional; omit for all cards)
   * GET /card/transactions?card_ulid=&trx_id=
   */
  async getCardTransactions(params?: {
    card_ulid?: string;
    trx_id?: string;
  }): Promise<{
    success: boolean;
    transactions?: CardyfieTransaction[];
    message?: string;
  }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.card_ulid) searchParams.set('card_ulid', params.card_ulid);
      if (params?.trx_id) searchParams.set('trx_id', params.trx_id);
      const query = searchParams.toString();
      const path = query ? `/card/transactions?${query}` : '/card/transactions';
      const data = await cardyfieRequest<{ transactions: CardyfieTransaction[] }>('GET', path);
      const list = data.transactions ?? [];
      return { success: true, transactions: list };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Get supported card currencies (for issue card currency field)
   * GET /card/currencies
   */
  async getCardCurrencies(): Promise<{
    success: boolean;
    currencies?: CardyfieCurrencyItem[];
    message?: string;
  }> {
    try {
      const data = await cardyfieRequest<{ currencies: CardyfieCurrencyItem[] }>(
        'GET',
        '/card/currencies'
      );
      return { success: true, currencies: data.currencies ?? [] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Get all cards (paginated)
   * GET /card/get-all?page=
   */
  async getAllCards(page?: number): Promise<{
    success: boolean;
    cards?: CardyfiePaginatedCards;
    message?: string;
  }> {
    try {
      const path = page != null ? `/card/get-all?page=${page}` : '/card/get-all';
      const data = await cardyfieRequest<{ cards: CardyfiePaginatedCards }>('GET', path);
      return { success: true, cards: data.cards };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Get card details (includes cvv, real_pan)
   * GET /card/details/{ulid}
   */
  async getCardDetails(ulid: string): Promise<{
    success: boolean;
    card?: CardyfieCard;
    message?: string;
  }> {
    try {
      const data = await cardyfieRequest<{ virtual_card: CardyfieCard }>(
        'GET',
        `/card/details/${encodeURIComponent(ulid)}`
      );
      return { success: true, card: data.virtual_card };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Freeze a card
   * POST /card/freeze/{ulid}
   */
  async freezeCard(ulid: string): Promise<{ success: boolean; message?: string }> {
    try {
      await cardyfieRequest<null>('POST', `/card/freeze/${encodeURIComponent(ulid)}`);
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }

  /**
   * Unfreeze a card
   * POST /card/unfreeze/{ulid}
   */
  async unfreezeCard(ulid: string): Promise<{ success: boolean; message?: string }> {
    try {
      await cardyfieRequest<null>('POST', `/card/unfreeze/${encodeURIComponent(ulid)}`);
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, message: msg };
    }
  }
}

export const cardyfieService = new CardyfieService();
