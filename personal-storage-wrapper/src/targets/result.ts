export interface ValueResult<Value> {
    type: "value";
    value: Value;
}
export interface ErrorResult {
    type: "error";
    value?: undefined;
}

export type ResultValueType<Value> = ValueResult<Value> | ErrorResult;

export class Result<Value> extends Promise<ResultValueType<Value>> {
    // Can't override Promise.all or Promise.any with a different type
    static rall = all;
    static rany = any;
    static flatten = flatten;

    static value = <Value>(value: Value) => new Result<Value>((resolve) => resolve({ type: "value", value }));
    static error = <Value>() => new Result<Value>((resolve) => resolve({ type: "error" }));

    constructor(executor: (resolve: (result: ResultValueType<Value>) => void, reject: () => void) => void) {
        super((resolve) => executor(resolve, () => resolve({ type: "error" })));
    }

    map = <T>(fn: (value: Value) => T): Result<T> => this.pmap(async (value) => fn(value));

    pmap = <T>(fn: (value: Value) => Promise<T>): Result<T> =>
        new Result<T>((resolve) => {
            this.then(async (result) => {
                if (result.type === "error") resolve(result);
                else resolve({ type: "value", value: await fn(result.value) });
            });
        });

    flatmap = <T>(fn: (value: Value) => Result<T>): Result<T> =>
        new Result<T>((resolve) => {
            this.then((result) => {
                if (result.type === "error") resolve({ type: "error" });
                else
                    fn(result.value).then((output) => {
                        if (output.type === "error") resolve({ type: "error" });
                        else resolve(output);
                    });
            });
        });
}

function all<T1, T2>(results: [Result<T1>, Result<T2>]): Result<[T1, T2]>;
function all<T1, T2, T3>(results: [Result<T1>, Result<T2>, Result<T3>]): Result<[T1, T2, T3]>;
function all<T1, T2, T3, T4>(results: [Result<T1>, Result<T2>, Result<T3>, Result<T4>]): Result<[T1, T2, T3, T4]>;
function all<T>(results: Result<T>[]): Result<T[]>;
function all(results: Result<any>[]): Result<any[]> {
    return new Result<any>(async (resolve) => {
        results.forEach((result) => {
            result.then((value) => {
                if (value.type === "error") resolve(value);
            });
        });

        Promise.all(results)
            .then((values) => {
                if (values.some((value) => value.type === "error")) resolve({ type: "error" });
                else resolve({ type: "value", value: values.map((value) => value.value) });
            })
            .catch(() => resolve({ type: "error" }));
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
            .catch(() => resolve({ type: "error" }));
    });
}

type FlatResult<T> = T extends Promise<infer V>
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
