import { useEffect, useRef, useCallback } from "react";

/**
 * Custom hook to track if a component is still mounted.
 * Prevents "Can't perform a React state update on an unmounted component" errors.
 *
 * @returns A function that returns true if the component is mounted, false otherwise
 *
 * @example
 * ```tsx
 * const isMounted = useIsMounted();
 *
 * useEffect(() => {
 *   async function fetchData() {
 *     const data = await api.getData();
 *     if (isMounted()) {
 *       setData(data);
 *     }
 *   }
 *   fetchData();
 * }, []);
 * ```
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    // Component is mounted
    isMountedRef.current = true;

    return () => {
      // Component is unmounted
      isMountedRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  return isMounted;
}
