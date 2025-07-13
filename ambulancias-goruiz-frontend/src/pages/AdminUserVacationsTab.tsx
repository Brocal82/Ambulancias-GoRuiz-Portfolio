// src/pages/AdminUserVacationsTab.tsx
import { useEffect, useState } from 'react';
import type { IVacationRequest } from '../types/vacationRequest';
import { getVacationRequests } from '../api/vacation';
import { useAuth } from '../hooks/useAuth';

interface Props {
    userId: string;
}

const AdminUserVacationsTab = ({ userId }: Props) => {
    const { token } = useAuth();
    const [vacations, setVacations] = useState<IVacationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token || !userId) return;

        const fetchVacations = async () => {
            setLoading(true);
            try {
                const allVacations = await getVacationRequests(token);
                const acceptedVacations = allVacations.filter(
                    (v: IVacationRequest) => v.user._id === userId && v.status === 'accepted'
                );

                setVacations(acceptedVacations);
                setError('');
            } catch (err) {
                setError('Error al cargar las vacaciones.');
            } finally {
                setLoading(false);
            }
        };

        fetchVacations();
    }, [token, userId]);

    if (loading) return <p>Cargando vacaciones...</p>;
    if (error) return <p className="text-red-500">{error}</p>;
    if (vacations.length === 0) return <p>No hay vacaciones aceptadas.</p>;

    return (
        <div>
            <h3 className="text-lg font-semibold mb-4">Vacaciones aceptadas</h3>
            <ul className="list-disc pl-6 space-y-1">
                {vacations.map(vac => (
                    <li key={vac._id}>
                        {new Date(vac.startDate).toLocaleDateString()} - {new Date(vac.endDate).toLocaleDateString()}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default AdminUserVacationsTab;
