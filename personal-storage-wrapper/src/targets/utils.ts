export const MAX_RTT_FOR_QUERY_IN_SECONDS = 10;

export const constructURLWithQueryParams = (base: string, params: Record<string, string>) =>
    `${base}?${Object.keys(params)
        .map((key) => encodeURI(key) + "=" + encodeURI(params[key]))
        .join("&")}`;

export const saveToSessionStorage = <T>(key: string, value: T) =>
    window.sessionStorage.setItem(key, JSON.stringify(value));

export const loadFromSessionStorage = <T>(key: string) => {
    const value = window.sessionStorage.getItem(key);
    return value !== null ? (JSON.parse(value) as T) : null;
};

interface PopupURLDetails {
    url: string;
    height?: number;
    width?: number;
}
export const getFromPopup = <T>(
    urlDetails: PopupURLDetails,
    callback: (context: Window) => T | null
): Promise<T | null> => {
    const { url, height = 600, width = 480 } = urlDetails;

    const context = window.open(url, "_blank", `toolbar=false,menubar=false,height=${height},width=${width}`);
    if (context === null) return Promise.resolve(null);

    return new Promise<T | null>((resolve) => {
        const setPoll = () =>
            setTimeout(() => {
                try {
                    if (context.closed) {
                        resolve(null);
                    } else if (context.location.origin === window.location.origin) {
                        resolve(callback(context));
                        context.close();
                    } else {
                        setPoll();
                    }
                } catch {
                    setPoll();
                }
            }, 50);

        setPoll();
    });
};
