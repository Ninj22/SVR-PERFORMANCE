import { randomInt } from 'node:crypto'

// Short, URL-safe IDs for share links, e.g. "k3P9xQ2a".
// 62^8 ≈ 218 trillion combinations; the database's UNIQUE constraint catches the rare clash.
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export const makeSlug = (length = 8) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
