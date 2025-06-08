import axios from 'axios';
import axiosRetry from 'axios-retry';

type TokenList = TokenDexInfo[];

type TokenDexInfo = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: BaseToken;
  quoteToken: QuoteToken;
  priceNative: string;
  priceUsd: string;
  txns: Txns;
  volume: Volume;
  priceChange: PriceChange;
  liquidity: Liquidity;
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info: Info;
};

type BaseToken = {
  address: string;
  name: string;
  symbol: string;
};

type QuoteToken = {
  address: string;
  name: string;
  symbol: string;
};

type Txns = {
  m5: M5;
  h1: H1;
  h6: H6;
  h24: H24;
};

type M5 = {
  buys: number;
  sells: number;
};

type H1 = {
  buys: number;
  sells: number;
};

type H6 = {
  buys: number;
  sells: number;
};

type H24 = {
  buys: number;
  sells: number;
};

type Volume = {
  h24: number;
  h6: number;
  h1: number;
  m5: number;
};

type PriceChange = {
  m5: number;
  h1: number;
  h6: number;
  h24: number;
};

type Liquidity = {
  usd: number;
  base: number;
  quote: number;
};

type Info = {
  imageUrl: string;
  header: string;
  openGraph: string;
  websites: any[];
  socials: Social[];
};

type Social = {
  type: string;
  url: string;
};

// Create axios client with custom configuration
const client = axios.create({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
});

// Configure retry mechanism
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Custom retry conditions
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNRESET';
  }
});

// Token information class to parse and store token data
export class TokenInfo {
  name: string;
  symbol: string;
  address: string;
  chain: string;
  liquidityUSD: number;
  marketCap: number;
  priceUSD: string;
  createdAt: number;
  volumeH24: number;
  volumeH6: number;
  volumeH1: number;
  volumeM5: number;
  changeH6: number;
  website: string;
  twitter: string;

  constructor(data: TokenList) {
    const pair = data[0];
    const baseToken = pair.baseToken;

    this.name = baseToken.name;
    this.symbol = baseToken.symbol;
    this.address = baseToken.address;
    this.chain = pair.chainId;
    this.liquidityUSD = pair.liquidity.usd;
    this.marketCap = pair.marketCap;
    this.priceUSD = pair.priceUsd;
    this.createdAt = Math.floor(pair.pairCreatedAt / 1000); // Convert to seconds timestamp

    // Volume data
    this.volumeH24 = pair.volume.h24;
    this.volumeH6 = pair.volume.h6;
    this.volumeH1 = pair.volume.h1;
    this.volumeM5 = pair.volume.m5;

    // Price changes
    this.changeH6 = pair.priceChange?.h6;

    // Website and social media info
    if (pair.info) {
      this.website = pair.info.websites?.[0]?.url;

      const twitter = pair.info.socials.find((s) => s.type === 'twitter');
      if (twitter != undefined) {
        this.twitter = twitter.url;
      }
    }
  }
}

// DexScreener API wrapper class
export class DexScreener {
  // Fetches token information from DexScreener API
  static async getTokenInfo(chainId, tokenAddress): Promise<TokenInfo> {
    const { data: tokenList } = await client
      .get<TokenList>(`https://api.dexscreener.com/tokens/v1/${chainId}/${tokenAddress}`)
      .catch((error) => {
        console.error('DexScreener API Error:', error.message);
        throw error;
      });

    if (tokenList.length == 0) {
      throw new Error('token info not found');
    }

    return new TokenInfo(tokenList);
  }
}
