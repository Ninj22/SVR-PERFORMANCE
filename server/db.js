import pg from 'pg'

const { Pool } = pg

// One pool for the whole app. Hosted Postgres (Neon, Supabase, Render) needs SSL.
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
})

export const query = (text, params) => pool.query(text, params)
