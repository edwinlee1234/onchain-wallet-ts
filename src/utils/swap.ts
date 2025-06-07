import { Wallet } from '@project-serum/anchor'
import { Connection, Keypair, VersionedTransaction,LAMPORTS_PER_SOL } from '@solana/web3.js'
import bs58 from 'bs58';
import fetch from 'node-fetch'

const API_HOST:string = 'https://gmgn.ai';
export const DEFAULT_FEE:number = 0.002
export const DEFAULT_SLIP:number = 5

type RouteData = {
  quote: {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outputAmount: string;
    otherAmountThreshold: string;
    swapMode: string; // "ExactIn" | "ExactOut" 
    slippageBps: number; // e.g., 50
    platformFee: string | null;
    priceImpact: string;
    routePlan: any[]; 
    contextSlot: number;
    timeTaken: number; // in seconds
  };
  raw_tx: {
    swapTransaction: string;
    lastValidBlockHeight: number;
    rerecentBlockhash: string;
    prioritizationFeeLamports: number;
  };
};

type RouteResponse = {
  code: number;
  data: RouteData;
  msg: string;
};

async function getSwapRoute(inputToken:string,outputToken:string,amount:number,fromAddress:string,slippage:number,fee:number): Promise<RouteResponse> {
  amount = amount * 1000000000

  // get tx route
  const quoteUrl = `${API_HOST}/defi/router/v1/sol/tx/get_swap_route?token_in_address=${inputToken}&token_out_address=${outputToken}&in_amount=${amount}&from_address=${fromAddress}&slippage=${slippage}&fee=${fee}`
  let APIRes = await fetch(quoteUrl)
  let route:RouteResponse = await APIRes.json()
  console.log("routeRes:", route)

  return route
}

type txStatusRes = {
  code: number;
  msg: string;
  data: {
    success: boolean;
    expired: boolean;
  };
}

async function getTxStatus(hash:string, lastValidBlockHeight:number): Promise<txStatusRes> {
  const statusUrl = `${API_HOST}/defi/router/v1/sol/tx/get_transaction_status?hash=${hash}&last_valid_height=${lastValidBlockHeight}`
  let APIRes = await fetch(statusUrl)
  let status:txStatusRes = await APIRes.json()
  console.log("txStatus:", status)

  return status;
}

type SendTxRes = {
  code: number;
  msg: string;
  data: {
    hash: string;
    resArr: any[];
  };
}
async function sendTx(signedTx:string): Promise<SendTxRes> {
  let APIRes = await fetch(`${API_HOST}/txproxy/v1/send_transaction`,
    {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(
        {
          "chain": "sol",
          "signedTx": signedTx
        }
      )
    })
  let txRes: SendTxRes = await APIRes.json()
  console.log("sendTx:", txRes)

  if (txRes.code != 0) {
    throw new Error("send tx got error")
  }

  return txRes;
}

export async function swap(inputToken:string,outputToken:string,amount:number,fromAddress:string,slippage:number,fee:number) {
  const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || '')))
  console.log(`wallet address: ${wallet.publicKey.toString()}`)

  let route = await getSwapRoute(inputToken,outputToken,amount,fromAddress, slippage, fee)

  // sign tx
  const swapTransactionBuf = Buffer.from(route.data.raw_tx.swapTransaction, 'base64')
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf)
  transaction.sign([wallet.payer])
  const signedTx = Buffer.from(transaction.serialize()).toString('base64')

  // send tx
  let txRes = await sendTx(signedTx)

  // check tx status
  while (true) {
    let txStatus = await getTxStatus(txRes.data.hash, route.data.raw_tx.lastValidBlockHeight)
    if (txStatus && txStatus.data.success === true) {
      console.log("Tx is success")
      break
    }
    // success is false case
    if (txStatus && txStatus.data.expired == true) {
      console.log("Tx has expired, it need to be resubmitted")
      break
    }
    await sleep(1000)
  }
}

function sleep(ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}