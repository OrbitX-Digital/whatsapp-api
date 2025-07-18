# Processo Detalhado da Rota `/contact/activeGroups/:sessionId`

## Visão Geral

Este documento explica passo a passo todo o processo que ocorre quando uma requisição é feita para a rota `/contact/activeGroups/:sessionId`, desde o momento em que a requisição chega ao servidor até a resposta ser retornada ao cliente.

## 1. Configuração da Rota

### 1.1 Definição da Rota
**Arquivo**: `src/routes.js` (linha 182-186)

```javascript
contactRouter.get(
  '/activeGroups/:sessionId',
  [middleware.sessionNameValidation, middleware.sessionValidation],
  contactController.getActiveGroups
)
```

**Explicação**:
- A rota é definida como `GET /contact/activeGroups/:sessionId`
- O parâmetro `:sessionId` é um placeholder que será substituído pelo valor real
- Dois middlewares são aplicados antes do controller: `sessionNameValidation` e `sessionValidation`
- O controller responsável é `contactController.getActiveGroups`

### 1.2 Estrutura do Router
**Arquivo**: `src/routes.js` (linha 161-165)

```javascript
const contactRouter = express.Router()
contactRouter.use(middleware.apikey)
sessionRouter.use(middleware.contactSwagger)
routes.use('/contact', contactRouter)
```

**Explicação**:
- Um router específico para rotas de contato é criado
- O middleware `apikey` é aplicado globalmente a todas as rotas de contato
- O middleware `contactSwagger` é aplicado para documentação
- O router é montado no caminho `/contact`

## 2. Processamento da Requisição

### 2.1 Middleware de API Key
**Arquivo**: `src/middleware.js` (linha 6-25)

```javascript
const apikey = async (req, res, next) => {
  if (globalApiKey) {
    const apiKey = req.headers['x-api-key']
    if (!apiKey || apiKey !== globalApiKey) {
      return sendErrorResponse(res, 403, 'Invalid API key')
    }
  }
  next()
}
```

**Processo**:
1. Verifica se existe uma `globalApiKey` configurada no sistema
2. Se existir, extrai o header `x-api-key` da requisição
3. Compara o valor do header com a `globalApiKey`
4. Se não coincidir, retorna erro 403 (Forbidden)
5. Se coincidir ou não houver API key configurada, chama `next()`

### 2.2 Middleware de Validação do Nome da Sessão
**Arquivo**: `src/middleware.js` (linha 27-45)

```javascript
const sessionNameValidation = async (req, res, next) => {
  if ((!/^[\w-]+$/.test(req.params.sessionId))) {
    return sendErrorResponse(res, 422, 'Session should be alphanumerical or -')
  }
  next()
}
```

**Processo**:
1. Extrai o parâmetro `sessionId` da URL da requisição
2. Aplica uma regex `/^[\w-]+$/` para validar o formato:
   - `^` - início da string
   - `[\w-]` - caracteres alfanuméricos (a-z, A-Z, 0-9, _) ou hífen (-)
   - `+` - um ou mais caracteres
   - `$` - fim da string
3. Se o formato não for válido, retorna erro 422 (Unprocessable Entity)
4. Se for válido, chama `next()`

### 2.3 Middleware de Validação da Sessão
**Arquivo**: `src/middleware.js` (linha 47-62)

```javascript
const sessionValidation = async (req, res, next) => {
  const validation = await validateSession(req.params.sessionId)
  if (validation.success !== true) {
    return sendErrorResponse(res, 404, validation.message)
  }
  next()
}
```

**Processo**:
1. Chama a função `validateSession` passando o `sessionId`
2. Aguarda o resultado da validação
3. Se `validation.success` não for `true`, retorna erro 404 (Not Found)
4. Se for válido, chama `next()`

## 3. Validação da Sessão (Detalhada)

### 3.1 Função validateSession
**Arquivo**: `src/sessions.js` (linha 9-50)

```javascript
const validateSession = async (sessionId) => {
  try {
    const returnData = { success: false, state: null, message: '' }

    // Session not Connected 😢
    if (!sessions.has(sessionId) || !sessions.get(sessionId)) {
      returnData.message = 'session_not_found'
      return returnData
    }

    const client = sessions.get(sessionId)
    // wait until the client is created
    await waitForNestedObject(client, 'pupPage')
      .catch((err) => { return { success: false, state: null, message: err.message } })

    // Wait for client.pupPage to be evaluable
    let maxRetry = 0
    while (true) {
      try {
        if (client.pupPage.isClosed()) {
          return { success: false, state: null, message: 'browser tab closed' }
        }
        await Promise.race([
          client.pupPage.evaluate('1'),
          new Promise(resolve => setTimeout(resolve, 1000))
        ])
        break
      } catch (error) {
        if (maxRetry === 2) {
          return { success: false, state: null, message: 'session closed' }
        }
        maxRetry++
      }
    }

    const state = await client.getState()
    returnData.state = state
    if (state !== 'CONNECTED') {
      returnData.message = 'session_not_connected'
      return returnData
    }

    // Session Connected 🎉
    returnData.success = true
    returnData.message = 'session_connected'
    return returnData
  } catch (error) {
    console.log(error)
    return { success: false, state: null, message: error.message }
  }
}
```

**Processo Detalhado**:

1. **Verificação de Existência**:
   - Verifica se a sessão existe no Map `sessions`
   - Se não existir, retorna `{ success: false, message: 'session_not_found' }`

2. **Obtenção do Cliente**:
   - Recupera o cliente WhatsApp da sessão: `sessions.get(sessionId)`

3. **Aguardar Criação do Cliente**:
   - Chama `waitForNestedObject(client, 'pupPage')` para aguardar que o cliente esteja pronto
   - Se falhar, retorna erro

4. **Verificação da Página do Browser**:
   - Verifica se a página do Puppeteer não está fechada
   - Se estiver fechada, retorna `{ success: false, message: 'browser tab closed' }`

5. **Teste de Responsividade**:
   - Tenta executar `client.pupPage.evaluate('1')` com timeout de 1 segundo
   - Se falhar 3 vezes, retorna `{ success: false, message: 'session closed' }`

6. **Verificação do Estado**:
   - Chama `client.getState()` para obter o estado atual da conexão
   - Se o estado não for `'CONNECTED'`, retorna `{ success: false, message: 'session_not_connected' }`

7. **Sucesso**:
   - Se tudo estiver OK, retorna `{ success: true, message: 'session_connected', state: 'CONNECTED' }`

## 4. Controller getActiveGroups

### 4.1 Função Principal
**Arquivo**: `src/controllers/contactController.js` (linha 181-255)

```javascript
const getActiveGroups = async (req, res) => {
  try {
    const client = sessions.get(req.params.sessionId);
    if (!client) {
      return sendErrorResponse(res, 404, 'Session not Found');
    }

    // 1 única chamada a todos os chats
    const chats = await client.getChats();
    const myJid = client.info.wid._serialized;

    // para cada chat de grupo, pega os metadados já carregados
    const groups = await Promise.all(
      chats
        .filter(chat => chat.isGroup && chat.groupMetadata)  // só grupos com metadados
        .map(async (chat) => {
          const meta = chat.groupMetadata;
          const participants = meta.participants || [];

          // só retorna se eu ainda estiver no grupo
          const me = participants.find(p => p.id._serialized === myJid);
          if (!me) return null;

          // foto do grupo (usa client, não chat)
          let picture = null;
          try {
            picture = await client.getProfilePicUrl(meta.id._serialized);
          } catch {}

          return {
            id:               meta.id._serialized,
            name:             chat.name || meta.subject,
            subject:          meta.subject,
            owner:            meta.owner?._serialized,
            createdAt:        meta.createdAt,
            description:      meta.description,
            picture,
            // regras
            announcementOnly: Boolean(chat.isAnnounceGroup), // só admin envia
            restrictInfo:     Boolean(chat.isRestricted),    // só admin altera
            participantCount: participants.length,
            participants: participants.map(p => ({
              id:           p.id._serialized,
              isAdmin:      p.isAdmin,
              isSuperAdmin: p.isSuperAdmin
            })),
            myRole: {
              isAdmin:      me.isAdmin,
              isSuperAdmin: me.isSuperAdmin
            },
            // posso enviar?
            canIMessage: !chat.isAnnounceGroup || me.isAdmin || me.isSuperAdmin
          };
        })
    );

    // filtra eventuais nulos (casos de saída do grupo)
    res.json({ success: true, result: groups.filter(g => g) });
  } catch (error) {
    sendErrorResponse(res, 500, error.message);
  }
};
```

### 4.2 Processo Detalhado do Controller

#### 4.2.1 Obtenção do Cliente
```javascript
const client = sessions.get(req.params.sessionId);
if (!client) {
  return sendErrorResponse(res, 404, 'Session not Found');
}
```
- Recupera o cliente WhatsApp da sessão
- Se não existir, retorna erro 404

#### 4.2.2 Obtenção de Todos os Chats
```javascript
const chats = await client.getChats();
const myJid = client.info.wid._serialized;
```
- Chama `client.getChats()` para obter todos os chats da sessão
- Obtém o JID (Jabber ID) do usuário atual: `client.info.wid._serialized`

#### 4.2.3 Filtragem e Processamento dos Grupos
```javascript
const groups = await Promise.all(
  chats
    .filter(chat => chat.isGroup && chat.groupMetadata)
    .map(async (chat) => {
      // processamento de cada grupo
    })
);
```

**Filtros aplicados**:
- `chat.isGroup`: apenas chats que são grupos
- `chat.groupMetadata`: apenas grupos que têm metadados carregados

#### 4.2.4 Processamento de Cada Grupo

Para cada grupo encontrado:

1. **Obtenção dos Metadados**:
   ```javascript
   const meta = chat.groupMetadata;
   const participants = meta.participants || [];
   ```

2. **Verificação de Participação**:
   ```javascript
   const me = participants.find(p => p.id._serialized === myJid);
   if (!me) return null;
   ```
   - Procura o usuário atual na lista de participantes
   - Se não encontrar, retorna `null` (usuário não está mais no grupo)

3. **Obtenção da Foto do Grupo**:
   ```javascript
   let picture = null;
   try {
     picture = await client.getProfilePicUrl(meta.id._serialized);
   } catch {}
   ```
   - Tenta obter a URL da foto do grupo
   - Se falhar, mantém `null`

4. **Construção do Objeto de Retorno**:
   ```javascript
   return {
     id:               meta.id._serialized,
     name:             chat.name || meta.subject,
     subject:          meta.subject,
     owner:            meta.owner?._serialized,
     createdAt:        meta.createdAt,
     description:      meta.description,
     picture,
     announcementOnly: Boolean(chat.isAnnounceGroup),
     restrictInfo:     Boolean(chat.isRestricted),
     participantCount: participants.length,
     participants: participants.map(p => ({
       id:           p.id._serialized,
       isAdmin:      p.isAdmin,
       isSuperAdmin: p.isSuperAdmin
     })),
     myRole: {
       isAdmin:      me.isAdmin,
       isSuperAdmin: me.isSuperAdmin
     },
     canIMessage: !chat.isAnnounceGroup || me.isAdmin || me.isSuperAdmin
   };
   ```

**Campos retornados**:
- `id`: ID único do grupo
- `name`: Nome do grupo (usa `chat.name` ou `meta.subject`)
- `subject`: Assunto do grupo
- `owner`: ID do proprietário do grupo
- `createdAt`: Data de criação
- `description`: Descrição do grupo
- `picture`: URL da foto do grupo
- `announcementOnly`: Se apenas admins podem enviar mensagens
- `restrictInfo`: Se apenas admins podem alterar informações
- `participantCount`: Número de participantes
- `participants`: Lista de participantes com suas funções
- `myRole`: Função do usuário atual no grupo
- `canIMessage`: Se o usuário pode enviar mensagens

#### 4.2.5 Filtragem Final e Resposta
```javascript
res.json({ success: true, result: groups.filter(g => g) });
```
- Filtra grupos `null` (usuário não participa mais)
- Retorna resposta JSON com sucesso e lista de grupos

## 5. Tratamento de Erros

### 5.1 Função sendErrorResponse
**Arquivo**: `src/utils.js` (função não mostrada no código, mas referenciada)

```javascript
const sendErrorResponse = (res, statusCode, message) => {
  res.status(statusCode).json({
    success: false,
    error: message
  });
};
```

### 5.2 Cenários de Erro

1. **API Key Inválida** (403):
   ```json
   {
     "success": false,
     "error": "Invalid API key"
   }
   ```

2. **SessionId Inválido** (422):
   ```json
   {
     "success": false,
     "error": "Session should be alphanumerical or -"
   }
   ```

3. **Sessão Não Encontrada** (404):
   ```json
   {
     "success": false,
     "error": "session_not_found"
   }
   ```

4. **Sessão Não Conectada** (404):
   ```json
   {
     "success": false,
     "error": "session_not_connected"
   }
   ```

5. **Erro Interno** (500):
   ```json
   {
     "success": false,
     "error": "Mensagem de erro específica"
   }
   ```

## 6. Exemplo de Requisição Completa

### 6.1 Requisição
```bash
GET /contact/activeGroups/session123
Headers:
  x-api-key: your-api-key-here
```

### 6.2 Resposta de Sucesso
```json
{
  "success": true,
  "result": [
    {
      "id": "123456789@group.us",
      "name": "Grupo de Desenvolvimento",
      "subject": "Grupo de Desenvolvimento",
      "owner": "987654321@c.us",
      "createdAt": "2023-01-15T10:30:00.000Z",
      "description": "Grupo para discussões sobre desenvolvimento",
      "picture": "https://pps.whatsapp.net/v/t61.24694-24/...",
      "announcementOnly": false,
      "restrictInfo": false,
      "participantCount": 5,
      "participants": [
        {
          "id": "987654321@c.us",
          "isAdmin": true,
          "isSuperAdmin": true
        },
        {
          "id": "111222333@c.us",
          "isAdmin": false,
          "isSuperAdmin": false
        }
      ],
      "myRole": {
        "isAdmin": false,
        "isSuperAdmin": false
      },
      "canIMessage": true
    }
  ]
}
```

## 7. Dependências e Imports

### 7.1 Arquivos Principais
- `src/routes.js`: Definição das rotas
- `src/middleware.js`: Middlewares de validação
- `src/controllers/contactController.js`: Lógica do controller
- `src/sessions.js`: Gerenciamento de sessões
- `src/utils.js`: Utilitários (sendErrorResponse)

### 7.2 Dependências Externas
- `express`: Framework web
- `whatsapp-web.js`: Biblioteca do WhatsApp Web
- `puppeteer`: Controle do browser

## 8. Considerações para Replicação

### 8.1 Estrutura Necessária
1. **Sistema de Sessões**: Map para armazenar clientes WhatsApp
2. **Validação de Sessão**: Função para verificar se a sessão está ativa
3. **Middleware de Validação**: Para API key e parâmetros
4. **Controller de Grupos**: Lógica para obter grupos ativos
5. **Tratamento de Erros**: Função para respostas de erro padronizadas

### 8.2 Pontos Críticos
1. **Validação de Sessão**: Deve verificar se o cliente está conectado
2. **Filtragem de Grupos**: Apenas grupos onde o usuário ainda participa
3. **Tratamento de Erros**: Capturar exceções da biblioteca WhatsApp
4. **Performance**: Usar `Promise.all` para processamento paralelo
5. **Segurança**: Validação de API key e parâmetros

### 8.3 Fluxo de Dados
1. Requisição HTTP → Middleware de API Key
2. Middleware de API Key → Middleware de Validação de Nome
3. Middleware de Validação de Nome → Middleware de Validação de Sessão
4. Middleware de Validação de Sessão → Controller
5. Controller → Cliente WhatsApp → Lista de Grupos
6. Controller → Processamento → Resposta JSON

Este processo garante que apenas sessões válidas e conectadas possam acessar os grupos ativos, mantendo a segurança e integridade do sistema. '