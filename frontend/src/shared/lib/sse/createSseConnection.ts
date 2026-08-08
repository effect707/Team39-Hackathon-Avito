export const createSseConnection = (url: string) => {
    return new EventSource(url);
};
