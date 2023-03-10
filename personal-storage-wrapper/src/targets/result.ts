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
    // Can't override Promise.all with a different type
    // static rall = all;

    static value = <Value>(value: Value) => new Result<Value>((resolve) => resolve({ type: "value", value }));
    static error = <Value>() => new Result<Value>((resolve) => resolve({ type: "error" }));

    constructor(executor: (resolve: (result: ResultValueType<Value>) => void) => void) {
        super((resolve) => executor(resolve));
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

// function all<T1, T2>(results: [Result<T1>, Result<T2>]): Result<[T1, T2]>;
// function all<T1, T2, T3>(results: [Result<T1>, Result<T2>, Result<T3>]): Result<[T1, T2, T3]>;
// function all<T1, T2, T3, T4>(results: [Result<T1>, Result<T2>, Result<T3>, Result<T4>]): Result<[T1, T2, T3, T4]>;
// function all<T>(results: Result<T>[]): Result<T[]>;
// function all(results: Result<any>[]): Result<any[]> {
//     return new Result<any>(async (resolve) => {
//         const values = await Promise.all(results);

//         if (values.some((value) => value.type === "error")) resolve({ type: "error" });
//         else resolve({ type: "value", value: values.map((value) => value.value) });
//     });
// }
