require('dotenv').config();
const sql = require('mssql/msnodesqlv8');

const server = process.env.DB_SERVER || 'DESKTOP-8IN7U4N\\SQLEXPRESS';
const database = process.env.DB_DATABASE || 'expense_tracker';

const config = {
  connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log(`[db] connected to ${server} / ${database}`);
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

module.exports = { sql, getPool };
