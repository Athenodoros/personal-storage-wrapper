import { DefaultTarget, Deserialiser } from "personal-storage-wrapper";
import { useState } from "react";
import { getStorageManager } from "../utils/storage";

type TargetState<T extends DefaultTarget> = {
    timestamp: string;
    target: T;
}[];

type StoredState = {
    timestamp: string;
    target: string;
}[];

export const useTargetState = <T extends DefaultTarget>(type: T["type"], deserialise: Deserialiser<T, false>) => {
    const storage = getStorageManager<StoredState>("targets-" + type);

    const [accounts, rawSetAccounts] = useState<TargetState<T>>(() => {
        const state = storage.load() ?? [];
        return state.map(({ timestamp, target }) => ({
            timestamp,
            target: deserialise(JSON.parse(target)),
        }));
    });

    const [selected, setSelected] = useState<T | undefined>(accounts[0]?.target);

    const setAccounts = (updated: TargetState<T>) => {
        rawSetAccounts(updated);
        const state: StoredState = updated.map(({ timestamp, target }) => ({
            timestamp,
            target: JSON.stringify(target.serialise()),
        }));
        storage.save(state);
    };

    const add = (target: T | null) => {
        if (!target) return;

        if (!selected) setSelected(target);

        setAccounts([{ timestamp: formatDateString(new Date()), target }].concat(accounts));
    };

    const remove = (target: T) => {
        const updated = accounts.filter((candidate) => target !== candidate.target);
        if (selected === target) setSelected(updated[0]?.target);

        setAccounts(updated);
    };

    return { accounts, selected, set: setSelected, add, remove };
};

export const formatDateString = (date: Date) => {
    return `${date.toLocaleString("default", {
        month: "long",
    })} ${date.getDate()}, ${("" + date.getHours()).padStart(2, "0")}:${("" + date.getMinutes()).padStart(2, "0")}`;
};
