require('./routes')
const { restoreSessions } = require('./sessions')
const { routes } = require('./routes')
const app = require('express')()
const bodyParser = require('body-parser')
const { maxAttachmentSize, serverTimeout } = require('./config')

// Initialize Express app
app.disable('x-powered-by')

// Configure timeout settings
app.use((req, res, next) => {
  // Set timeout to configured value (default 3 minutes)
  req.setTimeout(serverTimeout)
  res.setTimeout(serverTimeout)
  next()
})

app.use(bodyParser.json({ limit: maxAttachmentSize + 1000000 }))
app.use(bodyParser.urlencoded({ limit: maxAttachmentSize + 1000000, extended: true }))
app.use('/', routes)

// Only restore sessions if RECOVER_SESSIONS is enabled
const { recoverSessions } = require('./config')
if (recoverSessions) {
  restoreSessions()
} else {
  console.log('Session recovery disabled. Existing sessions will not be restored automatically.')
}

module.exports = app
