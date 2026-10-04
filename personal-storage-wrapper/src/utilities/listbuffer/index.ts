import { take } from "../data";

export interface ListBufferConfig {
    maxLength?: number;
    maxMillis?: number;
}

/**
 * The most recent values, newest first, up to `maxLength` of them. Each is kept for at least `maxMillis`.
 * Older values are dropped by a timer that runs every `maxMillis`, to free their memory while nothing new
 * is added, so a value may be kept for up to twice that, or longer if the timer runs late.
 */
export class ListBuffer<T> {
    private valueList: { time: number; value: T }[];
    private maxLength?: number;
    private maxMillis?: number;

    constructor(values: T[] = [], config: ListBufferConfig = {}) {
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
        if (this.maxLength !== undefined) this.valueList.splice(this.maxLength);
    };

    public values = () => this.valueList.map(({ value }) => value);
}
