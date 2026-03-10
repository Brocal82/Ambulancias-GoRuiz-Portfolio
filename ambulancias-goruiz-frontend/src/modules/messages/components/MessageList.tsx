// src/modules/messages/components/MessageList.tsx
import type { ReactNode } from "react";
import type { Message } from "../domain/types";
import MessageItem from "./MessageItem";

type Props = {
    messages: Message[];
    expanded: Set<string>;
    onToggle: (msg: Message) => void | Promise<void>;
    isUnread?: (msg: Message) => boolean;
    onDelete?: (msg: Message) => void | Promise<void>;
    showDelete?: boolean;
    emptyState?: ReactNode;
};

const MessageList = ({
    messages,
    expanded,
    onToggle,
    isUnread,
    onDelete,
    showDelete = false,
    emptyState,
}: Props) => {
    if (!messages.length) return <>{emptyState ?? null}</>;

    return (
        <ul className="space-y-3">
            {messages.map((message) => (
                <MessageItem
                    key={message._id}
                    message={message}
                    isOpen={expanded.has(message._id)}
                    onToggle={() => onToggle(message)}
                    unread={isUnread ? isUnread(message) : false}
                    showDelete={showDelete}
                    onDelete={onDelete ? () => onDelete(message) : undefined}
                />
            ))}
        </ul>
    );
};

export default MessageList;
