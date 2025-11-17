import { Ratelimit } from "@upstash/ratelimit"; // for deno: see above
import { Redis } from "@upstash/redis"; // see below for cloudflare and fastly adapters

// Lazy initialization - only create Redis/Ratelimit when KV is available
let redis: Redis | null = null;
let _authRateLimit: Ratelimit | null = null;
let _signUpRateLimit: Ratelimit | null = null;

function getRedis(): Redis {
  if (!redis) {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error(
        "Please link a Vercel KV instance or populate `KV_REST_API_URL` and `KV_REST_API_TOKEN`",
      );
    }
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return redis;
}

function getAuthRateLimit(): Ratelimit {
  if (!_authRateLimit) {
    _authRateLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "ratelimit:auth",
    });
  }
  return _authRateLimit;
}

function getSignUpRateLimit(): Ratelimit {
  if (!_signUpRateLimit) {
    _signUpRateLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(1, "15 m"),
      analytics: true,
      prefix: "ratelimit:signup",
    });
  }
  return _signUpRateLimit;
}

// Export getters that will throw only when actually used
export const authRateLimit = {
  limit: async (identifier: string) => {
    return getAuthRateLimit().limit(identifier);
  },
};

export const signUpRateLimit = {
  limit: async (identifier: string) => {
    return getSignUpRateLimit().limit(identifier);
  },
};
