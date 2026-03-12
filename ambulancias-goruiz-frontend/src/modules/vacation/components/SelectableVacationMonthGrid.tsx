import React from 'react';

/**
 * Componente paralelo (NO sustituye nada aún).
 * En pasos posteriores:
 * - reutilizaremos/envolveremos el grid existente
 * - añadiremos selección de rango y callbacks
 *
 * Paso 1: solo “stub” para asegurar compilación sin riesgo.
 */
export type SelectableVacationMonthGridProps = {
    // En el Paso 2 definiremos props reales según el grid actual.
    // Por ahora dejamos un placeholder para evitar bloqueos.
    debugLabel?: string;
};

const SelectableVacationMonthGrid: React.FC<SelectableVacationMonthGridProps> = ({ debugLabel }) => {
    return (
        <div className="rounded border p-3">
            <div className="text-sm opacity-70">
                SelectableVacationMonthGrid (stub) {debugLabel ? `- ${debugLabel}` : ''}
            </div>
            <div className="mt-2 text-xs opacity-60">
                (Aún no está integrado. No afecta a Admin/Worker.)
            </div>
        </div>
    );
};

export default SelectableVacationMonthGrid;
