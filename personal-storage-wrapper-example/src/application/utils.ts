import { useRef, useState } from "react";

export const useKVState = <T extends object>(initial: T): [T, (value: Partial<T>) => void] => {
    const [state, setState] = useState(initial);
    const ref = useRef(state);
    return [
        state,
        (value: Partial<T>) => {
            ref.current = { ...ref.current, ...value };
            setState(ref.current);
        },
    ];
};
