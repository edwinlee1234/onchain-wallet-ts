import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { TxData, Txs, processSwapData } from '../../../src/utils/helius';
import { txsTableRow, SOL_ADDRESS, USDC_ADDRESS } from '../../../models/txs';
import { parser } from '../../../src/utils/txParser';
import { DexScreener, TokenInfo } from '../../../src/utils/dexscreener';
import { symbolCache } from '../../../src/utils/symbolcache';
import {
  analyzeTokenTxs,
  formatTimeAgo,
  analyzeAccountResult
} from '../../../src/utils/txsAnalyzer';
import { sendTelegramMessage } from '../../../src/utils/telegram';
import { sendAISumMessage } from '../../../src/utils/aiSummary';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const getTimeStamp = () => {
  return new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
};

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

  alertEvent(processedData);

  return res.status(200).json(
    JSON.stringify({
      success: true
    })
  );
}

const MAX_AGE_DAYS = 365;
const MIN_MARKET_CAP = 100000; // 100k

async function alertEvent(tx: txsTableRow) {
  try {
    if (tx.token_out_address !== SOL_ADDRESS && tx.token_out_address !== USDC_ADDRESS) {
      return;
    }

    const tokenInfo = await DexScreener.getTokenInfo('solana', tx.token_out_address);
    if (!tokenInfo) return;

    const pairAge = (Date.now() / 1000 - tokenInfo.createdAt) / (60 * 60 * 24);
    if (pairAge <= MAX_AGE_DAYS && tokenInfo.marketCap >= MIN_MARKET_CAP) {
      const analysis = await analyzeTokenTxs(tx.token_out_address);

      // Create and send message to Telegram
      const message = createMsg(tokenInfo, analysis);
      const tgResponse = await sendTelegramMessage(message, null);

      // no need to use AI to summary
      if (symbolCache.isExist(tokenInfo.symbol)) {
        return;
      }

      if (tgResponse?.ok === true) {
        const messageId = tgResponse.result.message_id;
        await sendAISumMessage(tokenInfo, messageId);
      }
    }
  } catch (error) {
    console.error(`[${getTimeStamp()}] Error checking token ${tx.token_out_address}:`, error);
  }
}

// Formats a number to a readable currency string with appropriate suffixes
function formatNumber(number) {
  // Ensure number is a numeric type
  const num = Number(number);

  // Check if it's a valid number
  if (isNaN(num)) {
    return '$0.00';
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  } else if (num >= 1_000) {
    return `$${Math.round(num / 1_000)}K`;
  }
  return `$${Math.round(num)}`;
}

// Formats smart money wallet data into a readable string
function formatSmartMoney(analysis: analyzeAccountResult) {
  let details = '';
  for (const [address, data] of Object.entries(analysis)) {
    details += `\u{25AB}<a href="https://solscan.io/account/${address}">${data.walletName}</a> bought ${formatNumber(data.totalBuyCost)} at MC ${formatNumber(data.averageMarketCap)}(${data.buyTime}), Holds: ${data.holdsPercentage}\n`;
  }
  return details.trim();
}

// Creates a formatted message with token information and smart money analysis
export function createMsg(tokenInfo: TokenInfo, analysis: analyzeAccountResult) {
  const smartMoneyCount = Object.keys(analysis).length;

  return `
\u{1F436} Multi Buy Token: <b>$${tokenInfo.symbol}</b>
<code>${tokenInfo.address}</code>

\u{1F90D} <b>Solana</b>
\u{1F49B} <b>MC:</b> <code>${formatNumber(tokenInfo.marketCap)}</code>
\u{1F90E} <b>Vol/24h:</b> <code>${formatNumber(tokenInfo.volumeH24)}</code>
\u{1F90D} <b>Vol/1h:</b> <code>${formatNumber(tokenInfo.volumeH1)}</code>
\u{1F49B} <b>Liq:</b> <code>${formatNumber(tokenInfo.liquidityUSD)}</code>
\u{1F90E} <b>USD:</b> <code>$${Number(tokenInfo.priceUSD).toFixed(6)}</code>
\u{1F90D} <b>Age:</b> <code>${formatTimeAgo(tokenInfo.createdAt)}</code>
\u{1F49B} <b>6H:</b> <code>${tokenInfo.changeH6}%</code>
\u{1F90E} <b>SmartMoney:</b>
${smartMoneyCount} wallets bought $${tokenInfo.symbol}

${formatSmartMoney(analysis)}

<a href="https://dexscreener.com/solana/${tokenInfo.address}">DexScreener</a> | <a href="https://gmgn.ai/sol/token/${tokenInfo.address}">GMGN</a>${tokenInfo.website ? ` | <a href="${tokenInfo.website}">Website</a>` : ''}${tokenInfo.twitter ? ` | <a href="${tokenInfo.twitter}">Twitter</a>` : ''}
`.trim();
}
