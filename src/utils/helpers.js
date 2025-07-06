function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} dia(s)`;
    if (hours > 0) return `${hours} hora(s)`;
    if (minutes > 0) return `${minutes} minuto(s)`;
    return `${seconds} segundo(s)`;
}
module.exports = { formatDuration };