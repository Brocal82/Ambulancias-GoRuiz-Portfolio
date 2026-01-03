// frontend/src/components/messages/AttachmentChips.tsx
import React from "react";

type FileChip = {
    key: string;
    name: string;
    title?: string;
};

type AttachmentChipsProps = {
    items: FileChip[];
    onRemove?: (index: number) => void;
    maxNameWidthClassName?: string; // por si quieres variar el truncate
};

const AttachmentChips: React.FC<AttachmentChipsProps> = ({
    items,
    onRemove,
    maxNameWidthClassName = "max-w-[220px]",
}) => {
    if (!items || items.length === 0) return null;

    return (
        <ul className="mt-2 flex flex-wrap justify-start gap-2">
            {items.map((item, idx) => (
                <li
                    key={item.key}
                    className="group inline-flex items-center max-w-full rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-xs"
                    title={item.title ?? item.name}
                >
                    <span aria-hidden="true" className="mr-1">
                        📎
                    </span>

                    <span className={`truncate ${maxNameWidthClassName}`}>
                        {item.name}
                    </span>

                    {onRemove ? (
                        <button
                            type="button"
                            aria-label="Quitar"
                            className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                            onClick={() => onRemove(idx)}
                        >
                            ×
                        </button>
                    ) : null}
                </li>
            ))}
        </ul>
    );
};

export default AttachmentChips;
