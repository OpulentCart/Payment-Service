const redis = require('redis');

const redisClient = redis.createClient({
    url: 'redis://127.0.0.1:6379'
});


redisClient.on('connect', () => console.log('🔗 Connected to Redis'));
redisClient.on('error', (err) => console.error('❌ Redis Error:', err));

(async () => {
    await redisClient.connect(); // Required for Redis v4+
})();
  
module.exports = redisClient;