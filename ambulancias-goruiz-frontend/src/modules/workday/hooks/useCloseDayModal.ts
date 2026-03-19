import { useState, useCallback } from "react";

/**
 * Encapsula el estado y las transiciones del flujo de cierre de día:
 * - Modal de pregunta (¿final o parcial?)
 * - Modal de revisión (PartialReviewModal / FinalReviewModal)
 */
export const useCloseDayModal = () => {
  const [showCloseQuestion, setShowCloseQuestion] = useState(false);
  const [isFinalClosure, setIsFinalClosure] = useState<boolean | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const openCloseQuestion = useCallback(() => setShowCloseQuestion(true), []);

  const selectFinalClosure = useCallback(() => {
    setIsFinalClosure(true);
    setShowCloseQuestion(false);
    setShowReviewModal(true);
  }, []);

  const selectPartialClosure = useCallback(() => {
    setIsFinalClosure(false);
    setShowCloseQuestion(false);
    setShowReviewModal(true);
  }, []);

  const cancelCloseQuestion = useCallback(() => setShowCloseQuestion(false), []);

  const closeReviewModal = useCallback(() => setShowReviewModal(false), []);

  return {
    showCloseQuestion,
    isFinalClosure,
    showReviewModal,
    openCloseQuestion,
    selectFinalClosure,
    selectPartialClosure,
    cancelCloseQuestion,
    closeReviewModal,
  };
};
