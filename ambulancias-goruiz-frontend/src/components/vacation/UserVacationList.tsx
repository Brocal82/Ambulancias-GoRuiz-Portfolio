import React from 'react';
import type { IVacationRequest } from '../../types/vacationRequest';
import UserVacationListItem from './UserVacationListItem';
import { useTranslation } from 'react-i18next';

type Props = {
  requests: IVacationRequest[];
  onRespondAlternative: (id: string, accept: boolean) => void;
};

const UserVacationList: React.FC<Props> = ({ requests, onRespondAlternative }) => {
  const { t } = useTranslation();

  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-600">
        {t('pages.vacations.list.empty')}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {requests.map((req) => (
        <UserVacationListItem
          key={req._id}
          request={req}
          onAcceptAlternative={(id) => onRespondAlternative(id, true)}
          onRejectAlternative={(id) => onRespondAlternative(id, false)}
        />
      ))}
    </ul>
  );
};

export default UserVacationList;
