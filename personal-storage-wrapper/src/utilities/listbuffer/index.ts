import { take } from "../data";

export interface ListBufferConfig {
    maxLength?: number;
    maxMillis?: number;
}
export class ListBuffer<T> {
    private valueList: { time: number; value: T }[];
    private maxLength?: number;
    private maxMillis?: number;

    constructor(values: T[], config: ListBufferConfig = {}) {
        const time = new Date().valueOf();
        this.valueList = (config.maxLength !== undefined ? take(values, config.maxLength) : values).map((value) => ({
            time,
            value,
        }));

        this.maxLength = config.maxLength;
        this.maxMillis = config.maxMillis;

        this.maybeSetTimeout();
    }

    private trimValuesForTime = () => {
        if (this.maxMillis === undefined) return;

        const current = new Date().valueOf();
        this.valueList = this.valueList.filter(({ time }) => time + this.maxMillis! > current);

        this.maybeSetTimeout();
    };

    private maybeSetTimeout = () => {
        if (this.maxMillis) setTimeout(this.trimValuesForTime, this.maxMillis);
    };

    public push = (...values: T[]) => {
        const time = new Date().valueOf();
        this.valueList.unshift(...values.map((value) => ({ time, value })));
        if (this.maxLength !== undefined && this.valueList.length > this.maxLength) this.valueList.pop();
    };

    public values = () => this.valueList.map(({ value }) => value);
}
