const redis = require('redis');

const redisClient = redis.createClient({
    url: process.env.UPSTASH_REDIS_URL,
    socket: {
        tls: true, // Ensure TLS (Upstash uses secure connections)
        rejectUnauthorized: false, // Accept self-signed certificates
    },
});


redisClient.on('connect', () => console.log('🔗 Connected to Redis'));
redisClient.on('error', (err) => console.error('❌ Redis Error:', err));

(async () => {
    await redisClient.connect(); // Required for Redis v4+
})();
  
module.exports = redisClient;