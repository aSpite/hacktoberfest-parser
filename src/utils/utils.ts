export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function getCurrentTimeFormatted(): string {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const now = new Date();
    const month = months[now.getMonth()];
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    const timezoneOffset = now.getTimezoneOffset();
    const gmtOffsetHours = Math.abs(Math.floor(timezoneOffset / 60));
    const gmtOffsetMinutes = Math.abs(timezoneOffset % 60);
    const gmtSign = timezoneOffset < 0 ? '+' : '-';

    return `${month} ${day} ${hours}:${minutes}:${seconds} GMT${gmtSign}${gmtOffsetHours.toString().padStart(2, '0')}:${gmtOffsetMinutes.toString().padStart(2, '0')}`;
}