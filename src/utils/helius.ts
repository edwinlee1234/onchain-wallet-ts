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
  description: string
  type: string
  source: string
  fee: number
  feePayer: string
  signature: string
  slot: number
  timestamp: number
  nativeTransfers: NativeTransfer[]
  tokenTransfers: TokenTransfer[]
  accountData: AccountDaum[]
  transactionError: TransactionError
  instructions: Instruction[]
  events: Events
}

export interface NativeTransfer {
  fromUserAccount: string
  toUserAccount: string
  amount: number
}

export interface TokenTransfer {
  fromUserAccount: string
  toUserAccount: string
  fromTokenAccount: string
  toTokenAccount: string
  tokenAmount: number
  mint: string
}

export interface AccountDaum {
  account: string
  nativeBalanceChange: number
  tokenBalanceChanges: TokenBalanceChange[]
}

export interface TokenBalanceChange {
  userAccount: string
  tokenAccount: string
  mint: string
  rawTokenAmount: RawTokenAmount
}

export interface RawTokenAmount {
  tokenAmount: string
  decimals: number
}

export interface TransactionError {
  error: string
}

export interface Instruction {
  accounts: string[]
  data: string
  programId: string
  innerInstructions: InnerInstruction[]
}

export interface InnerInstruction {
  accounts: string[]
  data: string
  programId: string
}

export interface Events {
  nft: Nft
  swap: Swap
  compressed: Compressed
  distributeCompressionRewards: DistributeCompressionRewards
  setAuthority: SetAuthority
}

export interface Nft {
  description: string
  type: string
  source: string
  amount: number
  fee: number
  feePayer: string
  signature: string
  slot: number
  timestamp: number
  saleType: string
  buyer: string
  seller: string
  staker: string
  nfts: Nft2[]
}

export interface Nft2 {
  mint: string
  tokenStandard: string
}

export interface Swap {
  nativeInput: NativeInput
  nativeOutput: NativeOutput
  tokenInputs: TokenInput[]
  tokenOutputs: TokenOutput[]
  tokenFees: TokenFee[]
  nativeFees: NativeFee[]
  innerSwaps: InnerSwap[]
}

export interface NativeInput {
  account: string
  amount: string
}

export interface NativeOutput {
  account: string
  amount: string
}

export interface TokenInput {
  userAccount: string
  tokenAccount: string
  mint: string
  rawTokenAmount: RawTokenAmount2
}

export interface RawTokenAmount2 {
  tokenAmount: string
  decimals: number
}

export interface TokenOutput {
  userAccount: string
  tokenAccount: string
  mint: string
  rawTokenAmount: RawTokenAmount3
}

export interface RawTokenAmount3 {
  tokenAmount: string
  decimals: number
}

export interface TokenFee {
  userAccount: string
  tokenAccount: string
  mint: string
  rawTokenAmount: RawTokenAmount4
}

export interface RawTokenAmount4 {
  tokenAmount: string
  decimals: number
}

export interface NativeFee {
  account: string
  amount: string
}

export interface InnerSwap {
  tokenInputs: TokenInput2[]
  tokenOutputs: TokenOutput2[]
  tokenFees: TokenFee2[]
  nativeFees: NativeFee2[]
  programInfo: ProgramInfo
}

export interface TokenInput2 {
  fromUserAccount: string
  toUserAccount: string
  fromTokenAccount: string
  toTokenAccount: string
  tokenAmount: number
  mint: string
}

export interface TokenOutput2 {
  fromUserAccount: string
  toUserAccount: string
  fromTokenAccount: string
  toTokenAccount: string
  tokenAmount: number
  mint: string
}

export interface TokenFee2 {
  fromUserAccount: string
  toUserAccount: string
  fromTokenAccount: string
  toTokenAccount: string
  tokenAmount: number
  mint: string
}

export interface NativeFee2 {
  fromUserAccount: string
  toUserAccount: string
  amount: number
}

export interface ProgramInfo {
  source: string
  account: string
  programName: string
  instructionName: string
}

export interface Compressed {
  type: string
  treeId: string
  assetId: string
  leafIndex: number
  instructionIndex: number
  innerInstructionIndex: number
  newLeafOwner: string
  oldLeafOwner: string
}

export interface DistributeCompressionRewards {
  amount: number
}

export interface SetAuthority {
  account: string
  from: string
  to: string
  instructionIndex: number
  innerInstructionIndex: number
}

// Formats token amount by dividing by the appropriate decimal power
export function formatAmount(amount, decimals): number {
  return new BigNumber(amount).dividedBy(new BigNumber(10).pow(decimals)).toNumber();
}

// Processes swap event data from webhook into a standardized format
export function processSwapData(webhookData: TxData): txsTableRow {
  const swapEvent = webhookData.events.swap;
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
