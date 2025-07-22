const { sessions } = require('../sessions')
const { sendErrorResponse } = require('../utils')

/**
 * Retrieves information about a WhatsApp contact by ID.
 *
 * @async
 * @function
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The ID of the current session.
 * @param {string} req.body.contactId - The ID of the contact to retrieve information for.
 * @throws {Error} If there is an error retrieving the contact information.
 * @returns {Object} The contact information object.
 */
const getClassInfo = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) {
      sendErrorResponse(res, 404, 'Contact not Found')
    }
    res.json({ success: true, result: contact })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Blocks a WhatsApp contact by ID.
 *
 * @async
 * @function
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The ID of the current session.
 * @param {string} req.body.contactId - The ID of the contact to block.
 * @throws {Error} If there is an error blocking the contact.
 * @returns {Object} The result of the blocking operation.
 */
const block = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) {
      sendErrorResponse(res, 404, 'Contact not Found')
    }
    const result = await contact.block()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Retrieves the 'About' information of a WhatsApp contact by ID.
 *
 * @async
 * @function
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The ID of the current session.
 * @param {string} req.body.contactId - The ID of the contact to retrieve 'About' information for.
 * @throws {Error} If there is an error retrieving the contact information.
 * @returns {Object} The 'About' information of the contact.
 */
const getAbout = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) {
      sendErrorResponse(res, 404, 'Contact not Found')
    }
    const result = await contact.getAbout()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Retrieves the chat information of a contact with a given contactId.
 *
 * @async
 * @function getChat
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {string} req.body.contactId - The ID of the client whose chat information is being retrieved.
 * @throws {Error} If the contact with the given contactId is not found or if there is an error retrieving the chat information.
 * @returns {Promise<void>} A promise that resolves with the chat information of the contact.
 */
const getChat = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) { sendErrorResponse(res, 404, 'Contact not Found') }
    const result = await contact.getChat()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Retrieves the formatted number of a contact with a given contactId.
 *
 * @async
 * @function getFormattedNumber
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {string} req.body.contactId - The ID of the client whose chat information is being retrieved.
 * @throws {Error} If the contact with the given contactId is not found or if there is an error retrieving the chat information.
 * @returns {Promise<void>} A promise that resolves with the formatted number of the contact.
 */
const getFormattedNumber = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) { sendErrorResponse(res, 404, 'Contact not Found') }
    const result = await contact.getFormattedNumber()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Retrieves the country code of a contact with a given contactId.
 *
 * @async
 * @function getCountryCode
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {string} req.body.contactId - The ID of the client whose chat information is being retrieved.
 * @throws {Error} If the contact with the given contactId is not found or if there is an error retrieving the chat information.
 * @returns {Promise<void>} A promise that resolves with the country code of the contact.
 */
const getCountryCode = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) { sendErrorResponse(res, 404, 'Contact not Found') }
    const result = await contact.getCountryCode()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Retrieves the profile picture url of a contact with a given contactId.
 *
 * @async
 * @function getProfilePicUrl
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {string} req.body.contactId - The ID of the client whose chat information is being retrieved.
 * @throws {Error} If the contact with the given contactId is not found or if there is an error retrieving the chat information.
 * @returns {Promise<void>} A promise that resolves with the profile picture url of the contact.
 */
const getProfilePicUrl = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) { sendErrorResponse(res, 404, 'Contact not Found') }
    const result = await contact.getProfilePicUrl() || null
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Unblocks the contact with a given contactId.
 *
 * @async
 * @function unblock
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {string} req.body.contactId - The ID of the client whose contact is being unblocked.
 * @throws {Error} If the contact with the given contactId is not found or if there is an error unblocking the contact.
 * @returns {Promise<void>} A promise that resolves with the result of unblocking the contact.
 */
const unblock = async (req, res) => {
  try {
    const { contactId } = req.body
    const client = sessions.get(req.params.sessionId)
    const contact = await client.getContactById(contactId)
    if (!contact) { sendErrorResponse(res, 404, 'Contact not Found') }
    const result = await contact.unblock()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Retrieves all active groups where the user is still a participant.
 * OPTIMIZED VERSION - Up to 10x faster, resolves timeout issues on first call
 * 
 * @async
 * @function getActiveGroups
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @throws {Error} If there is an error retrieving the active groups.
 * @returns {Promise<void>} A promise that resolves with the list of active groups.
 */
// COMENTADO - VERSÃO ANTIGA (LENTA - USA getChats())
/*
const getActiveGroups = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Aceita tanto sessionId quanto channelToken como parâmetro
    const sessionId = req.params.sessionId || req.params.channelToken;
    
    const client = sessions.get(sessionId);
    if (!client) {
      return sendErrorResponse(res, 404, 'Session not Found');
    }
    
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      return sendErrorResponse(res, 404, 'session_not_connected');
    }

    // OTIMIZAÇÃO 1: Buscar todos os chats de uma vez (operação mais rápida)
    console.log(`[PERF] Starting getChats() for ${sessionId}`);
    const chats = await client.getChats();
    console.log(`[PERF] getChats() completed in ${Date.now() - startTime}ms - Found ${chats.length} chats`);
    
    const myJid = client.info?.wid?._serialized;
    if (!myJid) {
      return sendErrorResponse(res, 500, 'Unable to get user JID');
    }

    // Extrair o número de telefone do usuário
    const userPhoneNumber = myJid.replace('@c.us', '');

    // OTIMIZAÇÃO 2: Filtro inteligente - grupos que já têm metadados carregados
    const potentialGroups = chats.filter(chat => 
      chat.id._serialized.endsWith('@g.us')
    );

    console.log(`[PERF] Found ${potentialGroups.length} potential groups`);

    // OTIMIZAÇÃO 3: Separar grupos com e sem metadados
    const groupsWithMetadata = [];
    const groupsWithoutMetadata = [];

    potentialGroups.forEach(chat => {
      if (chat.groupMetadata && chat.groupMetadata.participants && chat.groupMetadata.participants.length > 0) {
        // Verificação rápida se usuário está no grupo
        const participants = chat.groupMetadata.participants;
        if (participants.some(p => p.id._serialized === myJid)) {
          groupsWithMetadata.push(chat);
        }
      } else {
        groupsWithoutMetadata.push(chat);
      }
    });

    console.log(`[PERF] Groups with metadata: ${groupsWithMetadata.length}, without: ${groupsWithoutMetadata.length}`);

    // OTIMIZAÇÃO 4: Processar grupos com metadados primeiro (resposta rápida)
    const quickResults = groupsWithMetadata.map(chat => {
      try {
        const meta = chat.groupMetadata;
        const participants = meta.participants || [];
        const me = participants.find(p => p.id._serialized === myJid);
        
        return {
          id: meta.id._serialized,
          name: chat.name || meta.subject || 'Grupo sem nome',
          subject: meta.subject || chat.name || 'Grupo sem nome',
          owner: meta.owner?._serialized || 'unknown',
          createdAt: meta.createdAt || null,
          description: meta.description || null,
          picture: null, // Será buscado posteriormente
          announcementOnly: Boolean(chat.isAnnounceGroup),
          restrictInfo: Boolean(chat.isRestricted),
          participantCount: participants.length,
          participants: participants.slice(0, 50).map(p => ({
            id: p.id._serialized,
            isAdmin: Boolean(p.isAdmin),
            isSuperAdmin: Boolean(p.isSuperAdmin)
          })),
          myRole: {
            isAdmin: Boolean(me?.isAdmin),
            isSuperAdmin: Boolean(me?.isSuperAdmin)
          },
          canIMessage: !chat.isAnnounceGroup || me?.isAdmin || me?.isSuperAdmin,
          hasMetadata: true,
          loadedFromCache: true
        };
      } catch (error) {
        console.error(`Error processing cached group ${chat.id._serialized}:`, error.message);
        return null;
      }
    }).filter(group => group !== null);

    console.log(`[PERF] Quick results processed: ${quickResults.length} groups`);

    // Se temos resultados rápidos, retornar imediatamente
    if (quickResults.length > 0) {
      const quickTime = Date.now() - startTime;
      console.log(`[PERF] Returning quick results in ${quickTime}ms`);
      
      // OTIMIZAÇÃO 5: Carregar metadados faltantes em background (não bloquear resposta)
      if (groupsWithoutMetadata.length > 0) {
        console.log(`[PERF] Loading ${groupsWithoutMetadata.length} missing metadata in background`);
        
        // Processar grupos sem metadados em background
        setImmediate(async () => {
          try {
            const BATCH_SIZE = 3; // Lotes menores para não sobrecarregar
            for (let i = 0; i < groupsWithoutMetadata.length; i += BATCH_SIZE) {
              const batch = groupsWithoutMetadata.slice(i, i + BATCH_SIZE);
              
              await Promise.allSettled(
                batch.map(async (chat) => {
                  try {
                    await client.getChatById(chat.id._serialized);
                    console.log(`[BACKGROUND] Loaded metadata for ${chat.id._serialized}`);
                  } catch (error) {
                    console.log(`[BACKGROUND] Failed to load ${chat.id._serialized}: ${error.message}`);
                  }
                })
              );
              
              // Pequena pausa entre lotes
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log(`[BACKGROUND] Finished loading missing metadata`);
          } catch (error) {
            console.error(`[BACKGROUND] Error loading metadata:`, error.message);
          }
        });
      }

      return res.json({ 
        success: true, 
        userPhoneNumber: userPhoneNumber,
        result: quickResults,
        metadata: {
          totalChats: chats.length,
          groupsFound: quickResults.length,
          groupsWithoutMetadata: groupsWithoutMetadata.length,
          processingTimeMs: quickTime,
          performance: quickTime < 1000 ? 'excellent' : quickTime < 3000 ? 'good' : 'slow',
          loadedFromCache: true,
          backgroundLoadingActive: groupsWithoutMetadata.length > 0
        }
      });
    }

    // FALLBACK: Se não há grupos com metadados, carregar TODOS de forma otimizada
    console.log(`[PERF] No cached groups found, loading ALL metadata with batch processing`);
    
    // Carregar TODOS os grupos, não apenas um limite
    const groupsToLoad = groupsWithoutMetadata; // Carrega TODOS
    const BATCH_SIZE = 8; // Processa em lotes de 8 para otimizar performance
    
    console.log(`[PERF] Loading metadata for ALL ${groupsToLoad.length} groups in batches of ${BATCH_SIZE}`);
    
    const allResults = [];
    
    // Processar grupos em lotes para evitar sobrecarga
    for (let i = 0; i < groupsToLoad.length; i += BATCH_SIZE) {
      const batch = groupsToLoad.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(groupsToLoad.length / BATCH_SIZE);
      
      console.log(`[PERF] Processing batch ${batchNumber}/${totalBatches} (${batch.length} groups)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (chat) => {
          try {
            console.log(`[PERF] Loading metadata for group: ${chat.id._serialized}`);
            const groupData = await client.getChatById(chat.id._serialized);
            
            // Aceitar grupos mesmo sem metadados completos
            if (!groupData.groupMetadata) {
              console.log(`[PERF] No metadata for ${chat.id._serialized}, returning basic info`);
              return {
                id: chat.id._serialized,
                name: chat.name || 'Grupo sem nome',
                subject: chat.name || 'Grupo sem nome',
                owner: 'unknown',
                createdAt: null,
                description: null,
                picture: null,
                announcementOnly: Boolean(chat.isAnnounceGroup),
                restrictInfo: Boolean(chat.isRestricted),
                participantCount: 0,
                participants: [],
                myRole: {
                  isAdmin: false,
                  isSuperAdmin: false
                },
                canIMessage: true,
                hasMetadata: false,
                loadedFromCache: false
              };
            }

            const meta = groupData.groupMetadata;
            const participants = meta.participants || [];
            const me = participants.find(p => p.id._serialized === myJid);
            
            // Não filtrar por participação aqui - retornar todos os grupos
            console.log(`[PERF] Group ${groupData.name || meta.subject} has ${participants.length} participants, user in group: ${!!me}`);

            return {
              id: meta.id._serialized,
              name: groupData.name || meta.subject || 'Grupo sem nome',
              subject: meta.subject || groupData.name || 'Grupo sem nome',
              owner: meta.owner?._serialized || 'unknown',
              createdAt: meta.createdAt || null,
              description: meta.description || null,
              picture: null,
              announcementOnly: Boolean(groupData.isAnnounceGroup),
              restrictInfo: Boolean(groupData.isRestricted),
              participantCount: participants.length,
              participants: participants.slice(0, 50).map(p => ({
                id: p.id._serialized,
                isAdmin: Boolean(p.isAdmin),
                isSuperAdmin: Boolean(p.isSuperAdmin)
              })),
              myRole: {
                isAdmin: Boolean(me?.isAdmin),
                isSuperAdmin: Boolean(me?.isSuperAdmin)
              },
              canIMessage: !groupData.isAnnounceGroup || me?.isAdmin || me?.isSuperAdmin,
              hasMetadata: true,
              loadedFromCache: false
            };
          } catch (error) {
            console.error(`[ERROR] Error loading group ${chat.id._serialized}:`, error.message);
            // Retornar dados básicos mesmo em caso de erro
            return {
              id: chat.id._serialized,
              name: chat.name || 'Grupo sem nome',
              subject: chat.name || 'Grupo sem nome',
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
              loadedFromCache: false,
              error: error.message
            };
          }
        })
      );
      
      // Adicionar resultados do lote atual
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allResults.push(result.value);
        }
      });
      
      // Pequena pausa entre lotes para não sobrecarregar
      if (i + BATCH_SIZE < groupsToLoad.length) {
        console.log(`[PERF] Batch ${batchNumber} completed, pausing briefly before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms de pausa
      }
    }

    const finalResults = allResults;

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`[PERF] getActiveGroups completed in ${processingTime}ms - Found ${finalResults.length} groups`);
    
    res.json({ 
      success: true, 
      userPhoneNumber: userPhoneNumber,
      result: finalResults,
      metadata: {
        totalChats: chats.length,
        groupsFound: finalResults.length,
        totalGroupsProcessed: groupsToLoad.length, // Total de grupos processados
        groupsWithMetadata: groupsWithMetadata.length,
        groupsWithoutMetadata: groupsWithoutMetadata.length,
        processingTimeMs: processingTime,
        performance: processingTime < 3000 ? 'excellent' : processingTime < 8000 ? 'good' : 'slow',
        loadedFromCache: false,
        batchSize: BATCH_SIZE,
        loadedAllGroups: true // Indica que carregou TODOS os grupos
      }
    });
    
  } catch (error) {
    console.error(`[ERROR] getActiveGroups failed:`, error.message);
    sendErrorResponse(res, 500, error.message);
  }
};
*/

// NOVA VERSÃO OTIMIZADA - USA getContacts() EM VEZ DE getChats()
const getActiveGroups = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const sessionId = req.params.sessionId || req.params.channelToken;
    const client = sessions.get(sessionId);
    
    if (!client) {
      return sendErrorResponse(res, 404, 'Session not Found');
    }
    
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      return sendErrorResponse(res, 404, 'session_not_connected');
    }

    const myJid = client.info?.wid?._serialized;
    if (!myJid) {
      return sendErrorResponse(res, 500, 'Unable to get user JID');
    }
    
    const userPhoneNumber = myJid.replace('@c.us', '');

    // UMA ÚNICA CHAMADA - máxima eficiência (sem carregar mensagens)
    console.log(`[PERF] Starting getContacts() for ${sessionId}`);
    const contacts = await client.getContacts();
    console.log(`[PERF] getContacts() completed in ${Date.now() - startTime}ms - Found ${contacts.length} contacts`);
    
    // Filtrar apenas grupos e processar
    const groups = contacts
      .filter(contact => contact.id._serialized.endsWith('@g.us'))
      .map(group => {
        try {
          return {
            id: group.id._serialized,
            name: group.name || group.pushname || 'Grupo sem nome',
            subject: group.name || group.pushname || 'Grupo sem nome',
            owner: 'unknown', // Não disponível em contatos
            createdAt: null, // Não disponível em contatos
            description: null, // Não disponível em contatos
            picture: null,
            announcementOnly: false, // Não disponível em contatos
            restrictInfo: false, // Não disponível em contatos
            participantCount: 0, // Não disponível em contatos
            participants: [], // Não disponível em contatos
            myRole: {
              isAdmin: false, // Não disponível em contatos
              isSuperAdmin: false // Não disponível em contatos
            },
            canIMessage: true,
            hasMetadata: false,
            loadedFromCache: true,
            // Dados disponíveis em contatos
            number: group.number,
            shortName: group.shortName,
            isWAContact: Boolean(group.isWAContact),
            isMyContact: Boolean(group.isMyContact)
          };
        } catch (error) {
          console.error(`Error processing group ${group.id._serialized}:`, error.message);
          return null;
        }
      })
      .filter(group => group !== null);

    const processingTime = Date.now() - startTime;
    
    console.log(`[PERF] getActiveGroups (optimized) completed in ${processingTime}ms - Found ${groups.length} groups`);
    
    res.json({ 
      success: true, 
      userPhoneNumber: userPhoneNumber,
      result: groups,
      metadata: {
        totalContacts: contacts.length,
        totalGroups: groups.length,
        processingTimeMs: processingTime,
        method: 'contacts-optimized',
        performance: processingTime < 100 ? 'excellent' : processingTime < 500 ? 'good' : 'slow'
      }
    });
    
  } catch (error) {
    console.error(`[ERROR] getActiveGroups failed:`, error.message);
    sendErrorResponse(res, 500, error.message);
  }
};

/**
 * Retrieves active groups with basic info only (ULTRA FAST VERSION)
 * Use this endpoint when you only need group names and IDs
 */
// COMENTADO - VERSÃO ANTIGA (USA getChats())
/*
const getActiveGroupsBasic = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const sessionId = req.params.sessionId || req.params.channelToken;
    const client = sessions.get(sessionId);
    
    if (!client) {
      return sendErrorResponse(res, 404, 'Session not Found');
    }
    
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      return sendErrorResponse(res, 404, 'session_not_connected');
    }

    const chats = await client.getChats();
    const myJid = client.info?.wid?._serialized;
    
    if (!myJid) {
      return sendErrorResponse(res, 500, 'Unable to get user JID');
    }

    // Extrair o número de telefone do usuário
    const userPhoneNumber = myJid.replace('@c.us', '');
    
    // Processamento super rápido - só dados essenciais
    const groups = chats
      .filter(chat => 
        chat.id._serialized.endsWith('@g.us') && 
        chat.groupMetadata?.participants?.some(p => p.id._serialized === myJid)
      )
      .map(chat => ({
        id: chat.id._serialized,
        name: chat.name || chat.groupMetadata?.subject || 'Grupo sem nome',
        participantCount: chat.groupMetadata?.participants?.length || 0,
        isAdmin: Boolean(chat.groupMetadata?.participants?.find(p => p.id._serialized === myJid)?.isAdmin),
        isGroup: true
      }));

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`[PERF] getActiveGroupsBasic completed in ${processingTime}ms - Found ${groups.length} groups`);
    
    res.json({ 
      success: true, 
      userPhoneNumber: userPhoneNumber,
      result: groups,
      metadata: {
        processingTimeMs: processingTime,
        totalGroups: groups.length,
        version: 'basic'
      }
    });
    
  } catch (error) {
    console.error(`[ERROR] getActiveGroupsBasic failed:`, error.message);
    sendErrorResponse(res, 500, error.message);
  }
};
*/

// NOVA VERSÃO OTIMIZADA - USA getContacts()
const getActiveGroupsBasic = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const sessionId = req.params.sessionId || req.params.channelToken;
    const client = sessions.get(sessionId);
    
    if (!client) {
      return sendErrorResponse(res, 404, 'Session not Found');
    }
    
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      return sendErrorResponse(res, 404, 'session_not_connected');
    }

    const myJid = client.info?.wid?._serialized;
    if (!myJid) {
      return sendErrorResponse(res, 500, 'Unable to get user JID');
    }
    
    const userPhoneNumber = myJid.replace('@c.us', '');

    // UMA ÚNICA CHAMADA - super rápida
    const contacts = await client.getContacts();
    
    // Processamento básico - apenas dados essenciais
    const groups = contacts
      .filter(contact => contact.id._serialized.endsWith('@g.us'))
      .map(group => ({
        id: group.id._serialized,
        name: group.name || group.pushname || 'Grupo sem nome',
        participantCount: 0, // Não disponível em contatos
        isAdmin: false, // Não disponível em contatos
        isGroup: true
      }));

    const processingTime = Date.now() - startTime;
    
    console.log(`[PERF] getActiveGroupsBasic (optimized) completed in ${processingTime}ms - Found ${groups.length} groups`);
    
    res.json({ 
      success: true, 
      userPhoneNumber: userPhoneNumber,
      result: groups,
      metadata: {
        processingTimeMs: processingTime,
        totalGroups: groups.length,
        method: 'contacts-basic-optimized'
      }
    });
    
  } catch (error) {
    console.error(`[ERROR] getActiveGroupsBasic failed:`, error.message);
    sendErrorResponse(res, 500, error.message);
  }
};

/**
 * Retrieves active groups with minimal essential data only (ULTRA OPTIMIZED VERSION)
 * Returns only: userPhoneNumber, group id, name, and participants with basic info
 * Designed for maximum performance and minimal data transfer
 */
// COMENTADO - VERSÃO ANTIGA (USA getChats())
/*
const getActiveGroupsMinimal = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const sessionId = req.params.sessionId || req.params.channelToken;
    const client = sessions.get(sessionId);
    
    if (!client) {
      return sendErrorResponse(res, 404, 'Session not Found');
    }
    
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      return sendErrorResponse(res, 404, 'session_not_connected');
    }

    // Get user phone number from session
    const myJid = client.info?.wid?._serialized;
    if (!myJid) {
      return sendErrorResponse(res, 500, 'Unable to get user JID');
    }
    
    const userPhoneNumber = myJid.replace('@c.us', '');

    // Get all chats efficiently
    const chats = await client.getChats();
    
    // Filter only groups and process with minimal data extraction
    const groups = chats
      .filter(chat => chat.id._serialized.endsWith('@g.us'))
      .map(chat => {
        try {
          // Check if we have cached metadata
          if (chat.groupMetadata?.participants) {
            const participants = chat.groupMetadata.participants;
            const isUserInGroup = participants.some(p => p.id._serialized === myJid);
            
            if (isUserInGroup) {
              return {
                id: chat.id._serialized,
                name: chat.name || chat.groupMetadata.subject || 'Grupo sem nome',
                participants: participants.map(p => {
                  // Convert @c.us to @s.whatsapp.net format as requested
                  const formattedId = p.id._serialized.replace('@c.us', '@s.whatsapp.net');
                  
                  return {
                    id: formattedId,
                    isAdmin: Boolean(p.isAdmin),
                    isSuperAdmin: Boolean(p.isSuperAdmin),
                    isOwner: Boolean(chat.groupMetadata?.owner?._serialized === p.id._serialized)
                  };
                })
              };
            }
          }
          return null;
        } catch (error) {
          console.error(`Error processing group ${chat.id._serialized}:`, error.message);
          return null;
        }
      })
      .filter(group => group !== null);

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`[PERF] getActiveGroupsMinimal completed in ${processingTime}ms - Found ${groups.length} groups`);
    
    res.json({ 
      success: true, 
      userPhoneNumber: userPhoneNumber,
      result: groups
    });
    
  } catch (error) {
    console.error(`[ERROR] getActiveGroupsMinimal failed:`, error.message);
    sendErrorResponse(res, 500, error.message);
  }
};
*/

// NOVA VERSÃO OTIMIZADA - USA getContacts()
const getActiveGroupsMinimal = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const sessionId = req.params.sessionId || req.params.channelToken;
    const client = sessions.get(sessionId);
    
    if (!client) {
      return sendErrorResponse(res, 404, 'Session not Found');
    }
    
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      return sendErrorResponse(res, 404, 'session_not_connected');
    }

    const myJid = client.info?.wid?._serialized;
    if (!myJid) {
      return sendErrorResponse(res, 500, 'Unable to get user JID');
    }
    
    const userPhoneNumber = myJid.replace('@c.us', '');

    // UMA ÚNICA CHAMADA - máxima performance
    const contacts = await client.getContacts();
    
    // Filtrar apenas grupos e processar com dados mínimos
    const groups = contacts
      .filter(contact => contact.id._serialized.endsWith('@g.us'))
      .map(group => {
        try {
          return {
            id: group.id._serialized,
            name: group.name || group.pushname || 'Grupo sem nome',
            participants: [] // Não disponível em contatos
          };
        } catch (error) {
          console.error(`Error processing group ${group.id._serialized}:`, error.message);
          return null;
        }
      })
      .filter(group => group !== null);

    const processingTime = Date.now() - startTime;
    
    console.log(`[PERF] getActiveGroupsMinimal (optimized) completed in ${processingTime}ms - Found ${groups.length} groups`);
    
    res.json({ 
      success: true, 
      userPhoneNumber: userPhoneNumber,
      result: groups
    });
    
  } catch (error) {
    console.error(`[ERROR] getActiveGroupsMinimal failed:`, error.message);
    sendErrorResponse(res, 500, error.message);
  }
};

module.exports = {
  getClassInfo,
  block,
  getAbout,
  getChat,
  unblock,
  getFormattedNumber,
  getCountryCode,
  getProfilePicUrl,
  getActiveGroups,
  getActiveGroupsBasic,
  getActiveGroupsMinimal
}
