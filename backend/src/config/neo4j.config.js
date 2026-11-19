import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USERNAME || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'campusgraph_password';
const database = process.env.NEO4J_DATABASE || 'neo4j';

let driver;

/**
 * Initializes and returns the Neo4j driver singleton.
 */
export const getDriver = () => {
  if (!driver) {
    try {
      driver = neo4j.driver(
        uri,
        neo4j.auth.basic(user, password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 5000, // 5 seconds
          disableLosslessIntegers: true // automatically convert Neo4j integers to JS numbers
        }
      );
      console.log(`[Neo4j Config] Initialized driver targeting ${uri}`);
    } catch (error) {
      console.error('[Neo4j Config] Failed to create driver:', error.message);
      throw error;
    }
  }
  return driver;
};

/**
 * Opens a new Neo4j session on the configured database.
 */
export const getSession = (accessMode = neo4j.session.WRITE) => {
  const currentDriver = getDriver();
  return currentDriver.session({
    database,
    defaultAccessMode: accessMode
  });
};

/**
 * Verifies connectivity to the Neo4j database instance.
 * Returns detailed health object.
 */
export const verifyConnection = async () => {
  let session;
  try {
    session = getSession(neo4j.session.READ);
    const result = await session.run('RETURN 1 AS status, datetime() AS serverTime');
    const record = result.records[0];

    const serverInfo = await getDriver().getServerInfo();

    return {
      connected: true,
      uri,
      database,
      serverVersion: serverInfo.agent || 'Neo4j 5.x',
      serverAddress: serverInfo.address,
      serverTime: record.get('serverTime').toString()
    };
  } catch (error) {
    return {
      connected: false,
      uri,
      database,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      hint: 'Ensure Neo4j is running locally (e.g. docker compose up -d or Neo4j Desktop) or check credentials in backend/.env'
    };
  } finally {
    if (session) {
      await session.close();
    }
  }
};

/**
 * Closes the Neo4j driver during application shutdown.
 */
export const closeDriver = async () => {
  if (driver) {
    await driver.close();
    console.log('[Neo4j Config] Neo4j driver connection closed cleanly.');
  }
};

