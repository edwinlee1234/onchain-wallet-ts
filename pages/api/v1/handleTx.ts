import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { TxData, Txs, processSwapData } from '../../../src/utils/helius';
import { txsTableRow } from '../../../models/txs';
import { parser } from '../../../src/utils/txParser';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse<string>) {
  if (req.method != 'POST') {
    return res.status(405).json(JSON.stringify({ message: 'Method not allowed' }));
  }

  if (req.headers.authorization !== `Bearer ${process.env.HELIUS_API_KEY}`) {
    return res.status(401).json(JSON.stringify({ message: 'Unauthorized' }));
  }

  let txs: Txs = req.body;
  if (txs.length == 0) {
    console.error('Empty transaction data received', txs);
    return res.status(200).json(JSON.stringify({ skipped: true, message: 'Empty data' }));
  }

  let txData: TxData = txs[0];

  // Skip PUMP_FUN transactions or non-PUMP-AMM/METEORA_DLMM/JUPITER_V_6 transfer
  if (
    txData.source === 'PUMP_FUN' ||
    (txData.type === 'TRANSFER' &&
      txData.accountData?.some(
        (acc) => acc.account === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
      )) ||
    (txData.type === 'TRANSFER' &&
      !txData.accountData?.some(
        (acc) => acc.account === 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'
      )) || //PUMP_AMM
    (txData.type === 'TRANSFER' &&
      !txData.accountData?.some(
        (acc) => acc.account === 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
      )) || //METEORA_DLMM
    (txData.type === 'TRANSFER' &&
      !txData.accountData?.some(
        (acc) => acc.account === 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
      )) //JUPITER_V_6
  ) {
    return res.status(200).json(JSON.stringify({ skipped: true }));
  }

  // Process transaction data
  let processedData: txsTableRow;

  if (txData.events?.swap) {
    processedData = processSwapData(txData);
  } else if (txData.signature) {
    let parserdData = await parser(txData.signature);
    if (!parserdData) {
      console.error('Failed to parse tx:', txData.signature);
      return res.status(200).json(JSON.stringify({ skipped: true }));
    }
    processedData = parserdData;
  } else {
    console.log('No swap data:', txData.signature);
    return res.status(200).json(JSON.stringify({ skipped: true }));
  }

  // Store to database
  const { error } = await supabase.from('txs').insert([
    {
      ...processedData,
      signature: txData.signature
    }
  ]);
  if (error) {
    console.error('Error inserting into Supabase:', error);
    return res.status(500).json(JSON.stringify({ error: error }));
  }

  console.log('handle tx success');

  return res.status(200).json(
    JSON.stringify({
      success: true
    })
  );
}
