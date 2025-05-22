import { useEffect, useState } from "react";
import { getDienstByUser } from "../api/diensts";
import type { Dienst } from "../types/dienst";

const DienstPage = () => {
    const [diensts, setDiensts] = useState<Dienst[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState<{
        date: string;
        assignment?: Dienst["assignments"][0];
    } | null>(null);

    useEffect(() => {
        const fetchDiensts = async () => {
            try {
                const data = await getDienstByUser("682ccb36201b2d758d326dc7");
                setDiensts(data);
            } catch (error) {
                console.error("Error al obtener los diensts:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDiensts();
    }, []);

    if (loading) return <p>Cargando diensts...</p>;

return (
    <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Tus Diensts</h2>
        <ul className="space-y-8">
            {diensts.map((dienst, index) => {
                const allWeekDates = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(dienst.weekStartDate);
                    d.setDate(d.getDate() + i);
                    return d.toISOString().split("T")[0];
                });

                return (
                    <li key={index}>
                        <div className="mb-2">
                            <p className="text-lg font-semibold">
                                Dienst #{dienst.dienstNumber}
                            </p>
                            <p className="text-sm text-gray-600">
                                Semana del{" "}
                                {new Date(
                                    dienst.weekStartDate
                                ).toLocaleDateString()}{" "}
                                al{" "}
                                {new Date(
                                    dienst.weekEndDate
                                ).toLocaleDateString()}
                            </p>
                        </div>

                        {/* GRID DE DÍAS */}
                        <div className="grid grid-cols-7 gap-2">
                            {allWeekDates.map((day) => {
                                const assignment = dienst.assignments.find(
                                    (a) => a.date === day
                                );

                                const bgColor = assignment
                                    ? "bg-blue-100"
                                    : "bg-green-100";

                                return (
                                    <div
                                        key={day}
                                        className={`border rounded p-2 text-sm cursor-pointer hover:shadow ${bgColor}`}
                                        onClick={() =>
                                            setSelectedAssignment({
                                                date: day,
                                                assignment: assignment,
                                            })
                                        }
                                    >
                                        <p className="font-semibold">
                                            {new Date(day).toLocaleDateString(
                                                "es-ES",
                                                {
                                                    weekday: "short",
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                }
                                            )}
                                        </p>
                                        {assignment ? (
                                            <>
                                                <p className="text-xs">
                                                    🕒 {assignment.startTime} -{" "}
                                                    {assignment.endTime}
                                                </p>
                                                <p className="text-xs">
                                                    🚑 {assignment.vehicleNumber}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-xs text-green-800 font-medium mt-2">
                                                🌴 Libre
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </li>
                );
            })}
        </ul>

        {/* MODAL */}
        {selectedAssignment && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
                <div className="bg-white p-6 rounded shadow-md max-w-md w-full">
                    <h3 className="text-lg font-bold mb-4">
                        Detalle del día: {selectedAssignment.date}
                    </h3>

                    {selectedAssignment.assignment ? (
                        <>
                            <p>
                                🕒 {selectedAssignment.assignment.startTime} -{" "}
                                {selectedAssignment.assignment.endTime}
                            </p>
                            <p>
                                🚑 Vehículo:{" "}
                                {selectedAssignment.assignment.vehicleNumber}
                            </p>
                            <p>
                                👨‍✈️ Conductor:{" "}
                                {selectedAssignment.assignment.driver?.name}
                            </p>
                            <p>
                                👩‍⚕️ Sanitario:{" "}
                                {selectedAssignment.assignment.medic?.name}
                            </p>
                        </>
                    ) : (
                        <p className="text-green-700 font-semibold text-center text-xl">
                            🌴 Día libre
                        </p>
                    )}

                    <button
                        onClick={() => setSelectedAssignment(null)}
                        className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        )}
    </div>
);
}

export default DienstPage;
