import React from "react";
import type { UserRef } from "../../modules/diensts";

interface UserDropdownProps {
    label: string;
    buttonId: string;
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;

    selectedUser: UserRef | null;
    selectedId: string;
    setSelectedId: (id: string) => void;

    otherSelectedId?: string;
    clearOtherIfSame?: boolean;

    availableUsers: UserRef[];

    renderSelected: (u: UserRef | null) => React.ReactNode;
    renderOption: (u: UserRef) => React.ReactNode;

    sortFn: (a: UserRef, b: UserRef) => number;

    isDisabled: (u: UserRef) => boolean;

    emptyLabel: string;
    unassignedLabel: string;
}

const UserDropdown: React.FC<UserDropdownProps> = ({
    label,
    buttonId,
    isOpen,
    setIsOpen,
    selectedUser,
    selectedId,
    setSelectedId,
    otherSelectedId,
    clearOtherIfSame,
    availableUsers,
    renderSelected,
    renderOption,
    sortFn,
    isDisabled,
    emptyLabel,
    unassignedLabel,
}) => {
    return (
        <div className="space-y-1">
            <label
                htmlFor={buttonId}
                className="block text-sm font-medium text-slate-700"
            >
                {label}
            </label>

            <div className="relative">
                <button
                    id={buttonId}
                    type="button"
                    className="w-full flex items-center justify-between rounded-xl border border-slate-300 ring-1 ring-slate-200 px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                    onClick={() => setIsOpen((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    <span className="truncate">
                        {renderSelected(selectedUser)}
                    </span>

                    <svg
                        className="h-4 w-4 shrink-0 text-slate-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>

                {isOpen && (
                    <div
                        role="listbox"
                        tabIndex={-1}
                        aria-label={label}
                        aria-labelledby={buttonId}
                        className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200"
                    >

                        {availableUsers.length === 0 && (
                            <div className="px-3 py-2 text-sm text-slate-500">
                                {emptyLabel}
                            </div>
                        )}

                        <button
                            role="option"
                            aria-selected={selectedId === ""}
                            onClick={() => {
                                setSelectedId("");
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                            — {unassignedLabel} —
                        </button>

                        {availableUsers
                            .slice()
                            .sort(sortFn)
                            .map((u) => {
                                const disabled = isDisabled(u);

                                return (
                                    <button
                                        key={u._id}
                                        role="option"
                                        aria-selected={selectedId === u._id}
                                        onClick={() => {
                                            if (disabled) return;

                                            setSelectedId(u._id || "");

                                            if (
                                                clearOtherIfSame &&
                                                otherSelectedId &&
                                                u._id === otherSelectedId
                                            ) {
                                                // Se limpia desde fuera (modal)
                                            }

                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${selectedId === u._id ? "bg-slate-50" : ""
                                            } ${disabled ? "opacity-50 cursor-not-allowed" : ""
                                            }`}
                                    >
                                        {renderOption(u)}
                                    </button>
                                );
                            })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserDropdown;
