import axios from 'axios';

type DexPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  labels: string[];
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  pairCreatedAt: number; // Timestamp in milliseconds
};

type DexPairList = DexPair[];


// Cache class for SOL price to minimize API calls
class SolPriceCache {
  price: number;
  lastUpdate: number;
  CACHE_DURATION: number;

  constructor() {
    this.price = null;
    this.lastUpdate = 0;
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
  }

  // Fetches SOL price with caching mechanism
  async getPrice() {
    const now = Date.now();
    
    // Return cached price if it exists and hasn't expired
    if (this.price && (now - this.lastUpdate) < this.CACHE_DURATION) {
      // console.log('Returning cached SOL price:', this.price);
      return this.price;
    }

    try {
      // Get latest price from DexScreener
      const response = await axios.get('https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112', {
        headers: {}
      })
      const data: DexPairList = await response.data;
      const solPrice = parseFloat(data[0].priceUsd);
      
      this.price = solPrice;
      this.lastUpdate = now;
      
      return this.price;
    } catch (error) {
      console.error('Failed to fetch SOL price:', error);

      if (this.price) {
        console.log('API call failed, returning cached price:', this.price);
        return this.price;
      }

      throw error;
    }
  }
}

// Create singleton instance
export const solPrice = new SolPriceCache();