import { Request, Response } from 'express';
import { cardyfieService } from '../services/cardyfie/cardyfie.service';

const REQUIRED_CUSTOMER_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'date_of_birth',
  'id_type',
  'id_number',
  'id_front_image',
  'user_image',
  'house_number',
  'address_line_1',
  'city',
  'zip_code',
  'country',
] as const;

export class CardyfieController {
  /**
   * Create a Cardyfie customer (full KYC body)
   * POST /api/cardyfie/customer
   */
  async createCustomer(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as Record<string, unknown>;
      const missing = REQUIRED_CUSTOMER_FIELDS.filter((f) => !body[f]);
      if (missing.length) {
        res.status(400).json({
          success: false,
          message: `Missing required fields: ${missing.join(', ')}`,
        });
        return;
      }
      const idType = body.id_type as string;
      if (!['passport', 'nid', 'bvn'].includes(idType)) {
        res.status(400).json({
          success: false,
          message: 'id_type must be one of: passport, nid, bvn',
        });
        return;
      }
      const result = await cardyfieService.createCustomer({
        first_name: body.first_name as string,
        last_name: body.last_name as string,
        email: body.email as string,
        date_of_birth: body.date_of_birth as string,
        id_type: idType as 'passport' | 'nid' | 'bvn',
        id_number: body.id_number as string,
        id_front_image: body.id_front_image as string,
        user_image: body.user_image as string,
        house_number: body.house_number as string,
        address_line_1: body.address_line_1 as string,
        city: body.city as string,
        zip_code: body.zip_code as string,
        country: body.country as string,
        state: body.state as string | undefined,
        id_back_image: body.id_back_image as string | undefined,
        reference_id: body.reference_id as string | undefined,
        meta: body.meta as { user_id?: string } | undefined,
      });
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Issue a virtual card
   * POST /api/cardyfie/card/issue
   */
  async issueCard(req: Request, res: Response): Promise<void> {
    try {
      const {
        customer_ulid,
        card_name,
        card_currency,
        card_type,
        card_provider,
        reference_id,
        meta,
      } = req.body;
      if (!customer_ulid || !card_name || !card_currency || !card_provider) {
        res.status(400).json({
          success: false,
          message:
            'customer_ulid, card_name, card_currency, and card_provider are required',
        });
        return;
      }
      const type = card_type === 'platinum' ? 'platinum' : 'universal';
      if (card_type && !['universal', 'platinum'].includes(card_type)) {
        res.status(400).json({
          success: false,
          message: 'card_type must be universal or platinum',
        });
        return;
      }
      const provider = card_provider === 'mastercard' ? 'mastercard' : 'visa';
      if (card_provider && !['visa', 'mastercard'].includes(card_provider)) {
        res.status(400).json({
          success: false,
          message: 'card_provider must be visa or mastercard',
        });
        return;
      }
      const result = await cardyfieService.issueCard({
        customer_ulid,
        card_name,
        card_currency,
        card_type: type,
        card_provider: provider,
        reference_id,
        meta,
      });
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Deposit funds to a card
   * POST /api/cardyfie/card/:ulid/deposit
   */
  async depositCard(req: Request, res: Response): Promise<void> {
    try {
      const { ulid } = req.params;
      const { amount } = req.body;
      if (!ulid || amount == null || typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid card ulid and positive amount are required',
        });
        return;
      }
      const result = await cardyfieService.depositCard(ulid, { amount });
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Withdraw funds from a card
   * POST /api/cardyfie/card/:ulid/withdraw
   */
  async withdrawCard(req: Request, res: Response): Promise<void> {
    try {
      const { ulid } = req.params;
      const { amount } = req.body;
      if (!ulid || amount == null || typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Valid card ulid and positive amount are required',
        });
        return;
      }
      const result = await cardyfieService.withdrawCard(ulid, { amount });
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Get card transactions (card_ulid and trx_id optional)
   * GET /api/cardyfie/card/transactions?card_ulid=&trx_id=
   */
  async getCardTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { card_ulid, trx_id } = req.query;
      const params: { card_ulid?: string; trx_id?: string } = {};
      if (typeof card_ulid === 'string') params.card_ulid = card_ulid;
      if (typeof trx_id === 'string') params.trx_id = trx_id;
      const result = await cardyfieService.getCardTransactions(
        Object.keys(params).length ? params : undefined
      );
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Get supported card currencies
   * GET /api/cardyfie/card/currencies
   */
  async getCardCurrencies(_req: Request, res: Response): Promise<void> {
    try {
      const result = await cardyfieService.getCardCurrencies();
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Get all cards (paginated)
   * GET /api/cardyfie/cards?page=
   */
  async getAllCards(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page;
      const pageNum =
        page != null && page !== '' ? parseInt(String(page), 10) : undefined;
      if (page != null && page !== '' && (isNaN(pageNum!) || pageNum! < 1)) {
        res.status(400).json({
          success: false,
          message: 'page must be a positive integer',
        });
        return;
      }
      const result = await cardyfieService.getAllCards(pageNum);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Get card details (includes cvv, real_pan)
   * GET /api/cardyfie/card/:ulid
   */
  async getCardDetails(req: Request, res: Response): Promise<void> {
    try {
      const { ulid } = req.params;
      if (!ulid) {
        res.status(400).json({
          success: false,
          message: 'Card ulid is required',
        });
        return;
      }
      const result = await cardyfieService.getCardDetails(ulid);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Freeze a card
   * POST /api/cardyfie/card/:ulid/freeze
   */
  async freezeCard(req: Request, res: Response): Promise<void> {
    try {
      const { ulid } = req.params;
      if (!ulid) {
        res.status(400).json({
          success: false,
          message: 'Card ulid is required',
        });
        return;
      }
      const result = await cardyfieService.freezeCard(ulid);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }

  /**
   * Unfreeze a card
   * POST /api/cardyfie/card/:ulid/unfreeze
   */
  async unfreezeCard(req: Request, res: Response): Promise<void> {
    try {
      const { ulid } = req.params;
      if (!ulid) {
        res.status(400).json({
          success: false,
          message: 'Card ulid is required',
        });
        return;
      }
      const result = await cardyfieService.unfreezeCard(ulid);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message: msg });
    }
  }
}

export const cardyfieController = new CardyfieController();
