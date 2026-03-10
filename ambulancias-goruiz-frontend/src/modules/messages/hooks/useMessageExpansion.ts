// src/modules/messages/hooks/useMessageExpansion.ts
import { useCallback, useState } from "react";

export const useMessageExpansion = () => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleById = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (id: string) => expanded.has(id),
    [expanded],
  );

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  return {
    expanded,
    toggleById,
    isExpanded,
    collapseAll,
    setExpanded, // útil tras borrar o recargar
  };
};
