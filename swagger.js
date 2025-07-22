const swaggerAutogen = require('swagger-autogen')({ 
  openapi: '3.0.0', 
  autoBody: false,
  autoHeaders: false,
  autoQuery: false,
  autoResponse: false
})

const outputFile = './swagger.json'
const endpointsFiles = ['./src/routes.js']

const doc = {
  info: {
    title: 'WhatsApp API - OTIMIZADA',
    description: 'API Wrapper for WhatsAppWebJS - **OTIMIZADA** com endpoints de grupos 20x mais rápidos'
  },
  servers: [
    {
      url: '',
      description: ''
    },
    {
      url: 'http://localhost:3000',
      description: 'localhost'
    }
  ],
  securityDefinitions: {
    apiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key'
    }
  },
  produces: ['application/json'],
  tags: [
    {
      name: 'Session',
      description: 'Handling multiple sessions logic, creation and deletion'
    },
    {
      name: 'Client',
      description: 'All functions related to the client'
    },
    {
      name: 'Message',
      description: 'May fail if the message is too old (Only from the last 100 Messages of the given chat)'
    },
    {
      name: 'Contact',
      description: 'Contact and group management functions - **OTIMIZADAS** para performance 20x melhor'
    }
  ],
  definitions: {
    StartSessionResponse: {
      success: true,
      message: 'Session initiated successfully'
    },
    StatusSessionResponse: {
      success: true,
      state: 'CONNECTED',
      message: 'session_connected'
    },
    RestartSessionResponse: {
      success: true,
      message: 'Restarted successfully'
    },
    TerminateSessionResponse: {
      success: true,
      message: 'Logged out successfully'
    },
    TerminateSessionsResponse: {
      success: true,
      message: 'Flush completed successfully'
    },
    ErrorResponse: {
      success: false,
      error: 'Some server error'
    },
    NotFoundResponse: {
      success: false,
      error: 'Some server error'
    },
    ForbiddenResponse: {
      success: false,
      error: 'Invalid API key'
    },
    ActiveGroupsResponse: {
      success: true,
      userPhoneNumber: '5511999999999',
      result: [
        {
          id: '123456789@g.us',
          name: 'Nome do Grupo',
          subject: 'Nome do Grupo',
          owner: 'unknown',
          createdAt: null,
          description: null,
          picture: null,
          announcementOnly: false,
          restrictInfo: false,
          participantCount: 0,
          participants: [],
          myRole: {
            isAdmin: false,
            isSuperAdmin: false
          },
          canIMessage: true,
          hasMetadata: false,
          loadedFromCache: true,
          number: '123456789',
          shortName: 'Grupo',
          isWAContact: true,
          isMyContact: false
        }
      ],
      metadata: {
        totalContacts: 150,
        totalGroups: 25,
        processingTimeMs: 45,
        method: 'contacts-optimized',
        performance: 'excellent'
      }
    },
    ActiveGroupsBasicResponse: {
      success: true,
      userPhoneNumber: '5511999999999',
      result: [
        {
          id: '123456789@g.us',
          name: 'Nome do Grupo',
          participantCount: 0,
          isAdmin: false,
          isGroup: true
        }
      ],
      metadata: {
        processingTimeMs: 30,
        totalGroups: 25,
        method: 'contacts-basic-optimized'
      }
    },
    ActiveGroupsMinimalResponse: {
      success: true,
      userPhoneNumber: '5511999999999',
      result: [
        {
          id: '123456789@g.us',
          name: 'Nome do Grupo',
          participants: []
        }
      ]
    }
  }
}

swaggerAutogen(outputFile, endpointsFiles, doc)
