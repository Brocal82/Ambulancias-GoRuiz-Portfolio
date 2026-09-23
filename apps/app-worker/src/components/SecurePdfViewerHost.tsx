import { useEffect, useState } from "react";

import {
  registerPdfViewerHandler,
  type PdfViewerPayload,
} from "../services/secureFiles";
import { SecurePdfViewerModal } from "./SecurePdfViewerModal";

type Props = {
  children: React.ReactNode;
};

export function SecurePdfViewerHost({ children }: Props) {
  const [payload, setPayload] = useState<PdfViewerPayload | null>(null);

  useEffect(() => {
    registerPdfViewerHandler((next) => setPayload(next));
    return () => registerPdfViewerHandler(null);
  }, []);

  return (
    <>
      {children}
      {payload ? (
        <SecurePdfViewerModal
          visible
          title={payload.title}
          base64={payload.base64}
          onClose={() => setPayload(null)}
        />
      ) : null}
    </>
  );
}
