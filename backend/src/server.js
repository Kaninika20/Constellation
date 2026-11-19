import app from './app.js';
import { verifyConnection, closeDriver } from './config/neo4j.config.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Start Express HTTP Server
  const server = app.listen(PORT, async () => {
    console.log(`=======================================================`);
    console.log(` CampusGraph API Server running on port ${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Local URL: http://localhost:${PORT}`);
    console.log(`=======================================================`);

    // Verify Neo4j connectivity
    console.log('[Neo4j] Verifying database connectivity...');
    const dbStatus = await verifyConnection();

    if (dbStatus.connected) {
      console.log(`[Neo4j] ✅ Connection established successfully!`);
      console.log(`[Neo4j] Target: ${dbStatus.uri}`);
      console.log(`[Neo4j] Database: ${dbStatus.database}`);
      console.log(`[Neo4j] Server Version: ${dbStatus.serverVersion}`);
    } else {
      console.warn(`[Neo4j] ⚠️ Warning: Could not establish active connection to Neo4j.`);
      console.warn(`[Neo4j] Error: ${dbStatus.error}`);
      console.warn(`[Neo4j] Hint: ${dbStatus.hint}`);
      console.warn(`[Neo4j] Note: Backend started in degraded mode. Run 'docker compose up -d' or start Neo4j Desktop.`);
    }
  });

  // Graceful Shutdown
  const handleExit = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await closeDriver();
      console.log('[Server] Application terminated cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
};

startServer().catch((err) => {
  console.error('[Server] Fatal error on bootstrap:', err);
  process.exit(1);
});

