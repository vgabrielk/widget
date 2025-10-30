# 🔒 Relatório de Auditoria de Segurança e Bugs
**Data:** 30/10/2025  
**Sistema:** Realtime Chat Widget

---

## 📋 Resumo Executivo

Análise completa do sistema de chat identificou **14 problemas críticos e importantes** que precisam ser corrigidos para garantir segurança, estabilidade e boa experiência do usuário.

**Severidade:**
- 🔴 **Crítico:** 5 problemas
- 🟠 **Alto:** 4 problemas  
- 🟡 **Médio:** 3 problemas
- 🟢 **Baixo:** 2 problemas

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. XSS (Cross-Site Scripting) no conteúdo das mensagens
**Arquivo:** `public/widget.js:484`  
**Severidade:** 🔴 CRÍTICO

**Problema:**
```javascript
content.textContent = message.content;
```

Embora use `textContent` (correto), o nome do remetente e outros campos podem conter HTML/scripts maliciosos que são renderizados diretamente:
```javascript
avatar.textContent = (message.sender_name || 'V').charAt(0).toUpperCase();
nameSpan.textContent = message.sender_name || 'Visitor';
```

**Ataque possível:**
Um visitante pode enviar `<script>alert('XSS')</script>` como nome ou email, e isso pode ser executado em outros lugares do sistema onde esses dados são renderizados.

**Solução:**
Sanitizar TODOS os inputs de usuário no backend antes de salvar no banco.

---

### 2. Falta de rate limiting no envio de mensagens
**Arquivo:** `public/widget.js`, `app/api/upload-image/route.ts`  
**Severidade:** 🔴 CRÍTICO

**Problema:**
Não há nenhum controle de taxa de envio de mensagens. Um atacante pode:
- Enviar milhares de mensagens por segundo
- Fazer spam de uploads de imagens
- Consumir todo o storage do Supabase
- Causar custos elevados
- Fazer DDoS no sistema

**Solução:**
Implementar rate limiting baseado em:
- IP address
- Visitor ID
- Room ID
- Timeframe (ex: máx 10 mensagens/minuto)

---

### 3. Validação de tamanho de arquivo apenas no frontend
**Arquivo:** `app/api/upload-image/route.ts:77`  
**Severidade:** 🔴 CRÍTICO

**Problema:**
```javascript
if (file.size > MAX_FILE_SIZE) {
```

A validação existe no backend, MAS um atacante pode:
1. Enviar arquivo gigante (> 5MB) antes da validação processar
2. Consumir memória do servidor
3. Causar lentidão/crash

**Problema adicional:** Não há validação do conteúdo real do arquivo (magic bytes). Um atacante pode renomear `malware.exe` para `image.jpg`.

**Solução:**
- Validar magic bytes do arquivo (verificar se realmente é imagem)
- Limitar tamanho no Nginx/CDN antes de chegar na aplicação
- Usar streaming para uploads grandes em vez de carregar tudo na memória

---

### 4. Public Key exposta no localStorage
**Arquivo:** `public/widget.js:1032`  
**Severidade:** 🔴 CRÍTICO (para privacidade)

**Problema:**
```javascript
const publicKey = window.ChatWidgetConfig?.publicKey || window.CHAT_WIDGET_PUBLIC_KEY;
```

Embora seja "public key", ela está sendo usada para identificar qual widget carregar. Se alguém pegar essa key, pode:
- Saber exatamente qual empresa/site usa o widget
- Criar widgets falsos em outros sites usando a mesma key
- Fazer scraping de todas as conversas (se houver falha RLS)

**Solução:**
- Adicionar verificação de domínio no backend (já existe, mas precisa ser obrigatória)
- Implementar assinatura/token temporário gerado pelo backend
- Rotação automática de keys

---

### 5. Falta de proteção contra CSRF no upload de imagem
**Arquivo:** `app/api/upload-image/route.ts`  
**Severidade:** 🔴 CRÍTICO

**Problema:**
Não há nenhum token CSRF. Um site malicioso pode fazer upload de imagens usando a sessão do usuário autenticado.

**Ataque possível:**
1. Vítima visita `malicious-site.com`
2. Site faz POST para `/api/upload-image` com imagem ofensiva
3. Imagem é salva como se fosse enviada pela vítima

**Solução:**
- Implementar CSRF tokens
- Verificar header `Origin` e `Referer` mais rigorosamente
- Usar SameSite cookies

---

## 🟠 PROBLEMAS DE ALTA SEVERIDADE

### 6. Memory leak em subscriptions do Realtime
**Arquivo:** `public/widget.js:243-290`  
**Severidade:** 🟠 ALTO

**Problema:**
```javascript
function subscribeToMessages() {
    if (messageChannel) {
        supabaseClient.removeChannel(messageChannel);
    }
    messageChannel = supabaseClient.channel(`room:${roomId}`)...
}
```

Se o usuário trocar de página SEM fechar o chat, os channels não são desinscritos. Isso causa:
- Memory leaks
- Conexões WebSocket abertas desnecessariamente
- Eventos duplicados

**Solução:**
```javascript
// Adicionar cleanup no beforeunload
window.addEventListener('beforeunload', () => {
    if (messageChannel) supabaseClient.removeChannel(messageChannel);
    if (roomStatusChannel) supabaseClient.removeChannel(roomStatusChannel);
});
```

---

### 7. Validação fraca de email
**Arquivo:** `public/widget.js:750`  
**Severidade:** 🟠 ALTO

**Problema:**
```html
<input type="email" id="chat-widget-visitor-email" required />
```

Usa validação HTML5 que é muito fraca. Aceita emails como:
- `a@b` (válido para HTML5, mas inválido)
- `test@localhost`
- `@domain.com`

**Solução:**
Adicionar validação Regex robusta:
```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
    alert('Email inválido');
    return;
}
```

---

### 8. Falta de limpeza de dados sensíveis no localStorage
**Arquivo:** `public/widget.js:39-46`  
**Severidade:** 🟠 ALTO

**Problema:**
```javascript
const STORAGE_KEYS = {
    VISITOR_ID: 'chat_visitor_id',
    VISITOR_NAME: 'chat_visitor_name',
    VISITOR_EMAIL: 'chat_visitor_email', // ⚠️ Email fica armazenado indefinidamente
    ROOM_ID: 'chat_room_id',
    ...
};
```

Dados sensíveis (email, nome) ficam armazenados no localStorage para sempre, mesmo depois do chat fechado.

**Problemas:**
- Violação de LGPD/GDPR
- Se alguém usar computador público, dados ficam expostos
- Não há expiração

**Solução:**
- Implementar expiração (ex: 24 horas)
- Limpar dados quando conversa é fechada
- Usar sessionStorage em vez de localStorage para dados sensíveis

---

### 9. Falta de tratamento para rooms duplicadas
**Arquivo:** `public/widget.js:135-217`  
**Severidade:** 🟠 ALTO

**Problema:**
```javascript
const { data: existingRooms } = await supabaseClient
    .from('rooms')
    .select('*')
    .eq('widget_id', widgetData.id)
    .eq('visitor_id', visitorId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);
```

Se houver race condition (usuário abre 2 abas ao mesmo tempo), podem ser criadas 2 rooms para o mesmo visitor.

**Solução:**
Criar constraint UNIQUE no banco:
```sql
CREATE UNIQUE INDEX idx_unique_open_room 
ON rooms(widget_id, visitor_id, status) 
WHERE status = 'open';
```

---

## 🟡 PROBLEMAS DE MÉDIA SEVERIDADE

### 10. Falta de timeout nas requisições
**Arquivo:** `public/widget.js:1041`  
**Severidade:** 🟡 MÉDIO

**Problema:**
```javascript
fetch(`${API_BASE}/api/widget/${publicKey}`)
```

Não há timeout. Se o servidor ficar lento, o widget fica carregando indefinidamente.

**Solução:**
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
```

---

### 11. Erro silencioso ao falhar criação de room
**Arquivo:** `public/widget.js:215-217`  
**Severidade:** 🟡 MÉDIO

**Problema:**
```javascript
} catch (error) {
    console.error('ChatWidget: Error initializing room:', error);
}
```

Se a criação da room falhar, o erro é apenas logado no console. O usuário não recebe feedback.

**Solução:**
Mostrar mensagem de erro amigável para o usuário.

---

### 12. Falta de validação de extensão de arquivo
**Arquivo:** `app/api/upload-image/route.ts:119`  
**Severidade:** 🟡 MÉDIO

**Problema:**
```javascript
const fileExt = file.name.split('.').pop() || 'jpg';
```

Se o arquivo se chamar `test.tar.gz.jpg`, a extensão extraída será `jpg`, mas o arquivo pode não ser uma imagem.

**Solução:**
Validar magic bytes e forçar extensão baseada no MIME type real.

---

## 🟢 PROBLEMAS DE BAIXA SEVERIDADE

### 13. Notificação de som pode falhar silenciosamente
**Arquivo:** `public/widget.js:574`  
**Severidade:** 🟢 BAIXO

**Problema:**
```javascript
notificationAudio.play().catch(err => {
    console.log('ChatWidget: Could not play notification sound:', err);
});
```

O erro é apenas logado. Poderia mostrar um ícone visual indicando que há nova mensagem.

**Solução:**
Adicionar fallback visual (animação, badge piscando, etc).

---

### 14. Falta de compressão de imagens
**Arquivo:** `app/api/upload-image/route.ts`  
**Severidade:** 🟢 BAIXO

**Problema:**
Imagens são enviadas e armazenadas no tamanho original. Uma foto de 5MB vai consumir 5MB de storage.

**Solução:**
Usar biblioteca como `sharp` para:
- Redimensionar imagens grandes (max 1920x1080)
- Comprimir para reduzir tamanho
- Converter para WebP

---

## 📊 Estatísticas

| Categoria | Quantidade |
|-----------|------------|
| XSS/Injection | 1 |
| Rate Limiting | 1 |
| Validação | 4 |
| Memory Leaks | 1 |
| LGPD/Privacy | 1 |
| UX/Feedback | 2 |
| Performance | 2 |
| CSRF | 1 |
| Timeout | 1 |

---

## 🎯 Prioridade de Correção

### Imediato (próximas 24h):
1. ✅ XSS - Sanitizar inputs
2. ✅ Rate limiting
3. ✅ Memory leaks - Cleanup de subscriptions

### Urgente (próxima semana):
4. ✅ Validação de arquivos (magic bytes)
5. ✅ CSRF protection
6. ✅ Constraint UNIQUE para rooms
7. ✅ Expiração de dados no localStorage

### Importante (próximo mês):
8. ✅ Timeouts em requisições
9. ✅ Feedback de erros ao usuário
10. ✅ Compressão de imagens
11. ✅ Validação robusta de email

---

## ✅ Pontos Positivos Encontrados

1. ✅ RLS policies bem configuradas
2. ✅ CORS implementado corretamente
3. ✅ Uso de `textContent` (previne XSS básico)
4. ✅ Validação de MIME types
5. ✅ Uso de service role apenas no backend
6. ✅ Estrutura de código organizada
7. ✅ Logs adequados para debug

---

**Próximo passo:** Implementar as correções por ordem de prioridade.

