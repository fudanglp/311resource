import { AlertCircle, Loader2 } from "lucide-react";

export function DataState({
  error,
  isLoading,
  label = "数据"
}: {
  error: string | null;
  isLoading: boolean;
  label?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在读取{label}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        {label}不可用：{error}
      </div>
    );
  }

  return null;
}
