export interface IClock {
    now(): Date;
    today(): Date;
    utcNow(): Date;
}

export class SystemClock implements IClock {
    public now(): Date {
        return new Date();
    }

    public today(): Date {
        const now = new Date();

        return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );
    }

    public utcNow(): Date {
        const now = new Date();

        return new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                now.getUTCHours(),
                now.getUTCMinutes(),
                now.getUTCSeconds(),
                now.getUTCMilliseconds()
            )
        );
    }
}