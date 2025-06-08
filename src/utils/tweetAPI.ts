import axios from 'axios';
import dotenv from 'dotenv';
import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';

dotenv.config();

const RAPID_API_KEY = process.env.RAPID_API_KEY;
const TWITTER_API_HOST = 'twitter-api45.p.rapidapi.com';
// https://rapidapi.com/alexanderxbx/api/twitter-api45

axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount: number) => {
    return retryCount * 1000; // Increasing delay for each retry
  },
  retryCondition: (error: AxiosError) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status ?? 0) >= 500
    );
  }
});

type SearchAPIRes = {
  timeline: Timeline[];
  next_cursor: string;
};

type Timeline = {
  type: string;
  tweet_id: string;
  screen_name: string;
  bookmarks: number;
  favorites: number;
  created_at: string;
  text: string;
  lang: string;
  source: string;
  conversation_id: string;
  possibly_sensitive?: boolean;
  edit_tweet_ids: any;
  geo: any;
  limited_actions: any;
  in_reply_to_user_id?: string;
  in_reply_to?: string;
  quoted_from: any;
  community_id: string;
  author_id: string;
  quotes: number;
  replies: number;
  retweets: number;
  views?: string;
  entities: Entities;
  user_info: UserInfo;
  media: any;
};

type Entities = {
  hashtags: any[];
  media?: Medum[];
  symbols: any[];
  timestamps: any[];
  urls: any[];
  user_mentions: UserMention[];
};

type Medum = {
  display_url: string;
  expanded_url: string;
  id_str: string;
  indices: number[];
  media_key: string;
  media_url_https: string;
  type: string;
  url: string;
  ext_media_availability: ExtMediaAvailability;
  media_results: MediaResults;
  source_status_id_str?: string;
  source_user_id_str?: string;
  additional_media_info?: AdditionalMediaInfo;
  video_info?: VideoInfo;
  allow_download_status?: AllowDownloadStatus;
};

type ExtMediaAvailability = {
  status: string;
};

type MediaResults = {
  result: Result;
};

type Result = {
  media_key: string;
};

type AdditionalMediaInfo = {
  monetizable: boolean;
  source_user?: SourceUser;
};

type SourceUser = {
  user_results: UserResults;
};

type UserResults = {
  result: Result2;
};

type Result2 = {
  __typename: string;
  id: string;
  rest_id: string;
  affiliates_highlighted_label: any[];
  has_graduated_access: boolean;
  parody_commentary_fan_label: string;
  is_blue_verified: boolean;
  profile_image_shape: string;
  legacy: Legacy;
  professional: Professional;
  tipjar_settings: any[];
};

type Legacy = {
  following: boolean;
  can_dm: boolean;
  can_media_tag: boolean;
  created_at: string;
  default_profile: boolean;
  default_profile_image: boolean;
  description: string;
  fast_followers_count: number;
  favourites_count: number;
  followers_count: number;
  friends_count: number;
  has_custom_timelines: boolean;
  is_translator: boolean;
  listed_count: number;
  location: string;
  media_count: number;
  name: string;
  normal_followers_count: number;
  pinned_tweet_ids_str: string[];
  possibly_sensitive: boolean;
  profile_banner_url: string;
  profile_image_url_https: string;
  profile_interstitial_type: string;
  screen_name: string;
  statuses_count: number;
  translator_type: string;
  url: string;
  verified: boolean;
  want_retweets: boolean;
  withheld_in_countries: any[];
};

type Professional = {
  rest_id: string;
  professional_type: string;
  category: any[];
};

type VideoInfo = {
  aspect_ratio: number[];
  duration_millis?: number;
  variants: Variant[];
};

type Variant = {
  bitrate?: number;
  content_type: string;
  url: string;
};

type AllowDownloadStatus = {
  allow_download: boolean;
};

type UserMention = {
  id_str: string;
  name: string;
  screen_name: string;
  indices: number[];
};

type UserInfo = {
  id: string;
  screen_name: string;
  verified: boolean;
  protected: any;
  pinned_tweet_id?: string;
  name: string;
  withheld: any[];
  description: string;
  location: string;
  followers_count: number;
  favourites_count: number;
  profile_image_url: any;
  friends_count: number;
  created_at: string;
};

export type searchTwitterRes = {
  text: string;
  created_at: string;

  views: string | undefined;
  favorites: number;
  retweets: number;
  replies: number;

  // Author information
  author: {
    name: string;
    screen_name: string;
    followers_count: number;
    description: string;
  };
};

// Searches for content on Twitter with specified query and search type
export async function searchTwitter(
  query: string,
  searchType = 'Top'
): Promise<searchTwitterRes[]> {
  const options = {
    method: 'GET',
    url: 'https://twitter-api45.p.rapidapi.com/search.php',
    params: {
      query,
      search_type: searchType
    },
    headers: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': TWITTER_API_HOST
    }
  };

  const response = await axios.request<SearchAPIRes>(options).catch((error) => {
    console.error('Twitter API Error:', error.message);
    throw error;
  });

  if (!response || !response.data) {
    console.error('Twitter API Search Error: No response data');
    return [];
  }

  // Extract and process tweet data
  if (!response.data.timeline) {
    console.error('Twitter API Search Error: No tweet data');
    return [];
  }

  let res: searchTwitterRes[] = response.data.timeline.map((tweet) => ({
    text: tweet.text, // Tweet content
    created_at: new Date(tweet.created_at).toLocaleString('en-US', { hour12: false }) + ' UTC', // Published time, format: 2025/2/25 14:41:14 UTC

    // Engagement data
    views: tweet.views, // View count
    favorites: tweet.favorites, // Like count
    retweets: tweet.retweets, // Retweet count
    replies: tweet.replies, // Reply count

    // Author information
    author: {
      name: tweet.user_info.name,
      screen_name: tweet.user_info.screen_name,
      followers_count: tweet.user_info.followers_count,
      description: tweet.user_info.description
    }
  }));

  return res;
}

type TimeLineAPIRes = {
  pinned: Pinned;
  timeline: Timeline[];
  next_cursor: string;
  prev_cursor: string;
  status: string;
  user: User;
};

type Pinned = {
  tweet_id: string;
  bookmarks: number;
  created_at: string;
  favorites: number;
  text: string;
  lang: string;
  source: string;
  views: string;
  quotes: number;
  replies: number;
  retweets: number;
  conversation_id: string;
  media: any[];
  author: Author;
};

type Author = {
  rest_id: string;
  name: string;
  screen_name: string;
  avatar: string;
  blue_verified: boolean;
};

type User = {
  status: string;
  profile: string;
  rest_id: string;
  blue_verified: boolean;
  business_account: any[];
  avatar: string;
  header_image: string;
  desc: string;
  name: string;
  protected: any;
  location: string;
  friends: number;
  sub_count: number;
  statuses_count: number;
  media_count: number;
  created_at: string;
  pinned_tweet_ids_str: string[];
  id: string;
};

export type UserTimelineRes = {
  user: {
    name: string;
    screen_name: string;
    verified: boolean;
    description: string;
    followers_count: number;
  };
  tweets: UserTimelineTweet[];
};

export type UserTimelineTweet = {
  text: string;
  created_at: string;
  views: string | undefined;
  favorites: number;
  retweets: number;
  replies: number;
  isPinned: boolean;
};

// Retrieves a Twitter user's timeline by screen name
export async function getUserTimeline(screenName: string): Promise<UserTimelineRes> {
  const options = {
    method: 'GET',
    url: 'https://twitter-api45.p.rapidapi.com/timeline.php',
    params: {
      screenname: screenName
    },
    headers: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': TWITTER_API_HOST
    }
  };

  const response = await axios.request<TimeLineAPIRes>(options).catch((error) => {
    console.error('Twitter API Error:', error.message);
    throw error;
  });

  if (!response || !response.data) {
    console.error('Twitter API Timeline Error: No response data');
    throw new Error('no data found');
  }

  // Organize data structure
  let result: UserTimelineRes = {
    user: {
      name: response.data.user?.name,
      screen_name: screenName,
      verified: response.data.user?.blue_verified,
      description: response.data.user?.desc,
      followers_count: response.data.user?.sub_count
    },
    tweets: []
  };

  // Add pinned tweet (if exists)
  if (response.data.pinned) {
    result.tweets.push({
      text: response.data.pinned.text,
      created_at:
        new Date(response.data.pinned.created_at).toLocaleString('en-US', { hour12: false }) +
        ' UTC',
      views: response.data.pinned.views,
      favorites: response.data.pinned.favorites,
      retweets: response.data.pinned.retweets,
      replies: response.data.pinned.replies,
      isPinned: true
    });
  }

  // Add timeline tweets
  if (response.data.timeline && Array.isArray(response.data.timeline)) {
    response.data.timeline.forEach((tweet) => {
      result.tweets.push({
        text: tweet.text,
        created_at: new Date(tweet.created_at).toLocaleString('en-US', { hour12: false }) + ' UTC',
        views: tweet.views,
        favorites: tweet.favorites,
        retweets: tweet.retweets,
        replies: tweet.replies,
        isPinned: false
      });
    });
  }

  return result;
}
