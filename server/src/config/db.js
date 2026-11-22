require('dotenv').config();

/**
 * Two ways to reach SQL Server:
 *  - DB_USER / DB_PASSWORD set -> SQL authentication via the pure-JS "tedious"
 *    driver (Linux / Docker).
 *  - otherwise                 -> Windows Integrated Auth via msnodesqlv8 + ODBC
 *    (local Windows development).
 */
const useSqlAuth = Boolean(process.env.DB_USER);
const sql = useSqlAuth ? require('mssql') : require('mssql/msnodesqlv8');

const server = process.env.DB_SERVER || 'localhost';
const database = process.env.DB_DATABASE || 'expense_tracker';
const odbcDriver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server';

function buildConfig(dbName = database) {
  if (useSqlAuth) {
    const [host, instanceName] = server.split('\\');
    return {
      server: host,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : instanceName ? undefined : 1433,
      database: dbName,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        instanceName: instanceName || undefined,
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true,
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    };
  }
  return {
    connectionString: `Driver={${odbcDriver}};Server=${server};Database=${dbName};Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
  };
}

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig())
      .connect()
      .then((pool) => {
        console.log(`[db] connected to ${server} / ${database} (${useSqlAuth ? 'SQL auth' : 'Windows auth'})`);
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        console.error('[db] connection failed:', err.message);
        throw err;
      });
  }
  return poolPromise;
}

/** Runs `work(newRequest)` inside a SQL transaction; commits or rolls back. */
async function withTransaction(work) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await work(() => new sql.Request(tx));
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

module.exports = { sql, getPool, withTransaction, buildConfig, server, database, useSqlAuth };
