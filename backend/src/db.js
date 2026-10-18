import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Support both standard DATABASE_URL (used by Render, Railway, Heroku, Aiven)
// and individual DB_HOST / DB_USER / DB_PASSWORD environment variables.
const dbConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: true,
      timezone: 'Z',
      ssl: process.env.DB_SSL === 'false' ? undefined : (process.env.DB_SSL === 'true' || process.env.DATABASE_URL.includes('ssl=') ? { rejectUnauthorized: false } : undefined)
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'barytes_management',
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: true,
      timezone: 'Z',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    };

export const pool = mysql.createPool(dbConfig);
