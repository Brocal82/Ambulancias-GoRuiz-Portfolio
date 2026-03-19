import { useState, useCallback } from "react";

export type UseAdminAlternativeModalParams = {
  /**
   * Callback cuando el usuario envía la opción alternativa.
   * La página implementa la lógica de API + invalidación + eventos.
   */
  onSendAlternative: (
    requestId: string,
    startISO: string,
    endISO: string,
    adminNote: string,
  ) => Promise<void>;
};

export type UseAdminAlternativeModalResult = {
  /** Abre el modal con el request y rango inicial */
  openAlternativeModal: (
    reqId: string,
    startDate: string,
    endDate: string,
  ) => void;
  /** Props para pasar a AdminAlternativeOptionModal */
  modalProps: {
    isOpen: boolean;
    monthIndex: number | null;
    year: number;
    initialStartDate: Date | undefined;
    initialEndDate: Date | undefined;
    onClose: () => void;
    onNavigateMonth: (next: { year: number; monthIndex: number }) => void;
    onSubmit: (p: {
      startISO: string;
      endISO: string;
      adminNote: string;
      days: number;
    }) => void;
  };
};

/**
 * Encapsula el estado y handlers del modal de opción alternativa (admin).
 * La página orquesta la lógica de negocio vía onSendAlternative.
 */
export function useAdminAlternativeModal(
  params: UseAdminAlternativeModalParams,
): UseAdminAlternativeModalResult {
  const { onSendAlternative } = params;

  const [isOpen, setIsOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [monthIndex, setMonthIndex] = useState<number | null>(null);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [initialStartDate, setInitialStartDate] = useState<Date | undefined>(
    undefined,
  );
  const [initialEndDate, setInitialEndDate] = useState<Date | undefined>(
    undefined,
  );

  const openAlternativeModal = useCallback(
    (reqId: string, startDate: string, endDate: string) => {
      setCurrentRequestId(reqId);

      const s = new Date(startDate);
      const e = new Date(endDate);

      setMonthIndex(s.getMonth());
      setYear(s.getFullYear());
      setInitialStartDate(s);
      setInitialEndDate(e);
      setIsOpen(true);
    },
    [],
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setCurrentRequestId(null);
  }, []);

  const handleNavigateMonth = useCallback(
    (next: { year: number; monthIndex: number }) => {
      setYear(next.year);
      setMonthIndex(next.monthIndex);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (p: {
      startISO: string;
      endISO: string;
      adminNote: string;
      days: number;
    }) => {
      if (!currentRequestId) return;
      await onSendAlternative(
        currentRequestId,
        p.startISO,
        p.endISO,
        p.adminNote,
      );
      setIsOpen(false);
    },
    [currentRequestId, onSendAlternative],
  );

  return {
    openAlternativeModal,
    modalProps: {
      isOpen,
      monthIndex,
      year,
      initialStartDate,
      initialEndDate,
      onClose: closeModal,
      onNavigateMonth: handleNavigateMonth,
      onSubmit: handleSubmit,
    },
  };
}
