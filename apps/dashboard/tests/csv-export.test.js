import { describe, expect, it } from 'vitest';
import { recordsToCsv } from '../csv-export.js';

describe('recordsToCsv', () => {
    it('exports a header and financial records as CSV with CRLF lines', () => {
        expect(recordsToCsv([
            { name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 1250.5 },
            { name: 'Home loan', category: 'Home loan', type: 'liability', value: 500 }
        ])).toBe(
            'Name,Category,Type,Value,Currency\r\n'
            + '"Savings account","Cash & deposits","asset",1250.5,"INR"\r\n'
            + '"Home loan","Home loan","liability",500,"INR"\r\n'
        );
    });

    it('quotes embedded commas, quotes, and newlines', () => {
        const csv = recordsToCsv([
            { name: 'Bank, "main"\naccount', category: 'Cash & deposits', type: 'asset', value: 10 }
        ]);
        expect(csv).toContain('"Bank, ""main""\naccount"');
    });

    it.each(['=HYPERLINK("https://example.invalid","open")', '+SUM(1,2)', '@SUM(A1:A2)', ' -2+3'])(
        'neutralizes spreadsheet formula-like text beginning with %s',
        (name) => {
            const csv = recordsToCsv([{ name, category: 'Other', type: 'asset', value: 1 }]);
            const safeName = `'${name}`.replaceAll('"', '""');
            expect(csv).toContain(`"${safeName}"`);
        }
    );

    it('rejects malformed records rather than emitting a partial export', () => {
        expect(() => recordsToCsv([
            { name: 'Valid', category: 'Other', type: 'asset', value: 1 },
            { name: '', category: 'Other', type: 'unknown', value: -1 }
        ])).toThrow('invalid financial record');
    });

    it('rejects invalid input and an empty currency', () => {
        expect(() => recordsToCsv(null)).toThrow('Records must be an array');
        expect(() => recordsToCsv([], ' ')).toThrow('Currency must be a non-empty string');
    });
});
