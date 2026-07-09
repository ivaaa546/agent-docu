import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';

export const initDb = (dbPath: string = './local.db') => {
  const db = new Database(dbPath);
  sqliteVec.load(db);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
};

export const db = initDb();
