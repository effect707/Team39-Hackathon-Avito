export const getEstimatedWait = (position: number) => {
    const peopleAhead = Math.max(0, position - 1);

    if (peopleAhead === 0) return "меньше 2 минут";
    if (peopleAhead === 1) return "примерно 2 минуты";

    const minimum = Math.round(peopleAhead * 2 * 0.8);
    const maximum = Math.ceil(peopleAhead * 2 * 1.2);

    if (minimum === maximum) return `примерно ${minimum} минуты`;
    if (minimum < 2) return "примерно 2 минуты";

    return `примерно ${minimum}–${maximum} минут`;
};
