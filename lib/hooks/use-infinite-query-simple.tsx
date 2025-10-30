'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SupabaseTableName = 'rooms' | 'messages' | 'widgets' | 'contacts';

type PostgrestFilterBuilder = ReturnType<ReturnType<SupabaseClient['from']>['select']>;

export type SupabaseQueryHandler<T extends SupabaseTableName> = (
  query: PostgrestFilterBuilder
) => PostgrestFilterBuilder;

export type SupabaseTableData<T extends SupabaseTableName> = T extends 'rooms'
  ? any
  : T extends 'messages'
  ? any
  : T extends 'widgets'
  ? any
  : T extends 'contacts'
  ? any
  : never;

interface UseInfiniteQueryProps<T extends SupabaseTableName> {
  tableName: T;
  columns?: string;
  pageSize?: number;
  queryKey?: string;
  trailingQuery?: SupabaseQueryHandler<T>;
}

interface UseInfiniteQueryResult<TData> {
  data: TData[];
  count: number;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  error: Error | null;
  hasMore: boolean;
  fetchNextPage: () => Promise<void>;
}

export function useInfiniteQuery<
  TData extends SupabaseTableData<T>,
  T extends SupabaseTableName = SupabaseTableName,
>(props: UseInfiniteQueryProps<T>): UseInfiniteQueryResult<TData> {
  const {
    tableName,
    columns = '*',
    pageSize = 20,
    queryKey = tableName,
    trailingQuery,
  } = props;

  const [data, setData] = useState<TData[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const supabaseRef = useRef(createClient());
  const isInitializedRef = useRef(false);
  const queryKeyRef = useRef(queryKey);
  const abortControllerRef = useRef<AbortController | null>(null);

  console.log('🔄 [SIMPLE-HOOK] Render', { tableName, queryKey, dataLength: data.length });

  // Reset when queryKey changes
  if (queryKeyRef.current !== queryKey) {
    console.log('🔄 [SIMPLE-HOOK] QueryKey changed, resetting', {
      from: queryKeyRef.current,
      to: queryKey,
    });
    queryKeyRef.current = queryKey;
    isInitializedRef.current = false;
    setData([]);
    setCount(0);
    setIsSuccess(false);
    setError(null);
  }

  // Fetch data
  const fetchPage = async (skip: number) => {
    console.log('📥 [SIMPLE-HOOK] fetchPage START', {
      tableName,
      skip,
      currentDataLength: data.length,
      isFetching,
    });

    if (isFetching) {
      console.log('⏸️ [SIMPLE-HOOK] Already fetching, skipping');
      return;
    }

    // Abort previous request if still pending
    if (abortControllerRef.current) {
      console.log('🚫 [SIMPLE-HOOK] Aborting previous request');
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsFetching(true);

    try {
      console.log('🔍 [SIMPLE-HOOK] Building query...');
      
      let query = supabaseRef.current
        .from(tableName)
        .select(columns, { count: 'exact' });

      if (trailingQuery) {
        console.log('🔧 [SIMPLE-HOOK] Applying trailingQuery...');
        query = trailingQuery(query as any) as any;
      }

      console.log('🌐 [SIMPLE-HOOK] Executing query with timeout...', { skip, pageSize });
      
      // Add timeout (10 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000);
      });

      const queryPromise = query.range(skip, skip + pageSize - 1);

      const result: any = await Promise.race([queryPromise, timeoutPromise]);
      
      console.log('📨 [SIMPLE-HOOK] Query response', {
        hasData: !!result.data,
        dataLength: result.data?.length,
        count: result.count,
        hasError: !!result.error,
      });

      if (result.error) {
        console.error('❌ [SIMPLE-HOOK] Query error:', result.error);
        setError(result.error);
        setIsFetching(false);
        return;
      }

      console.log('✅ [SIMPLE-HOOK] Success! Updating state...');
      setData((prev) => [...prev, ...(result.data || [])]);
      setCount(result.count || 0);
      setIsSuccess(true);
      setError(null);
    } catch (err: any) {
      console.error('❌ [SIMPLE-HOOK] Fetch error:', err);
      if (err.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      console.log('🏁 [SIMPLE-HOOK] fetchPage FINALLY');
      setIsFetching(false);
      abortControllerRef.current = null;
    }
  };

  // Initialize on mount or queryKey change
  useEffect(() => {
    console.log('🚀 [SIMPLE-HOOK] useEffect RUNNING', {
      tableName,
      queryKey,
      isInitialized: isInitializedRef.current,
    });

    if (!isInitializedRef.current) {
      console.log('🎬 [SIMPLE-HOOK] First initialization');
      isInitializedRef.current = true;
      setIsLoading(true);
      fetchPage(0).finally(() => {
        console.log('✅ [SIMPLE-HOOK] Initial load complete');
        setIsLoading(false);
      });
    }

    return () => {
      console.log('🧹 [SIMPLE-HOOK] Cleanup');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const fetchNextPage = async () => {
    console.log('➡️ [SIMPLE-HOOK] fetchNextPage called', {
      currentLength: data.length,
      hasMore: count > data.length,
    });
    if (count > data.length && !isFetching) {
      await fetchPage(data.length);
    }
  };

  return {
    data,
    count,
    isLoading,
    isFetching,
    isSuccess,
    error,
    hasMore: count > data.length,
    fetchNextPage,
  };
}

