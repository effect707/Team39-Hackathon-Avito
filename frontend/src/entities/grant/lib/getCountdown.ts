export const getCountdown = (expiresAt: string, now = Date.now()) => {
    const totalSeconds = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return { totalSeconds, label: `${minutes}:${seconds}`, isWarning: totalSeconds <= 120 };
};
