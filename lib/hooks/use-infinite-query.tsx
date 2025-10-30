'use client'

import { createClient } from '@/lib/supabase/client'
import { PostgrestQueryBuilder, type PostgrestClientOptions } from '@supabase/postgrest-js'
import { type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useSyncExternalStore } from 'react'

const supabase = createClient()

/* ---------- Tipagens base ---------- */

type SupabaseClientType = typeof supabase

// Utility type para detectar `any`
type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N

// Extrai o tipo do Database do SupabaseClient (se existir), senão usa fallback genérico
type Database =
  SupabaseClientType extends SupabaseClient<infer U>
    ? IfAny<
        U,
        {
          public: {
            Tables: Record<string, any>
            Views: Record<string, any>
            Functions: Record<string, any>
          }
        },
        U
      >
    : {
        public: {
          Tables: Record<string, any>
          Views: Record<string, any>
          Functions: Record<string, any>
        }
      }

// Schema público (muito usado)
type DatabaseSchema = Database['public']

// Table names / table row types
type SupabaseTableName = keyof DatabaseSchema['Tables']
type SupabaseTableData<T extends SupabaseTableName> = DatabaseSchema['Tables'][T]['Row']

type DefaultClientOptions = PostgrestClientOptions

type SupabaseSelectBuilder<T extends SupabaseTableName> = ReturnType<
  PostgrestQueryBuilder<
    DefaultClientOptions,
    DatabaseSchema,
    DatabaseSchema['Tables'][T],
    T
  >['select']
>

type SupabaseQueryHandler<T extends SupabaseTableName> = (
  query: SupabaseSelectBuilder<T>
) => SupabaseSelectBuilder<T>

interface UseInfiniteQueryProps<T extends SupabaseTableName> {
  tableName: T
  columns?: string
  pageSize?: number
  trailingQuery?: SupabaseQueryHandler<T>
  queryKey?: string
}

interface StoreState<TData> {
  data: TData[]
  count: number
  isLoading: boolean
  isFetching: boolean
  isSuccess: boolean
  error: Error | null
}

type Listener = () => void

/* ---------- Criador do store ---------- */

function createStore<TData extends SupabaseTableData<T>, T extends SupabaseTableName>(
  props: UseInfiniteQueryProps<T>,
) {
  const { tableName, columns = '*', pageSize = 20, trailingQuery } = props

  let state: StoreState<TData> = {
    data: [],
    count: 0,
    isLoading: false,
    isFetching: false,
    isSuccess: false,
    error: null,
  }

  const listeners = new Set<Listener>()
  const notify = () => listeners.forEach(l => l())
  const setState = (partial: Partial<StoreState<TData>>) => {
    state = { ...state, ...partial }
    notify()
  }

  const fetchPage = async (from: number) => {
    if (state.isFetching) return
    setState({ isFetching: true })

    let query = supabase
      .from(tableName)
      .select(columns, { count: 'exact' }) as unknown as SupabaseSelectBuilder<T>

    if (trailingQuery) query = trailingQuery(query)

    const { data, count, error } = await query.range(from, from + pageSize - 1)

    if (error) {
      console.error('❌ Supabase query error:', error)
      setState({ error, isFetching: false })
      return
    }

    setState({
      data: [...state.data, ...(data as TData[])],
      count: count ?? state.count,
      isFetching: false,
      isSuccess: true,
      error: null,
    })
  }

  const initialize = async () => {
    if (state.isLoading || state.isFetching) return
    setState({ isLoading: true, data: [], count: 0 })
    await fetchPage(0)
    setState({ isLoading: false })
  }

  const fetchNextPage = async () => {
    if (state.isFetching) return
    // if count is 0 it means unknown total; allow first fetch (count default 0)
    if (state.count > 0 && state.data.length >= state.count) return
    await fetchPage(state.data.length)
  }

  const reset = async () => {
    setState({ data: [], count: 0, isSuccess: false, error: null })
    await initialize()
  }

  return {
    getState: () => state,
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    initialize,
    fetchNextPage,
    reset,
  }
}

/* ---------- Hook principal ---------- */

const initialState = {
  data: [],
  count: 0,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  error: null,
} as unknown as StoreState<any>

export function useInfiniteQuery<
  TData extends SupabaseTableData<T>,
  T extends SupabaseTableName = SupabaseTableName,
>(props: UseInfiniteQueryProps<T>) {
  const { queryKey } = props
  const prevKey = useRef<string | undefined>(queryKey)
  // createStore pode depender de props; criar só uma vez aqui com props iniciais
  const storeRef = useRef(createStore<TData, T>(props))

  // recria store quando queryKey muda (executado durante render, mas de forma segura)
  if (prevKey.current !== queryKey) {
    prevKey.current = queryKey
    // recria com as props atuais
    storeRef.current = createStore<TData, T>(props)
  }

  const state = useSyncExternalStore(
    storeRef.current.subscribe,
    () => storeRef.current.getState(),
    () => initialState as StoreState<TData>,
  )

  useEffect(() => {
    // inicializa apenas se não estiver carregando / sem sucesso
    if (!state.isSuccess && !state.isLoading) {
      storeRef.current.initialize()
    }
    // queremos re-run quando queryKey muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  return {
    ...state,
    hasMore: state.data.length < state.count,
    fetchNextPage: storeRef.current.fetchNextPage,
    reset: storeRef.current.reset,
  }
}
