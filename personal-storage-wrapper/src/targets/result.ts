export type ResultErrorType =
    "UNKNOWN" | "OFFLINE" | "INVALID_AUTH" | "EXPIRED_AUTH" | "INVALID_FILE_REFERENCE" | "MISSING_FILE";

export interface ValueResult<Value> {
    type: "value";
    value: Value;
    error?: undefined;
    detail?: undefined;
}
export interface ErrorResult {
    type: "error";
    value?: undefined;
    error: ResultErrorType;
    /**
     * What went wrong, when the failure was something thrown rather than a refusal the target
     * described. `UNKNOWN` on its own says only that nobody knew, which is no use to whoever has to
     * tell the user what happened.
     */
    detail?: string;
}

/** An `UNKNOWN` result that still carries what was thrown */
export const getUnknownError = (thrown: unknown): ErrorResult => ({
    type: "error",
    error: "UNKNOWN",
    detail: getDetail(thrown),
});

/**
 * Not every failure describes itself. A stream handed a buffer it cannot read throws a `TypeError`
 * with no message at all, so the name it stringifies to is all there is to go on and is still more
 * than nothing.
 */
const getDetail = (thrown: unknown): string | undefined => {
    if (thrown === undefined || thrown === null) return undefined;
    if (thrown instanceof Error) return thrown.message || String(thrown) || undefined;

    return String(thrown) || undefined;
};

export type ResultValueType<Value> = ValueResult<Value> | ErrorResult;

export class Result<Value> extends Promise<ResultValueType<Value>> {
    // Can't override Promise.all or Promise.any with a different type
    static rall = all;
    static rany = any;
    static flatten = flatten;

    static value = <Value>(value: Value) => new Result<Value>((resolve) => resolve({ type: "value", value }));
    static error = <Value>(error: ResultErrorType, detail?: string) =>
        new Result<Value>((resolve) => resolve({ type: "error", error, detail }));

    /** An `UNKNOWN` result carrying what was thrown, for a failure nothing else described */
    static thrown = <Value>(thrown: unknown) => new Result<Value>((resolve) => resolve(getUnknownError(thrown)));

    constructor(
        executor: (resolve: (result: ResultValueType<Value>) => void, reject: (thrown?: unknown) => void) => void,
    ) {
        super((resolve) => {
            const fail = (thrown?: unknown) => resolve(getUnknownError(thrown));

            // A Result that rejects stops whoever is waiting on it rather than telling them the
            // operation failed, and callers only ever handle the second of those
            try {
                executor(resolve, fail);
            } catch (thrown) {
                fail(thrown);
            }
        });
    }

    map = <T>(fn: (value: Value) => T): Result<T> => this.pmap(async (value) => fn(value));

    /**
     * The callback is application code, and it can fail: a download that returned something other
     * than the expected file makes `JSON.parse` throw as it is decoded. The catch matters more than
     * it looks. Without it the rejection is delivered to the derived promise `then` builds, which is
     * itself a Result and so turns rejections into resolved errors that nobody is waiting on, while
     * the Result being built here is never resolved at all - and every caller waiting on it, up to
     * and including the manager's operation queue, waits for good.
     */
    pmap = <T>(fn: (value: Value) => Promise<T>): Result<T> =>
        new Result<T>((resolve) => {
            this.then(async (result) => {
                if (result.type === "error") return resolve(result);

                try {
                    resolve({ type: "value", value: await fn(result.value) });
                } catch (thrown) {
                    resolve(getUnknownError(thrown));
                }
            });
        });

    flatmap = <T>(fn: (value: Value) => Result<T>): Result<T> =>
        new Result<T>((resolve) => {
            this.then((result) => {
                if (result.type === "error") return resolve(result);

                try {
                    fn(result.value).then((output) => resolve(output));
                } catch (thrown) {
                    resolve(getUnknownError(thrown));
                }
            });
        });

    supress = (error: ResultErrorType, fallback: Value): Result<Value> =>
        new Result<Value>((resolve) =>
            this.then((result) => {
                if (result.type === "error" && result.error === error) resolve({ type: "value", value: fallback });
                else resolve(result);
            }),
        );
}

function all<T1, T2>(results: [Result<T1>, Result<T2>]): Result<[T1, T2]>;
function all<T1, T2, T3>(results: [Result<T1>, Result<T2>, Result<T3>]): Result<[T1, T2, T3]>;
function all<T1, T2, T3, T4>(results: [Result<T1>, Result<T2>, Result<T3>, Result<T4>]): Result<[T1, T2, T3, T4]>;
function all<T>(results: Result<T>[]): Result<T[]>;
function all(results: Result<any>[]): Result<any> {
    return new Result<any>(async (resolve) => {
        results.forEach((result) => {
            result.then((value) => {
                if (value.type === "error") resolve(value);
            });
        });

        Promise.all(results)
            .then((values) => {
                const error = values.find((value) => value.type === "error");

                if (error) resolve(error);
                else resolve({ type: "value", value: values.map((value) => value.value) });
            })
            .catch((thrown) => resolve(getUnknownError(thrown)));
    });
}

function any<T1, T2>(results: [Result<T1>, Result<T2>]): Result<T1 | T2>;
function any<T1, T2, T3>(results: [Result<T1>, Result<T2>, Result<T3>]): Result<T1 | T2 | T3>;
function any<T1, T2, T3, T4>(results: [Result<T1>, Result<T2>, Result<T3>, Result<T4>]): Result<T1 | T2 | T3 | T4>;
function any<T>(results: Result<T>[]): Result<T>;
function any<T>(results: Result<T>[]): Result<T> {
    return new Result<T>(async (resolve) => {
        results.forEach((result) => {
            result.then((value) => {
                if (value.type === "value") resolve(value);
            });
        });

        Promise.all(results)
            .then((values) => {
                if (values.every(({ type }) => type === "error")) resolve(values[0]);
            })
            .catch((thrown) => resolve(getUnknownError(thrown)));
    });
}

type FlatResult<T> =
    T extends Promise<infer V>
        ? FlatResult<V>
        : T extends object
          ? { [K in keyof T]: T[K] extends Result<infer V> ? FlatResult<V> : FlatResult<T[K]> }
          : T extends (infer U)[]
            ? FlatResult<U extends Result<infer V> ? V : U>[]
            : T;
function flatten<T>(t: T) {
    return new Result<FlatResult<T>>((resolve) => {
        // If it's a Result, flatten the value
        if (t instanceof Result) {
            t.flatmap(flatten).then((result) => resolve(result as ValueResult<FlatResult<T>>));
        }

        // If it's a Promise, turn it into a Result
        if (t instanceof Promise) {
            t.then((value) => flatten(value).then((result) => resolve(result as ValueResult<FlatResult<T>>)));
        }

        // Return basic types as-is
        else if (typeof t !== "object" || t === undefined || t === null) {
            resolve({ type: "value", value: t as FlatResult<T> });
        }

        // If it's an array
        else if (Array.isArray(t)) {
            // Transform into array of Results
            const array = t.map((x) => {
                if (x instanceof Result) return x.flatmap(flatten);
                else return flatten(x);
            }) as Result<any>[];

            // Combine all of them together and resolve
            Result.rall(array).then((result) => resolve(result as ValueResult<FlatResult<T>>));
        }

        // It's an object
        else {
            const obj = t as any;

            // Transform into list of object entries with Result values
            const entryResults = Object.keys(obj).map<Result<[string, any]>>((key) => {
                if (obj[key] instanceof Result) return obj[key].flatmap(flatten).map((result: any) => [key, result]);
                else return flatten(obj[key]).map((result: any) => [key, result]);
            });
            Result.rall(entryResults)
                .map((entries) => Object.fromEntries(entries))
                .then((result) => resolve(result as ValueResult<FlatResult<T>>));
        }
    });
}
