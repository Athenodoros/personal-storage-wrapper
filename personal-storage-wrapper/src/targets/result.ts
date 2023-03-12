interface ValueResult<Value> {
    type: "value";
    value: Value;
}
interface ErrorResult {
    type: "error";
    value?: undefined;
}

export type ResultValueType<Value> = ValueResult<Value> | ErrorResult;

export class Result<Value> extends Promise<ResultValueType<Value>> {
    // Can't override Promise.all or Promise.any with a different type
    static rall = all;
    static rany = any;

    static value = <Value>(value: Value) => new Result<Value>((resolve) => resolve({ type: "value", value }));
    static error = <Value>() => new Result<Value>((resolve) => resolve({ type: "error" }));

    constructor(executor: (resolve: (result: ResultValueType<Value>) => void, reject: () => void) => void) {
        super((resolve) => executor(resolve, () => resolve({ type: "error" })));
    }

    map = <T>(fn: (value: Value) => T): Result<T> =>
        new Result<T>((resolve) => {
            this.then((result) => {
                if (result.type === "error") resolve({ type: "error" });
                else resolve({ type: "value", value: fn(result.value) });
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
            .then(() => resolve({ type: "error" }))
            .catch(() => resolve({ type: "error" }));
    });
}
