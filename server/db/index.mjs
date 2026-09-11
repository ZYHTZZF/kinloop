import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DB_PATH } from '../config.mjs'
import { initializeSchema } from './schema.mjs'
import { seedDatabase } from './seed.mjs'

let database

export function getDatabase() {
  if (database) {
    return database
  }

  mkdirSync(dirname(DB_PATH), { recursive: true })
  database = new DatabaseSync(DB_PATH)
  database.exec('pragma journal_mode = WAL;')
  initializeSchema(database)
  seedDatabase(database)
  return database
}
