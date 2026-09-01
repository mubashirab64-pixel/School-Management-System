import { useState, useEffect, useCallback } from 'react';

interface UseDataFetchingOptions<T> {
  fetchFunction: () => Promise<T>;
  dependencies?: any[];
  enabled?: boolean;
}

interface UseDataFetchingReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for data fetching with loading and error states
 * This eliminates duplicate useState, useEffect, and error handling logic
 */
export function useDataFetching<T>({
  fetchFunction,
  dependencies = [],
  enabled = true
}: UseDataFetchingOptions<T>): UseDataFetchingReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFunction();
      setData(result);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch data';
      setError(errorMessage);
      console.error('Data fetching error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}

/**
 * Custom hook for paginated data fetching
 */
export function usePaginatedDataFetching<T>({
  fetchFunction,
  dependencies = []
}: {
  fetchFunction: (page: number, pageSize: number) => Promise<{
    results: T[];
    count: number;
    next: string | null;
    previous: string | null;
  }>;
  dependencies?: any[];
}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async (page: number, size: number) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFunction(page, size);
      setData(result.results);
      setTotalCount(result.count);
      setTotalPages(Math.ceil(result.count / size));
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to fetch data';
      setError(errorMessage);
      console.error('Data fetching error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    fetchData(currentPage, pageSize);
  }, [fetchData, currentPage, pageSize, ...dependencies]);

  return {
    data,
    loading,
    error,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalCount,
    totalPages,
    refetch: () => fetchData(currentPage, pageSize)
  };
}
