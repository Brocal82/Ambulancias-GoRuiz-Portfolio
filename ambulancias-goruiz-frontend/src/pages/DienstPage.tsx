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
            <ul className="space-y-4">
                {diensts.map((dienst, index) => {
                    const allWeekDates = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(dienst.weekStartDate);
                        d.setDate(d.getDate() + i);
                        return d.toISOString().split("T")[0];
                    });

                    return (
                        <li
                            key={index}
                            className="p-4 border rounded bg-gray-100"
                        >
                            <p className="font-semibold mb-1">
                                Dienst #{dienst.dienstNumber}
                            </p>
                            <p className="mb-2 text-sm text-gray-600">
                                Semana del{" "}
                                {new Date(
                                    dienst.weekStartDate
                                ).toLocaleDateString()}{" "}
                                al{" "}
                                {new Date(
                                    dienst.weekEndDate
                                ).toLocaleDateString()}
                            </p>

                            {allWeekDates.map((day) => {
                                const assignment = dienst.assignments.find(
                                    (a) => a.date === day
                                );

                                // 👇 Nueva clase condicional para el fondo
                                const bgColor = assignment
                                    ? "bg-blue-100"
                                    : "bg-green-100";

                                return (
                                    <div
                                        key={day}
                                        className={`mb-2 border-t pt-2 p-2 rounded cursor-pointer hover:shadow ${bgColor}`}
                                        onClick={() =>
                                            setSelectedAssignment({
                                                date: day,
                                                assignment: assignment,
                                            })
                                        }
                                    >
                                        <p className="font-medium">📅 {day}</p>
                                        {assignment ? (
                                            <>
                                                <p>
                                                    🕒 {assignment.startTime} -{" "}
                                                    {assignment.endTime}
                                                </p>
                                                <p>
                                                    🚑 Vehículo:{" "}
                                                    {assignment.vehicleNumber}
                                                </p>
                                                <p>
                                                    👨‍✈️ Conductor:{" "}
                                                    {assignment.driver?.name}
                                                </p>
                                                <p>
                                                    👩‍⚕️ Sanitario:{" "}
                                                    {assignment.medic?.name}
                                                </p>
                                            </>
                                        ) : (
                                            <p className="text-green-800 font-semibold">
                                                🌴 Día libre
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </li>
                    );
                })}
            </ul>
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded shadow-md max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">
                            Detalle del día: {selectedAssignment.date}
                        </h3>

                        {selectedAssignment.assignment ? (
                            <>
                                <p>
                                    🕒 {selectedAssignment.assignment.startTime}{" "}
                                    - {selectedAssignment.assignment.endTime}
                                </p>
                                <p>
                                    🚑 Vehículo:{" "}
                                    {
                                        selectedAssignment.assignment
                                            .vehicleNumber
                                    }
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
};

export default DienstPage;
