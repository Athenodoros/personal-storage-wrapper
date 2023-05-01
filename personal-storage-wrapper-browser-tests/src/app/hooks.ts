import { DefaultTarget, Deserialiser } from "personal-storage-wrapper";
import { useState } from "react";

const LOCAL_STORAGE_KEY = "PSW_BROWSER_TEST_STORAGE";

type AccountState<T extends DefaultTarget> = {
    id: string;
    target: T;
}[];

type StoredState = {
    id: string;
    target: string;
}[];

export const useAccountState = <T extends DefaultTarget>(type: T["type"], deserialise: Deserialiser<T, false>) => {
    const LOCAL_STORAGE_KEY_FOR_TYPE = `${LOCAL_STORAGE_KEY}-${type}`;

    const [accounts, rawSetAccounts] = useState<AccountState<T>>(() => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_FOR_TYPE);
        if (!stored) return [];

        const state = JSON.parse(stored) as StoredState;
        return state.map(({ id, target }) => ({
            id,
            target: deserialise(JSON.parse(target)),
        }));
    });

    const [selected, setSelected] = useState<T | undefined>(accounts[0]?.target);

    const setAccounts = (updated: AccountState<T>) => {
        rawSetAccounts(updated);
        const state: StoredState = updated.map(({ id, target }) => ({
            id,
            target: JSON.stringify(target.serialise()),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY_FOR_TYPE, JSON.stringify(state));
    };

    const add = (target: T | null) => {
        if (!target) return;

        if (!selected) setSelected(target);

        setAccounts(accounts.concat([{ id: getDateString(), target }]));
    };

    const remove = (target: T) => {
        if (selected === target) setSelected(undefined);

        setAccounts(accounts.filter((candidate) => target !== candidate.target));
    };

    return { accounts, selected, set: setSelected, add, remove };
};

const getDateString = () => {
    const date = new Date();
    return `${date.toLocaleString("default", {
        month: "long",
    })} ${date.getDate()}, ${date.getHours()}:${date.getMinutes()}`;
};
