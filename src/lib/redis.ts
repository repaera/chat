import "server-only";

import Redis from "ioredis";

const redis = process.env.REDIS_URL
	? new Redis(process.env.REDIS_URL, {
			maxRetriesPerRequest: 3,
			lazyConnect: false,
		})
	: null;

if (redis) {
	redis.on("error", (err) => {
		console.error("[redis] connection error:", err);
	});
}

export { redis };
