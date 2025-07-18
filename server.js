const app = require('./src/app')
const { baseWebhookURL, serverTimeout } = require('./src/config')
require('dotenv').config()

// Start the server
const port = process.env.PORT || 3000

// Check if BASE_WEBHOOK_URL environment variable is available
if (!baseWebhookURL) {
  console.error('BASE_WEBHOOK_URL environment variable is not available. Exiting...')
  process.exit(1) // Terminate the application with an error code
}

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

// Configure server timeout settings
server.timeout = serverTimeout // Use configured timeout
server.keepAliveTimeout = 65000 // Keep-alive timeout
server.headersTimeout = 66000 // Headers timeout

module.exports = server
