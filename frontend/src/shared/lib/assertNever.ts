export const assertNever = (value: never, context?: string): never => {
    throw new Error(
        `Unhandled variant${context ? ` in ${context}` : ""}: ${JSON.stringify(value)}`,
    );
};
