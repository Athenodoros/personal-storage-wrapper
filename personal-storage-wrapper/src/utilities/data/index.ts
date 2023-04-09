/**
 * Order By
 */
const compareForOrderBy =
    <T>(valuers: ((t: T) => any)[], ascending: boolean) =>
    (a: T, b: T): number => {
        if (valuers.length === 0) return 0;

        const valA = valuers[0](a);
        const valB = valuers[0](b);

        if (valA === valB) {
            return compareForOrderBy(valuers.slice(1), ascending)(a, b);
        }
        return valA > valB === ascending ? 1 : -1;
    };

export const orderByAsc = <T>(array: T[], ...valuers: ((t: T) => any)[]) => {
    const copy = [...array];
    copy.sort(compareForOrderBy([...valuers], true));
    return copy;
};
export const orderByDesc = <T>(array: T[], ...valuers: ((t: T) => any)[]) => {
    const copy = [...array];
    copy.sort(compareForOrderBy([...valuers], false));
    return copy;
};

/**
 * Max By
 */
export function maxBy<T>(array: T[], ...metrics: ((t: T) => NonNullable<any>)[]): T;
export function maxBy<T>(array: T[], ...metrics: ((t: T) => any | undefined | null)[]): T | null;
export function maxBy<T>(array: T[], ...metrics: ((t: T) => any | undefined | null)[]): T | null {
    return orderByDesc(array, ...metrics)[0];
}

export function maxByAsync<T>(array: T[], ...metrics: ((t: T) => Promise<NonNullable<any>>)[]): Promise<T>;
export function maxByAsync<T>(array: T[], ...metrics: ((t: T) => Promise<any | undefined | null>)[]): Promise<T | null>;
export async function maxByAsync<T>(
    array: T[],
    ...metrics: ((t: T) => Promise<any | null | undefined>)[]
): Promise<T | null> {
    const values = await Promise.all(
        array.map((value) => Promise.all(metrics.map(async (metric) => await metric(value))))
    );
    const indices = array.map((_, idx) => idx);

    const index: number | undefined = orderByDesc(indices, ...metrics.map((_, m) => (i: number) => values[i][m]))[0];
    return index === undefined ? null : array[index];
}

/**
 * Named Trivial Functions
 */
export const noop = (): void => void null;
export const identity = <T>(t: T) => t;

/**
 * Deep Equality
 */
export const deepEquals = <T>(left: T, right: T): boolean => {
    if (typeof left !== typeof right) return false;

    if (typeof left !== "object" || left === undefined || left === null) return left === right;

    if (Array.isArray(left) !== Array.isArray(right)) return false;

    if (Object.keys(left).length !== Object.keys(right as object).length) return false;

    for (let key in left) if (!deepEquals(left[key], right[key])) return false;

    return true;
};
export const deepEqualsList = <T>(array: T[]): boolean => {
    if (array.length <= 1) return true;

    const [left, right, ...tail] = array;
    return deepEquals(left, right) && deepEqualsList([right, ...tail]);
};

/**
 * Array Utils
 */
export const last = <T>(array: T[]): T | undefined => array[array.length - 1];
export const take = <T>(array: T[], count: number): T[] => array.filter((_, idx) => idx < count);
export const partition = <T>(array: T[], predicate: (t: T) => boolean): [T[], T[]] => [
    array.filter((value) => predicate(value)),
    array.filter((value) => !predicate(value)),
];

export const uniqEquals = <T>(array: T[], equals: (t1: T, t2: T) => boolean) =>
    array.filter((t1, idx) => array.findIndex((t2) => equals(t1, t2)) === idx);
export const uniqBy = <T, S>(array: T[], getter: (t: T) => S) =>
    uniqEquals(array, (t1, t2) => getter(t1) === getter(t2));
export const uniq = <T>(array: T[]): T[] => array.filter((t1, idx) => array.findIndex((t2) => t1 === t2) === idx);

/**
 * Object Utils
 */
export const fromPairs = <K extends string | number | symbol, V>(pairs: [K, V][]) =>
    Object.fromEntries(pairs) as Record<K, V>;
export const fromKeys = <K extends string | number | symbol, V>(keys: K[], getValue: (k: K) => V) =>
    Object.fromEntries(keys.map((key) => [key, getValue(key)])) as Record<K, V>;
export const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]) =>
    fromKeys(keys, (key) => obj[key]) as Pick<T, K>;
