export class TypedBroadcastChannel<T> {
    private channel: BroadcastChannel;

    constructor(name: string, handler: (value: T) => void) {
        this.channel = new BroadcastChannel(name);
        this.channel.onmessage = ({ data }) => handler(data);
    }

    send = (value: T) => this.channel.postMessage(value);
}
