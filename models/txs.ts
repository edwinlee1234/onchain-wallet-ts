export const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';
export const USDC_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export type txsTableRow = {
  account: string;
  token_in_address: string;
  token_in_amount: number;
  token_out_address: string;
  token_out_amount: number;
  timestamp: number;
  description: string | null;
};
