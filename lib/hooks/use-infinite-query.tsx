'use client'

import { createClient } from '@/lib/supabase/client'
import { PostgrestQueryBuilder, type PostgrestClientOptions } from '@supabase/postgrest-js'
import { type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useSyncExternalStore } from 'react'

const supabase = createClient()

// The following types are used to make the hook type-safe. It extracts the database type from the supabase client.
type SupabaseClientType = typeof supabase

// Utility type to check if the type is any
type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

// Extracts the database type from the supabase client. If the supabase client doesn't have a type, it will fallback properly.
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

// Change this to the database schema you want to use
type DatabaseSchema = Database['public']

// Extracts the table names from the database type
type SupabaseTableName = keyof DatabaseSchema['Tables']

// Extracts the table definition from the database type
type SupabaseTableData<T extends SupabaseTableName> = DatabaseSchema['Tables'][T]['Row']

// Default client options for PostgrestQueryBuilder
type DefaultClientOptions = PostgrestClientOptions

type SupabaseSelectBuilder<T extends SupabaseTableName> = ReturnType<
  PostgrestQueryBuilder<
    DefaultClientOptions,
    DatabaseSchema,
    DatabaseSchema['Tables'][T],
    T
  >['select']
>

// A function that modifies the query. Can be used to sort, filter, etc. If .range is used, it will be overwritten.
type SupabaseQueryHandler<T extends SupabaseTableName> = (
  query: SupabaseSelectBuilder<T>
) => SupabaseSelectBuilder<T>

interface UseInfiniteQueryProps<T extends SupabaseTableName, Query extends string = '*'> {
  // The table name to query
  tableName: T
  // The columns to select, defaults to `*`
  columns?: string
  // The number of items to fetch per page, defaults to `20`
  pageSize?: number
  // A function that modifies the query. Can be used to sort, filter, etc. If .range is used, it will be overwritten.
  trailingQuery?: SupabaseQueryHandler<T>
  // Optional key to force reset when dependencies change
  queryKey?: string
}

interface StoreState<TData> {
  data: TData[]
  count: number
  isSuccess: boolean
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  hasInitialFetch: boolean
}

type Listener = () => void

function createStore<TData extends SupabaseTableData<T>, T extends SupabaseTableName>(
  props: UseInfiniteQueryProps<T>
) {
  const { tableName, columns = '*', pageSize = 20, trailingQuery } = props

  let state: StoreState<TData> = {
    data: [],
    count: 0,
    isSuccess: false,
    isLoading: false,
    isFetching: false,
    error: null,
    hasInitialFetch: false,
  }

  const listeners = new Set<Listener>()

  const notify = () => {
    listeners.forEach((listener) => listener())
  }

  const setState = (newState: Partial<StoreState<TData>>) => {
    state = { ...state, ...newState }
    notify()
  }

  const fetchPage = async (skip: number) => {
    console.log('📥 [STORE] fetchPage called', { 
      skip, 
      tableName,
      isFetching: state.isFetching, 
      hasInitialFetch: state.hasInitialFetch,
      count: state.count,
      dataLength: state.data.length 
    })
    
    // CRITICAL: If isFetching is stuck, force reset it
    if (state.isFetching) {
      console.warn('⚠️ [STORE] isFetching is already true! Forcing reset...')
      setState({ isFetching: false })
      // Small delay to ensure state update
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    // If we already have all data, don't fetch more
    if (state.hasInitialFetch && state.count > 0 && state.count <= state.data.length) {
      console.log('⏸️ [STORE] Already have all data, skipping...', { count: state.count, dataLength: state.data.length })
      return
    }

    setState({ isFetching: true })
    console.log('✅ [STORE] Set isFetching = true')

    try {
      console.log('🔍 [STORE] Building query...')
      let query = supabase
        .from(tableName)
        .select(columns, { count: 'exact' }) as unknown as SupabaseSelectBuilder<T>

      if (trailingQuery) {
        console.log('🔧 [STORE] Applying trailingQuery...')
        query = trailingQuery(query)
      }
      
      console.log('🌐 [STORE] Executing query...', { skip, pageSize })
      const { data: newData, count, error } = await query.range(skip, skip + pageSize - 1)
      
      console.log('📨 [STORE] Query response received', { 
        hasData: !!newData, 
        dataLength: newData?.length,
        count,
        hasError: !!error 
      })

      if (error) {
        console.error('❌ [STORE] Query error:', error)
        setState({ error, isFetching: false })
      } else {
        console.log('✅ [STORE] Query success', { 
          received: newData?.length || 0, 
          totalCount: count,
          newTotalData: state.data.length + (newData?.length || 0)
        })
        setState({
          data: [...state.data, ...(newData as TData[])],
          count: count || 0,
          isSuccess: true,
          error: null,
          isFetching: false
        })
      }
    } catch (err) {
      console.error('❌ [STORE] Fetch page error:', err)
      setState({ error: err as Error, isFetching: false })
    } finally {
      console.log('🏁 [STORE] fetchPage FINALLY - ensuring isFetching=false')
      // Double-check to ensure it's false
      if (state.isFetching) {
        console.warn('⚠️ [STORE] isFetching still true in finally! Forcing false...')
        setState({ isFetching: false })
      }
    }
  }

  const fetchNextPage = async () => {
    console.log('➡️ [STORE] fetchNextPage called', { 
      isFetching: state.isFetching, 
      currentDataLength: state.data.length 
    })
    if (state.isFetching) {
      console.log('⏸️ [STORE] fetchNextPage: Already fetching, skipping')
      return
    }
    await fetchPage(state.data.length)
  }

  const initialize = async () => {
    console.log('🎬 [STORE] Initialize START', { tableName, hasInitialFetch: state.hasInitialFetch })
    try {
      setState({ isLoading: true, isSuccess: false, data: [] })
      console.log('🎬 [STORE] Calling fetchNextPage...')
      await fetchNextPage()
      console.log('✅ [STORE] fetchNextPage completed')
    } catch (err) {
      console.error('❌ [STORE] Initialize error:', err)
      setState({ error: err as Error })
    } finally {
      // CRITICAL: Always set hasInitialFetch to true to prevent infinite loops
      console.log('🏁 [STORE] Initialize FINALLY - setting hasInitialFetch=true')
      setState({ isLoading: false, hasInitialFetch: true })
    }
  }
  
  const reset = async () => {
    try {
      setState({ 
        isLoading: true, 
        isSuccess: false, 
        data: [], 
        count: 0,
        error: null,
        hasInitialFetch: false,
        isFetching: false
      })
      await fetchNextPage()
    } catch (err) {
      console.error('Reset error:', err)
      setState({ error: err as Error })
    } finally {
      setState({ isLoading: false, hasInitialFetch: true })
    }
  }

  return {
    getState: () => state,
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    fetchNextPage,
    initialize,
    reset,
  }
}

// Empty initial state to avoid hydration errors.
const initialState: any = {
  data: [],
  count: 0,
  isSuccess: false,
  isLoading: false,
  isFetching: false,
  error: null,
  hasInitialFetch: false,
}

function useInfiniteQuery<
  TData extends SupabaseTableData<T>,
  T extends SupabaseTableName = SupabaseTableName,
>(props: UseInfiniteQueryProps<T>) {
  const { tableName, columns, pageSize, queryKey } = props
  
  console.log('🔄 [HOOK] useInfiniteQuery render', { tableName, queryKey })
  
  // Create store only once - avoid recreating during render
  const storeRef = useRef(createStore<TData, T>(props))
  const prevQueryKeyRef = useRef(queryKey)
  const isInitializedRef = useRef(false)

  const state = useSyncExternalStore(
    storeRef.current.subscribe,
    () => storeRef.current.getState(),
    () => initialState as StoreState<TData>
  )
  
  console.log('📊 [HOOK] Current state', { 
    tableName,
    queryKey,
    isLoading: state.isLoading, 
    isFetching: state.isFetching,
    hasInitialFetch: state.hasInitialFetch,
    dataCount: state.data.length,
    totalCount: state.count,
    isInitializedRef: isInitializedRef.current
  })
  
  // Initialize once, or reset when queryKey changes
  useEffect(() => {
    console.log('🚀 [HOOK] useEffect RUNNING!', { 
      tableName, 
      queryKey, 
      prevQueryKey: prevQueryKeyRef.current,
      hasInitialFetch: storeRef.current.getState().hasInitialFetch,
      isInitializedRef: isInitializedRef.current
    })
    
    if (typeof window === 'undefined') {
      console.log('⏸️ [HOOK] Server-side, skipping...')
      return
    }

    // If queryKey changed, recreate store and reset
    if (prevQueryKeyRef.current !== queryKey) {
      console.log('🔄 [HOOK] QueryKey changed! Recreating store...', {
        from: prevQueryKeyRef.current,
        to: queryKey
      })
      prevQueryKeyRef.current = queryKey
      storeRef.current = createStore<TData, T>(props)
      isInitializedRef.current = false
    }

    // Only initialize if not already initialized
    if (!isInitializedRef.current) {
      console.log('🎬 [HOOK] First time initialization - calling store.initialize()...')
      isInitializedRef.current = true
      storeRef.current.initialize()
    } else {
      console.log('⏭️ [HOOK] Already initialized, skipping...')
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, columns, pageSize, queryKey])

  return {
    data: state.data,
    count: state.count,
    isSuccess: state.isSuccess,
    isLoading: state.isLoading,
    isFetching: state.isFetching,
    error: state.error,
    hasMore: state.count > state.data.length,
    fetchNextPage: storeRef.current.fetchNextPage,
  }
}

export {
  useInfiniteQuery,
  type SupabaseQueryHandler,
  type SupabaseTableData,
  type SupabaseTableName,
  type UseInfiniteQueryProps,
}

