import { describe, expect, it } from 'vitest';
import {
    selectInvestmentDrawdownCalendar,
    validateInvestmentDrawdownCalendars
} from './investment-drawdown-calendars.js';

const calendar = (overrides = {}) => ({
    id: 'calendar-1', calendarSetId: 'portfolio-inr-2026', version: 1,
    scope: 'portfolio', currency: 'INR',
    startAt: '2026-11-02T00:00:00.000Z', endAt: '2026-11-04T23:59:59.999Z',
    recordedAt: '2026-11-05T10:00:00.000Z',
    expectedDailyCloseAt: [
        '2026-11-02T15:30:00.000Z',
        '2026-11-03T15:30:00.000Z',
        '2026-11-04T15:30:00.000Z'
    ],
    ...overrides
});

describe('investment drawdown calendars', () => {
    it('validates an explicitly authored close schedule without generating dates', () => {
        expect(validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar()] }))
            .toEqual({ investmentDrawdownCalendars: [calendar()] });
    });

    it('rejects an empty, unordered, duplicated or out-of-window schedule', () => {
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar({ expectedDailyCloseAt: [] })] }))
            .toThrow(/explicitly list/i);
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar({
            expectedDailyCloseAt: ['2026-11-03T15:30:00.000Z', '2026-11-02T15:30:00.000Z']
        })] })).toThrow(/strictly increasing/i);
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar({
            expectedDailyCloseAt: ['2026-11-02T15:30:00.000Z', '2026-11-02T15:30:00.000Z']
        })] })).toThrow(/strictly increasing/i);
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar({
            expectedDailyCloseAt: ['2026-11-05T15:30:00.000Z']
        })] })).toThrow(/within the calendar window/i);
    });

    it('requires canonical UTC timestamps, supported currency and scope identity', () => {
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar({
            recordedAt: '2026-11-05'
        })] })).toThrow(/canonical UTC/i);
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar({ currency: 'BTC' })] }))
            .toThrow(/currency is unsupported/i);
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [calendar({
            scope: 'account'
        })] })).toThrow(/require an account ID/i);
    });

    it('requires append-only corrections to preserve identity and increment version', () => {
        const first = calendar();
        const correction = calendar({
            id: 'calendar-2', version: 2, recordedAt: '2026-11-06T10:00:00.000Z',
            supersedesCalendarId: 'calendar-1',
            expectedDailyCloseAt: first.expectedDailyCloseAt.slice(0, 2)
        });
        expect(validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [first, correction] })
            .investmentDrawdownCalendars).toHaveLength(2);
        expect(() => validateInvestmentDrawdownCalendars({ investmentDrawdownCalendars: [
            first, { ...correction, version: 3 }
        ] })).toThrow(/increment the version/i);
    });

    it('selects the latest revision known at the requested recorded-at cutoff', () => {
        const first = calendar();
        const correction = calendar({
            id: 'calendar-2', version: 2, recordedAt: '2026-11-06T10:00:00.000Z',
            supersedesCalendarId: 'calendar-1',
            expectedDailyCloseAt: first.expectedDailyCloseAt.slice(0, 2)
        });
        const request = {
            scope: 'portfolio', currency: 'INR',
            startAt: first.startAt, endAt: first.endAt,
            recordedAtCutoff: '2026-11-05T23:59:59.999Z',
            investmentDrawdownCalendars: [first, correction]
        };
        expect(selectInvestmentDrawdownCalendar(request)).toMatchObject({
            calendarId: 'calendar-1', version: 1,
            expectedDailyCloseAt: first.expectedDailyCloseAt
        });
        expect(selectInvestmentDrawdownCalendar({
            ...request, recordedAtCutoff: '2026-11-07T00:00:00.000Z'
        })).toMatchObject({ calendarId: 'calendar-2', version: 2, expectedDailyCloseAt: first.expectedDailyCloseAt.slice(0, 2) });
    });

    it('fails closed when no schedule or multiple independent schedules match', () => {
        const first = calendar();
        const request = {
            scope: 'portfolio', currency: 'INR', startAt: first.startAt, endAt: first.endAt,
            recordedAtCutoff: '2026-11-07T00:00:00.000Z', investmentDrawdownCalendars: []
        };
        expect(() => selectInvestmentDrawdownCalendar(request)).toThrow(/No explicitly recorded/i);
        expect(() => selectInvestmentDrawdownCalendar({
            ...request, investmentDrawdownCalendars: [first, calendar({
                id: 'calendar-other', calendarSetId: 'another-set'
            })]
        })).toThrow(/ambiguous/i);
    });
});
