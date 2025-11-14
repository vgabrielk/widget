# User Profile Cache Strategy

## 📋 Problema

A cada recarregamento de página, era necessário:
1. Buscar dados do usuário da tabela `profiles`
2. Buscar URL do avatar do storage
3. Gerar signed URLs para avatares

Isso resultava em múltiplas requisições desnecessárias e impacto no desempenho.

## ✅ Solução Implementada

### 1. **React Context com Cache Inteligente**

```typescript
// lib/contexts/user-context.tsx
UserProvider + useUser() hook
```

**Benefícios:**
- ✅ Estado global compartilhado entre componentes
- ✅ Cache em `localStorage` com expiração de 5 minutos
- ✅ Invalidação automática de cache ao atualizar perfil
- ✅ Carregamento otimista (cache-first, then fetch)

### 2. **Estratégia de Cache em Camadas**

#### **Camada 1: Memória (React State)**
- Dados sempre disponíveis durante a sessão
- Acesso instantâneo sem I/O
- Limpo ao desmontar o componente

#### **Camada 2: LocalStorage**
- Persiste entre recarregamentos
- TTL de 5 minutos (configurável)
- Timestamp para validação

#### **Camada 3: Supabase Database**
- Fonte da verdade
- Fetch em background após cache hit
- Atualiza cache com dados frescos

```
┌─────────────────────────────────────────┐
│         1. Page Load                    │
│  Check React State (empty on first)    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      2. Check LocalStorage              │
│  ✅ Hit: Load instantly + fetch fresh   │
│  ❌ Miss: Fetch from database           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    3. Fetch from Supabase (if needed)   │
│  Update React State + LocalStorage      │
└─────────────────────────────────────────┘
```

### 3. **Storage de Avatares**

**Bucket Público (`avatars`):**
- ✅ Sem necessidade de signed URLs
- ✅ URLs diretas (sem expiração)
- ✅ RLS policies para upload/delete
- ✅ Limite de 5MB por arquivo
- ✅ Formatos: JPEG, PNG, WEBP, GIF

**Estrutura:**
```
avatars/
  └── {user-id}/
      └── avatar-{timestamp}.{ext}
```

**Segurança via RLS:**
```sql
-- Qualquer um pode visualizar (bucket público)
CREATE POLICY "Users can view all avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Apenas o dono pode fazer upload/update/delete
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 4. **Hook de Uso**

```typescript
import { useUser } from '@/lib/contexts/user-context';

function MyComponent() {
  const { user, profile, loading, updateProfile, uploadAvatar } = useUser();
  
  // Dados já estão disponíveis (com cache)
  console.log(profile.full_name);
  console.log(profile.avatar_path);
  
  // Atualizar perfil
  await updateProfile({ full_name: 'João Silva' });
  
  // Upload de avatar
  await uploadAvatar(file);
}
```

## 🚀 Performance

### Antes (Sem Cache)
```
Page Load:
  - Fetch profile: ~200ms
  - Generate signed URL: ~150ms
  - Total: ~350ms por página

10 páginas/dia = ~3.5 segundos perdidos
```

### Depois (Com Cache)
```
Page Load (Cache Hit):
  - Load from localStorage: ~5ms
  - Background refresh: ~200ms (não bloqueia UI)
  - Total perceptível: ~5ms

10 páginas/dia = ~50ms (70x mais rápido!)
```

## 🔒 Segurança

### ✅ Seguro para Cache
- `full_name` - Informação pública do usuário
- `company_name` - Informação pública
- `avatar_path` - Caminho relativo no bucket `avatars`
- `email` - Já disponível em `auth.user`

### ❌ NÃO Cacheado
- Tokens de autenticação (gerenciados pelo Supabase)
- Dados sensíveis de pagamento
- Informações privadas de outros usuários

### Invalidação de Cache

**Automática:**
- Logout (`SIGNED_OUT` event)
- Expiração por TTL (5 minutos)
- Atualização de perfil

**Manual:**
```typescript
const { refreshProfile } = useUser();
await refreshProfile(); // Força busca do banco
```

## 📦 Estrutura de Arquivos

```
lib/
  └── contexts/
      └── user-context.tsx         # Provider + Hook

app/
  ├── (saas)/
  │   ├── layout.tsx               # UserProvider wrapper
  │   └── dashboard/
  │       └── settings/
  │           └── page.tsx         # Avatar upload UI
  └── api/
      └── user/
          └── delete/
              └── route.ts         # Delete account endpoint

supabase/
  └── migrations/
      └── 015_setup_avatar_storage.sql  # Storage bucket + RLS
```

## 🔄 Fluxo de Upload de Avatar

```typescript
1. User selects file
   ↓
2. Client-side validation
   - File type (JPEG, PNG, WEBP, GIF)
   - File size (max 5MB)
   ↓
3. Delete old avatar (if exists)
   ↓
4. Upload to storage
   - Path: {user-id}/avatar-{timestamp}.{ext}
   ↓
5. Update profile.avatar_path in database
   ↓
6. Invalidate cache + save new data
   ↓
7. UI updates automatically (React State)
```

## 📊 Métricas de Cache

**Cache Hit Rate:**
- Target: >90% após aquecimento
- Measured via: localStorage reads vs DB fetches

**Cache Freshness:**
- TTL: 5 minutos (300 segundos)
- Background refresh: Sim (após cache hit)

**Storage Usage:**
- Profile data: ~500 bytes
- Timestamp: 8 bytes
- Total: <1KB por usuário

## 🧪 Testes Recomendados

1. **Cache Hit:**
   - Load página 2x seguidas
   - Verificar que DB fetch acontece apenas 1x

2. **Cache Expiration:**
   - Load página
   - Aguardar 6 minutos
   - Reload → deve buscar do DB

3. **Cache Invalidation:**
   - Update profile
   - Verificar que cache foi atualizado

4. **Avatar Upload:**
   - Upload arquivo 5MB+  → deve falhar
   - Upload PDF → deve falhar
   - Upload PNG <5MB → deve funcionar

## 🔮 Melhorias Futuras

1. **Service Worker:**
   - Cache de avatares offline
   - Sync em background

2. **Redis:**
   - Cache server-side para APIs
   - Shared cache entre usuários (dados públicos)

3. **CDN:**
   - Distribuir avatares globalmente
   - Edge caching automático

4. **Image Optimization:**
   - Resize automático no upload
   - WebP conversion
   - Progressive loading

## 📚 Referências

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [React Context Best Practices](https://react.dev/reference/react/useContext)
- [localStorage Performance](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Cache Invalidation Strategies](https://martin.kleppmann.com/2016/05/24/making-sense-of-stream-processing.html)

