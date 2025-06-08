import { searchTwitter, getUserTimeline, UserTimelineTweet, searchTwitterRes } from './tweetAPI';
import { sendTelegramMessage } from './telegram';
import { TokenInfo } from './dexscreener';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID,
  organization: process.env.OPENAI_ORGANIZATION,
  baseURL: 'https://api.openai.com/v1'
});

// Summarizes tweets related to a token from both account and search results
async function sumTweets(
  tokenInfo: TokenInfo
): Promise<{ search_summary: string; account_summary: string }> {
  const { symbol, address, twitter } = tokenInfo;

  let account_tweets: UserTimelineTweet[] = [];
  let search_tweets: searchTwitterRes[] = [];

  // Get tweets from Twitter account
  if (twitter && (twitter.includes('x.com/') || twitter.includes('twitter.com/'))) {
    const urlParts = twitter.split('/');
    // Exclude special links
    if (
      !twitter.includes('/communities/') &&
      !twitter.includes('/search?') &&
      !twitter.includes('/status/')
    ) {
      let screenname = urlParts[urlParts.length - 1].split('?')[0];
      
      const timelineResult = await getUserTimeline(screenname);

      if (timelineResult) {
        account_tweets = timelineResult.tweets;
      } else {
        console.log('Failed to fetch user tweets:', screenname);
      }
    }
  }

  // Search for tweets related to token address
  search_tweets = await searchTwitter(address);

  if (!search_tweets?.length) {
    console.log('No tweets found for address:', address);
    throw new Error(`No tweet data found for ${symbol}(${address}).`);
  }

  // Analyze tweets
  const search_summary = await genSum(symbol, search_tweets, [], 'search');

  let account_summary: string = '';
  if (account_tweets.length > 0) {
    account_summary = await genSum(symbol, [], account_tweets, 'account');
  }

  if (!search_summary && !account_summary) {
    console.log(`Unable to generate tweet analysis summary for ${symbol}.`);
    throw new Error(`Unable to generate tweet analysis summary for ${symbol}.`);
  }

  return { search_summary: search_summary, account_summary: account_summary };
}

// Generates a summary of tweets using AI
async function genSum(symbol:string, search_tweets:searchTwitterRes[], account_tweets:UserTimelineTweet[], type = 'search'): Promise<string> {
  try {
    let tweetData:string[] = [];
    let promptPrefix:string = '';
    let promptSuffix:string = '';

    if (type === 'account') {
      promptPrefix = `請總結關於 ${symbol} 的帳號推文:`;
      promptSuffix = `提供簡短的要點總結。保持簡潔直接,去除所有不必要的字詞。 `;

      // Process account tweets format
      tweetData = account_tweets.map(
        (tweet, index) => `
     Tweet ${index + 1}:
     Content: ${tweet.text}
     Time: ${tweet.created_at}
     Engagement: ${tweet.views} views / ${tweet.favorites} likes
     ---`
      );
    } else {
      // Search tweets
      promptPrefix = `請總結關於 ${symbol} 的搜尋推文:`;
      promptSuffix = `提供關於敘事觀點和風險內容的極簡要點總結。不總結主觀價格預測和個人收益的內容。保持簡潔直接,去除所有不必要的字詞。格式如下：
     - 敘事觀點：
     - 風險內容：`;

      // Process search tweets format
      tweetData = search_tweets.map(
        (tweet, index) => `
     Tweet ${index + 1}:
     Content: ${tweet.text}
     Time: ${tweet.created_at}
     Author: ${tweet.author.name} (@${tweet.author.screen_name})
     Followers: ${tweet.author.followers_count}
     Engagement: ${tweet.views} views / ${tweet.favorites} likes
     ---`
      );
    }

    const prompt = `${promptPrefix}

${tweetData.join('\n')}

${promptSuffix}`;

    console.log(prompt);

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes cryptocurrency Twitter data.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 1.0,
      max_tokens: 3000
    });

    if (!response.choices[0].message.content) {
      throw new Error(`response is empty`);
    }

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating Twitter summary:', error);
    return 'Failed to generate summary due to an error.';
  }
}

// Sends the tweet summary to Telegram as a reply to a message
export async function sendSumMessage(tokenInfo:TokenInfo, replyToMessageId:string|null) {
  const summaryResult = await sumTweets(tokenInfo);
  if (!summaryResult) {
    console.log(`Unable to get tweet summary for ${tokenInfo.symbol}`);
    return;
  }

  const { search_summary, account_summary } = summaryResult;

  let message = `\u{1F49B}${tokenInfo.symbol} tweets summary:\n`;

  if (account_summary) {
    // Format line breaks and spaces, replace multiple line breaks with a single one
    const formattedAccountSummary = account_summary.replace(/\n\s*\n/g, '\n').trim();
    message += `<blockquote>${formattedAccountSummary}</blockquote>\n\n`;
  }

  if (search_summary) {
    message += `\u{1F49B}Searched tweets summary:\n<blockquote>${search_summary}</blockquote>`;
  }

  const tgResponse = await sendTelegramMessage(message, replyToMessageId);
  if (!tgResponse.ok) {
    throw new Error(`sendTelegramMessage failed`);
  }
}
