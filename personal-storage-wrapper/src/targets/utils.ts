export const MAX_RTT_FOR_QUERY_IN_SECONDS = 10;

export const constructURLWithQueryParams = (base: string, params: Record<string, string>) =>
    `${base}?${Object.keys(params)
        .map((key) => encodeURI(key) + "=" + encodeURI(params[key]))
        .join("&")}`;
