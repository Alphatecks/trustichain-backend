import { Router } from 'express';
import { cardyfieController } from '../controllers/cardyfie.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   POST /api/cardyfie/customer
 * @desc    Create a Cardyfie customer (full KYC; required before issuing cards)
 * @access  Private
 * @body    first_name, last_name, email, date_of_birth, id_type, id_number, id_front_image, user_image, house_number, address_line_1, city, zip_code, country, state?, id_back_image?, reference_id?, meta?
 */
router.post('/customer', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.createCustomer(req, res);
}));

/**
 * @route   GET /api/cardyfie/card/currencies
 * @desc    Get supported card currencies (for issue card currency field)
 * @access  Private
 */
router.get('/card/currencies', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.getCardCurrencies(req, res);
}));

/**
 * @route   GET /api/cardyfie/cards
 * @desc    Get all cards (paginated)
 * @access  Private
 * @query   page? (optional)
 */
router.get('/cards', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.getAllCards(req, res);
}));

/**
 * @route   POST /api/cardyfie/card/issue
 * @desc    Issue a virtual card
 * @access  Private
 * @body    { customer_ulid, card_name, card_currency, card_type?, card_provider?, reference_id?, meta? }
 */
router.post('/card/issue', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.issueCard(req, res);
}));

/**
 * @route   GET /api/cardyfie/card/transactions
 * @desc    Get card transactions (optional filters)
 * @access  Private
 * @query   card_ulid? (optional), trx_id? (optional) - omit for all cards
 */
router.get('/card/transactions', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.getCardTransactions(req, res);
}));

/**
 * @route   GET /api/cardyfie/card/:ulid
 * @desc    Get card details (includes cvv, real_pan)
 * @access  Private
 */
router.get('/card/:ulid', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.getCardDetails(req, res);
}));

/**
 * @route   POST /api/cardyfie/card/:ulid/freeze
 * @desc    Freeze a card
 * @access  Private
 */
router.post('/card/:ulid/freeze', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.freezeCard(req, res);
}));

/**
 * @route   POST /api/cardyfie/card/:ulid/unfreeze
 * @desc    Unfreeze a card
 * @access  Private
 */
router.post('/card/:ulid/unfreeze', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.unfreezeCard(req, res);
}));

/**
 * @route   POST /api/cardyfie/card/:ulid/deposit
 * @desc    Deposit funds to a card
 * @access  Private
 * @body    { amount: number }
 */
router.post('/card/:ulid/deposit', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.depositCard(req, res);
}));

/**
 * @route   POST /api/cardyfie/card/:ulid/withdraw
 * @desc    Withdraw funds from a card
 * @access  Private
 * @body    { amount: number }
 */
router.post('/card/:ulid/withdraw', authenticate, asyncHandler(async (req, res) => {
  await cardyfieController.withdrawCard(req, res);
}));

export default router;
