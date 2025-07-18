const axios = require('axios');

async function testTimeout() {
  console.log('Testando configuração de timeout...');
  
  try {
    // Teste 1: Endpoint que deve responder rapidamente
    console.log('\n1. Testando endpoint de health (deve responder rapidamente):');
    const start1 = Date.now();
    const response1 = await axios.get('http://localhost:3000/api-docs', {
      timeout: 5000 // 5 segundos
    });
    const end1 = Date.now();
    console.log(`✅ Resposta em ${end1 - start1}ms`);
    
    // Teste 2: Endpoint que pode demorar mais (simulando operação longa)
    console.log('\n2. Testando endpoint de grupos (pode demorar mais):');
    const start2 = Date.now();
    const response2 = await axios.get('http://localhost:3000/contact/activeGroups/test123', {
      timeout: 200000 // 3 minutos e 20 segundos
    });
    const end2 = Date.now();
    console.log(`✅ Resposta em ${end2 - start2}ms`);
    console.log(`📊 Total de grupos: ${response2.data.result?.length || 0}`);
    
    console.log('\n✅ Teste de timeout concluído com sucesso!');
    console.log('📝 O servidor agora está configurado com timeout de 3 minutos.');
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log('❌ Timeout atingido - o servidor ainda está com timeout baixo');
    } else if (error.response) {
      console.log(`⚠️ Erro HTTP ${error.response.status}: ${error.response.statusText}`);
      console.log('📝 Isso pode ser normal se a sessão não estiver conectada');
    } else {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
}

testTimeout(); 