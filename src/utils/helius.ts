import BigNumber from 'bignumber.js';
import dotenv from 'dotenv';
import { txsTableRow, SOL_ADDRESS, USDC_ADDRESS } from '../../models/txs';
import { wallet } from '../../models/wallets';
import {
  Helius,
  CreateWebhookRequest,
  EditWebhookRequest,
  TransactionType,
  WebhookType,
  TxnStatus
} from 'helius-sdk';

dotenv.config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!HELIUS_API_KEY) {
  throw new Error('HELIUS_API_KEY or WEBHOOK_URL is not defined in environment variables.');
}

const helius = new Helius(HELIUS_API_KEY);

export type Txs = TxData[];

export interface TxData {
  accountData: AccountDaum[];
  description: string;
  events: Events;
  fee: number;
  feePayer: string;
  nativeTransfers: NativeTransfer[];
  signature: string;
  slot: number;
  source: string;
  timestamp: number;
  tokenTransfers: TokenTransfer[];
  type: string;
}

export interface AccountDaum {
  account: string;
  nativeBalanceChange: number;
  tokenBalanceChanges: TokenBalanceChange[];
}

export interface TokenBalanceChange {
  mint: string;
  rawTokenAmount: RawTokenAmount;
  tokenAccount: string;
  userAccount: string;
}

export interface RawTokenAmount {
  decimals: number;
  tokenAmount: string;
}

export interface Events {
  swap: any;
}

export interface NativeTransfer {
  amount: number;
  fromUserAccount: string;
  toUserAccount: string;
}

export interface TokenTransfer {
  fromTokenAccount: string;
  fromUserAccount: string;
  mint: string;
  toTokenAccount: string;
  toUserAccount: string;
  tokenAmount: number;
  tokenStandard: string;
}

// Formats token amount by dividing by the appropriate decimal power
export function formatAmount(amount, decimals): number {
  return new BigNumber(amount).dividedBy(new BigNumber(10).pow(decimals)).toNumber();
}

// Processes swap event data from webhook into a standardized format
export function processSwapData(webhookData: TxData): txsTableRow {
  const swapEvent = webhookData.events[0];
  let processedData: txsTableRow = {
    account: '',
    token_in_address: '',
    token_in_amount: 0,
    token_out_address: '',
    token_out_amount: 0,
    timestamp: 0,
    description: ''
  };

  // Process account and token_in information
  if (swapEvent.nativeInput && swapEvent.nativeInput.amount) {
    processedData.account = webhookData.feePayer;
    processedData.token_in_address = SOL_ADDRESS;
    processedData.token_in_amount = formatAmount(parseInt(swapEvent.nativeInput.amount), 9);
  } else if (swapEvent.tokenInputs && swapEvent.tokenInputs.length > 0) {
    const tokenInput = swapEvent.tokenInputs[0];
    processedData.account = webhookData.feePayer;
    processedData.token_in_address = tokenInput.mint;
    processedData.token_in_amount = formatAmount(
      parseInt(tokenInput.rawTokenAmount.tokenAmount),
      tokenInput.rawTokenAmount.decimals
    );
  }

  // Process token_out information
  if (swapEvent.nativeOutput && swapEvent.nativeOutput.amount) {
    processedData.token_out_address = SOL_ADDRESS;
    processedData.token_out_amount = formatAmount(parseInt(swapEvent.nativeOutput.amount), 9);
  } else if (swapEvent.tokenOutputs && swapEvent.tokenOutputs.length > 0) {
    const tokenOutput = swapEvent.tokenOutputs[0];
    processedData.token_out_address = tokenOutput.mint;
    processedData.token_out_amount = formatAmount(
      parseInt(tokenOutput.rawTokenAmount.tokenAmount),
      tokenOutput.rawTokenAmount.decimals
    );
  }

  // Add timestamp and description
  processedData.timestamp = webhookData.timestamp;
  processedData.description = webhookData.description;

  const requiredFields = [
    'account',
    'token_in_address',
    'token_in_amount',
    'token_out_address',
    'token_out_amount'
  ];
  const hasAllFields = requiredFields.every(
    (field) => processedData[field] !== '' && processedData[field] !== 0
  );

  if (!hasAllFields) {
    console.log('Incomplete swap data for transaction:', webhookData.signature);
    throw new Error('data is incomplete');
  }

  return processedData;
}

// Set up SWAP type Webhook
export async function setupSwapWebhook(wallets: wallet[]) {
  try {
    const accountAddresses = wallets.map((row) => row.address).filter((addr) => addr);
    if (accountAddresses.length === 0) {
      throw new Error('No valid wallet addresses found in wallets.txt.');
    }

    if (!WEBHOOK_URL) {
      throw new Error('WEBHOOK_URL is not defined in environment variables.');
    }

    // Create Webhook configuration
    const webhookConfig: CreateWebhookRequest = {
      accountAddresses,
      transactionTypes: [TransactionType.SWAP, TransactionType.TRANSFER],
      webhookURL: WEBHOOK_URL,
      authHeader: `Bearer ${HELIUS_API_KEY}`,
      webhookType: WebhookType.ENHANCED,
      txnStatus: TxnStatus.SUCCESS
    };

    const response = await helius.createWebhook(webhookConfig);
    console.log('Webhook created successfully:', response);
  } catch (error) {
    console.error('Error creating webhook:', error);
  }
}

export async function updateSwapWebhook(wallets: wallet[], WEBHOOK_ID: string) {
  try {
    const accountAddresses = wallets.map((row) => row.address).filter((addr) => addr);
    if (accountAddresses.length === 0) {
      throw new Error('No valid wallet addresses found in wallets.txt.');
    }

    // Create Webhook configuration
    const editWebhookRequset: EditWebhookRequest = {
      accountAddresses,
      transactionTypes: [TransactionType.SWAP, TransactionType.TRANSFER],
      webhookURL: WEBHOOK_URL,
      authHeader: `Bearer ${HELIUS_API_KEY}`,
      webhookType: WebhookType.ENHANCED,
      txnStatus: TxnStatus.SUCCESS
    };

    const response = await helius.editWebhook(WEBHOOK_ID, editWebhookRequset);
    console.log('Webhook updated successfully:', response);
  } catch (error) {
    console.error('Error creating webhook:', error);
  }
}
