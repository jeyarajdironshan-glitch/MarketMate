const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

let dbInstance = null;
let sqlJsInstance = null;
let dbType = process.env.DB_TYPE || 'sqlite'; // 'sqlite' or 'mysql'
let mysqlPool = null;

const dbFilePath = path.join(__dirname, '../../data/marketmate.sqlite');

/**
 * Persist SQLite database to disk
 */
function persistSqlite() {
  if (dbType === 'sqlite' && dbInstance) {
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(dbFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(dbFilePath, buffer);
    } catch (err) {
      console.error('[DB] Error persisting SQLite database to disk:', err.message);
    }
  }
}

/**
 * Initialize Database Connection
 */
async function initDatabase() {
  if (dbType === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'marketmate_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      // Test connection
      const [rows] = await mysqlPool.query('SELECT 1 as test');
      console.log('[DB] Connected successfully to MySQL database.');
      return;
    } catch (err) {
      console.warn('[DB] MySQL connection failed. Falling back to embedded SQLite storage:', err.message);
      dbType = 'sqlite';
    }
  }

  // SQLite (sql.js) mode
  sqlJsInstance = await initSqlJs();
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbFilePath)) {
    const filebuffer = fs.readFileSync(dbFilePath);
    dbInstance = new sqlJsInstance.Database(filebuffer);
    console.log('[DB] Loaded existing SQLite database from disk:', dbFilePath);
  } else {
    dbInstance = new sqlJsInstance.Database();
    console.log('[DB] Created fresh SQLite database instance.');
    persistSqlite();
  }
}

/**
 * Execute a query that returns multiple rows
 */
async function query(sql, params = []) {
  if (dbType === 'mysql' && mysqlPool) {
    const [rows] = await mysqlPool.query(sql, params);
    return rows;
  }

  // SQLite implementation
  try {
    const stmt = dbInstance.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error(`[DB Query Error] SQL: ${sql} | Params: ${JSON.stringify(params)} | Error: ${err.message}`);
    throw err;
  }
}

/**
 * Execute a query that returns a single row
 */
async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE query
 */
async function run(sql, params = []) {
  if (dbType === 'mysql' && mysqlPool) {
    const [result] = await mysqlPool.execute(sql, params);
    return {
      insertId: result.insertId,
      changes: result.affectedRows
    };
  }

  // SQLite implementation
  try {
    const stmt = dbInstance.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    stmt.step();
    stmt.free();

    // Get last insert row id and changes count
    const lastIdRes = dbInstance.exec('SELECT last_insert_rowid() as id, changes() as changes;');
    let insertId = 0;
    let changes = 0;
    if (lastIdRes.length > 0 && lastIdRes[0].values.length > 0) {
      insertId = lastIdRes[0].values[0][0];
      changes = lastIdRes[0].values[0][1];
    }

    // Auto persist changes
    persistSqlite();

    return { insertId, changes };
  } catch (err) {
    console.error(`[DB Run Error] SQL: ${sql} | Params: ${JSON.stringify(params)} | Error: ${err.message}`);
    throw err;
  }
}

/**
 * Run raw multi-statement DDL/DML script
 */
async function exec(sql) {
  if (dbType === 'mysql' && mysqlPool) {
    return await mysqlPool.query(sql);
  }

  dbInstance.run(sql);
  persistSqlite();
}

module.exports = {
  initDatabase,
  query,
  get,
  run,
  exec,
  getDbType: () => dbType,
  persistSqlite
};
