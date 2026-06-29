import { useEffect, useState } from "react";

export type AsyncState<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

const repoRoot = __REPO_ROOT__.replace(/\/$/, "");

export function repoFile(relativePath: string) {
  const cleanPath = relativePath.replace(/^\/+/, "");
  return `/@fs${repoRoot}/${cleanPath}`;
}

export async function fetchRepoJson<T>(relativePath: string): Promise<T> {
  const response = await fetch(repoFile(relativePath));
  if (!response.ok) {
    throw new Error(`${relativePath}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function fetchRepoText(relativePath: string): Promise<string> {
  const response = await fetch(repoFile(relativePath));
  if (!response.ok) {
    throw new Error(`${relativePath}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function useRepoJson<T>(relativePath: string): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: true
  });

  useEffect(() => {
    let isMounted = true;

    setState({ data: null, error: null, isLoading: true });
    fetchRepoJson<T>(relativePath)
      .then((data) => {
        if (isMounted) {
          setState({ data, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : String(error),
            isLoading: false
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [relativePath]);

  return state;
}

export function useRepoText(relativePath: string): AsyncState<string> {
  const [state, setState] = useState<AsyncState<string>>({
    data: null,
    error: null,
    isLoading: true
  });

  useEffect(() => {
    let isMounted = true;

    setState({ data: null, error: null, isLoading: true });
    fetchRepoText(relativePath)
      .then((data) => {
        if (isMounted) {
          setState({ data, error: null, isLoading: false });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : String(error),
            isLoading: false
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [relativePath]);

  return state;
}
