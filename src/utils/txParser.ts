import axios from 'axios';
import dotenv from 'dotenv';
import { txsTableRow } from '../../models/txs';

dotenv.config();

type ParsedTx = {
  success: boolean;
  message: string;
  result: Result;
};

type Result = {
  timestamp: string;
  fee: number;
  fee_payer: string;
  signers: string[];
  signatures: string[];
  protocol: Protocol;
  type: string;
  status: string;
  token_balance_changes: TokenBalanceChange[];
  actions: Action[];
  events: Event[];
};

type Protocol = {
  address: string;
  name: string;
};

type TokenBalanceChange = {
  address: string;
  decimals: number;
  change_amount: number;
  post_balance: number;
  pre_balance: number;
  mint: string;
  owner: string;
};

type Action = {
  info: Info;
  source_protocol: SourceProtocol;
  type: string;
  ix_index: number;
  parent_protocol?: string;
};

type Info = {
  swapper: string;
  tokens_swapped: TokensSwapped;
  swaps?: Swap[];
  slippage_in_percent: any;
  quoted_out_amount: any;
  slippage_paid: any;
  amount?: number;
  amount_raw?: number;
  receiver?: string;
  sender?: string;
  receiver_associated_account?: string;
  token_address?: string;
};

type TokensSwapped = {
  in: In;
  out: Out;
};

type In = {
  token_address: string;
  name: string;
  symbol: string;
  image_uri: string;
  amount: number;
  amount_raw: number;
};

type Out = {
  token_address: string;
  name: string;
  symbol: string;
  image_uri: string;
  amount: number;
  amount_raw: number;
};

type Swap = {
  liquidity_pool_address: string;
  name: string;
  source: string;
  in: In2;
  out: Out2;
};

type In2 = {
  token_address: string;
  name: string;
  symbol: string;
  image_uri: string;
  amount: number;
  amount_raw: number;
};

type Out2 = {
  token_address: string;
  name: string;
  symbol: string;
  image_uri: string;
  amount: number;
  amount_raw: number;
};

type SourceProtocol = {
  address: string;
  name: string;
};

type Event = {
  data: Data;
  name: string;
};

type Data = {
  timestamp: number;
  base_amount_in: number;
  min_quote_amount_out: number;
  user_base_token_reserves: number;
  user_quote_token_reserves: number;
  pool_base_token_reserves: number;
  pool_quote_token_reserves: number;
  quote_amount_out: number;
  lp_fee_basis_points: number;
  lp_fee: number;
  protocol_fee_basis_points: number;
  protocol_fee: number;
  quote_amount_out_without_lp_fee: number;
  user_quote_amount_out: number;
  pool: string;
  user: string;
  user_base_token_account: string;
  user_quote_token_account: string;
  protocol_fee_recipient: string;
  protocol_fee_recipient_token_account: string;
  coin_creator: string;
  coin_creator_fee_basis_points: number;
  coin_creator_fee: number;
};

// Parses Solana transaction data using the Shyft API
export async function parser(signature: string): Promise<txsTableRow | null> {
  const BASE_URL = 'https://api.shyft.to/sol/v1';

  const response = await axios
    .get<ParsedTx>(`${BASE_URL}/transaction/parsed`, {
      params: {
        network: 'mainnet-beta',
        txn_signature: signature
      },
      headers: {
        'x-api-key': process.env.SHYFT_API_KEY
      }
    })
    .catch((error) => {
      console.error('Error fetching transaction:', error);
      return { data: null };
    });

  if (!response || !response.data) {
    throw null;
  }

  // Check if successful and is a SWAP type transaction
  if (response.data.success && response.data.result) {
    const result = response.data.result;
    console.log(JSON.stringify(result, null, 2));
    // Find action containing tokens_swapped
    const swapAction = result.actions.find((action) => action.info && action.info.tokens_swapped);

    if (swapAction) {
      // Convert ISO timestamp to seconds timestamp
      const timestamp = Math.floor(new Date(result.timestamp).getTime() / 1000);

      return {
        account: swapAction.info.swapper,
        token_in_address: swapAction.info.tokens_swapped.in.token_address,
        token_in_amount: swapAction.info.tokens_swapped.in.amount,
        token_out_address: swapAction.info.tokens_swapped.out.token_address,
        token_out_amount: swapAction.info.tokens_swapped.out.amount,
        timestamp: timestamp,
        description: null
      };
    }
  }

  throw null;
}
