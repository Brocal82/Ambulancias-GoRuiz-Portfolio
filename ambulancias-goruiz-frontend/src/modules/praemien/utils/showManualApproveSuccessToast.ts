import type { TFunction } from "i18next";
import { k, toastT } from "../../../utils/toast";
import type { AdminManualPraemieQueueRowData } from "../domain/manualDailyApi";
import { syncedTeammateLabelsFromQueueRow } from "./syncedTeammateLabelsFromQueueRow";

export function showManualApproveSuccessToast(
  t: TFunction,
  queueRow: AdminManualPraemieQueueRowData,
  syncedTeammateUserIds: string[],
): void {
  const names = syncedTeammateLabelsFromQueueRow(
    queueRow,
    syncedTeammateUserIds,
  ).join(" / ");
  if (names) {
    toastT.success(
      k("pages.praemien.adminManual.approveAlsoSyncedTeammate", { names }),
    );
    return;
  }
  toastT.success(t("pages.adminUsers.praemiePendingListApproveSuccess"));
}
