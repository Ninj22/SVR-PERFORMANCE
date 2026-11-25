import 'dotenv/config'
import { app } from './app.js'

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.')
    process.exit(1)
}

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
