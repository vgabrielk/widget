'use client'

import { useEffect, useRef, useSyncExternalStore, useState } from 'react'

interface UseInfiniteQueryApiProps {
  // API endpoint to fetch data from
  apiEndpoint: string
  // Query parameters to pass to the API
  queryParams?: Record<string, string>
  // Number of items per page
  pageSize?: number
  // Query key for cache invalidation
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

function createStore<TData>(props: UseInfiniteQueryApiProps) {
  const { apiEndpoint, queryParams = {}, pageSize = 20 } = props

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

    try {
      // Build query string with pagination
      const params = new URLSearchParams({
        ...queryParams,
        from: from.toString(),
        to: (from + pageSize - 1).toString(),
      })

      const response = await fetch(`${apiEndpoint}?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const result = await response.json()

      // API should return { data: TData[], count: number }
      const newData = result.data || result.rooms || result.contacts || []
      const count = result.count ?? newData.length
      
      // Only update count if we got a valid count from the API (not just data.length)
      // This ensures we use the total count from the database, not just the current page
      const finalCount = result.count !== undefined ? result.count : (state.count || newData.length)

      setState({
        data: [...state.data, ...(newData as TData[])],
        count: finalCount,
        isFetching: false,
        isSuccess: true,
        error: null,
      })
    } catch (err: any) {
      console.error('❌ API query error:', err)
      setState({ 
        error: err instanceof Error ? err : new Error(String(err)), 
        isFetching: false 
      })
    }
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

const initialState = {
  data: [],
  count: 0,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  error: null,
} as unknown as StoreState<any>

export function useInfiniteQueryApi<TData = any>(
  props: UseInfiniteQueryApiProps
) {
  const { queryKey } = props
  const prevKey = useRef<string | undefined>(queryKey)
  const storeRef = useRef(createStore<TData>(props))

  // Recreate store when queryKey or apiEndpoint changes
  if (prevKey.current !== queryKey) {
    prevKey.current = queryKey
    storeRef.current = createStore<TData>(props)
  }

  const state = useSyncExternalStore(
    storeRef.current.subscribe,
    () => storeRef.current.getState(),
    () => initialState as StoreState<TData>,
  )

  useEffect(() => {
    // Recreate store if apiEndpoint or queryParams changed
    storeRef.current = createStore<TData>(props)
    
    // Initialize if not already loaded
    if (!state.isSuccess && !state.isLoading) {
      storeRef.current.initialize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, props.apiEndpoint, JSON.stringify(props.queryParams)])

  return {
    ...state,
    hasMore: state.count > state.data.length,
    fetchNextPage: storeRef.current.fetchNextPage,
    reset: storeRef.current.reset,
  }
}

export type { UseInfiniteQueryApiProps }

