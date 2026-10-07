import type { Config } from '../config.js';

export interface DatabaseSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface DatabasePoolSettings extends DatabaseSettings {
  connectionLimit: number;
  connectTimeout: number;
  multipleStatements: boolean;
}

export function loadDatabaseSettings(config: Config): DatabasePoolSettings {
  return {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectionLimit: 5,
    connectTimeout: 3000,
    multipleStatements: true,
  };
}