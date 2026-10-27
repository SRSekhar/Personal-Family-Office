import { describe, expect, it } from 'vitest';
import { parseRecordsCsv } from '../csv-import.js';

const header = 'Name,Category,Type,Value,Currency\r\n';

describe('parseRecordsCsv', () => {
    it('parses the dashboard CSV export format and trims outer whitespace', () => {
        expect(parseRecordsCsv(
            'Name,Category,Type,Value,Currency\r\n" Savings account "," Cash & deposits ","asset",1250.5,"INR"\r\n'
        )).toEqual([{ name: 'Savings account', category: 'Cash & deposits', type: 'asset', value: 1250.5 }]);
    });

    it('supports quoted commas, escaped quotes, embedded newlines, and CRLF', () => {
        expect(parseRecordsCsv(
            'Name,Category,Type,Value,Currency\r\n'
            + '"Bank, ""main""\naccount","Cash & deposits","asset",10,"INR"\r\n'
        )).toEqual([{
            name: 'Bank, "main"\naccount', category: 'Cash & deposits', type: 'asset', value: 10
        }]);
    });

    it('accepts a UTF-8 BOM and LF line endings', () => {
        expect(parseRecordsCsv('\uFEFFName,Category,Type,Value,Currency\n"Cash","Cash & deposits","asset",0,"INR"\n'))
            .toEqual([{ name: 'Cash', category: 'Cash & deposits', type: 'asset', value: 0 }]);
    });

    it('treats spreadsheet-formula-neutralized text as literal text', () => {
        expect(parseRecordsCsv(header + '"\'=1+1","Other","asset",1,"INR"')[0].name).toBe("'=1+1");
    });

    it('rejects a header-only CSV so an accidental empty export cannot clear all records', () => {
        expect(() => parseRecordsCsv(header)).toThrow('CSV contains no financial records');
        expect(() => parseRecordsCsv(header.trimEnd())).toThrow('CSV contains no financial records');
    });

    it('rejects empty input and unsupported headers', () => {
        expect(() => parseRecordsCsv('')).toThrow('CSV file is empty');
        expect(() => parseRecordsCsv('Name,Value\nCash,1')).toThrow('Unsupported CSV format');
    });

    it.each([
        ['unterminated quoted field', header + '"Cash,"Cash & deposits","asset",1,"INR"'],
        ['characters after closing quote', header + '"Cash"x,"Cash & deposits","asset",1,"INR"'],
        ['quote inside an unquoted field', header + 'Ca"sh,"Cash & deposits","asset",1,"INR"']
    ])('rejects malformed CSV: %s', (_label, source) => {
        expect(() => parseRecordsCsv(source)).toThrow();
    });

    it.each([
        ['wrong column count', 'Cash,Other,asset,1\n'],
        ['empty name', ',"Other","asset",1,"INR"\n'],
        ['unsupported record type', '"Cash","Other","other",1,"INR"\n'],
        ['negative value', '"Cash","Other","asset",-1,"INR"\n'],
        ['non-numeric value', '"Cash","Other","asset","abc","INR"\n']
    ])('rejects invalid row: %s', (_label, row) => {
        expect(() => parseRecordsCsv(header + row)).toThrow();
    });

    it('rejects a currency mismatch before any records are returned', () => {
        expect(() => parseRecordsCsv(header + '"Cash","Other","asset",1,"USD"')).toThrow('CSV currency must be INR');
    });

    it('rejects an empty currency configuration', () => {
        expect(() => parseRecordsCsv(header, ' ')).toThrow('Currency must be a non-empty string');
    });
});
