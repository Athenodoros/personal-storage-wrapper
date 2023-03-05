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
