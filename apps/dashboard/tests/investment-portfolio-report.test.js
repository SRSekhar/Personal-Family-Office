import { describe, expect, it } from 'vitest';
import {
    investmentPortfolioReportToCsv,
    renderInvestmentPortfolioReportHtml
} from '../investment-portfolio-report.js';

const timestamps = {
    asOfAt: '2026-03-31T23:59:59.999Z',
    recordedAtCutoff: '2026-03-31T23:59:59.999Z',
    generatedAt: '2026-04-01T00:00:00.000Z'
};

function position(overrides = {}) {
    return {
        accountId: 'account-1',
        accountName: 'Brokerage <Main>',
        instrumentId: 'instrument-1',
        instrumentName: 'Example Equity',
        currency: 'INR',
        quantity: 10,
        openLotCount: 1,
        costBasis: 1000,
        realizedGain: 100,
        dividendIncome: 25,
        interestIncome: 5,
        fees: 10,
        taxes: 5,
        marketPrice: 120,
        marketValue: 1200,
        unrealizedGain: 200,
        valuationAsOf: '2026-03-31T00:00:00.000Z',
        valuationSource: 'Manual & User',
        valuationSourceType: 'manual',
        ...overrides
    };
}

function performance(overrides = {}) {
    return {
        currency: 'INR',
        status: 'available',
        xirr: 0.12,
        terminalValue: 1500,
        cashBalance: 300,
        holdingsValue: 1200,
        cashFlowCount: 3,
        ...overrides
    };
}

function input(overrides = {}) {
    return {
        ...timestamps,
        positions: [position()],
        performance: [performance()],
        ...overrides
    };
}

function parseCsvRow(line) {
    const values = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (quoted) {
            if (character === '"' && line[index + 1] === '"') {
                value += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                value += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            values.push(value);
            value = '';
        } else {
            value += character;
        }
    }
    values.push(value);
    return values;
}

describe('investment portfolio review report', () => {
    it('renders existing FIFO P&L and ledger-backed XIRR without combining currencies', () => {
        const html = renderInvestmentPortfolioReportHtml(input({
            positions: [position(), position({
                accountId: 'account-2',
                accountName: 'USD brokerage',
                instrumentId: 'instrument-2',
                instrumentName: 'USD bond',
                currency: 'USD',
                costBasis: 500,
                realizedGain: -20,
                dividendIncome: 0,
                interestIncome: 15,
                fees: 2,
                taxes: 0,
                marketPrice: 55,
                marketValue: 550,
                unrealizedGain: 50
            })],
            performance: [performance(), performance({
                currency: 'USD',
                xirr: -0.03,
                terminalValue: 600,
                cashBalance: 50,
                holdingsValue: 550,
                cashFlowCount: 2
            })]
        }));

        expect(html).toContain('Investment portfolio review');
        expect(html).toContain('Currency review — INR');
        expect(html).toContain('Currency review — USD');
        expect(html).toContain('Realized P&amp;L');
        expect(html).toContain('Unrealized P&amp;L');
        expect(html).toContain('Annualized money-weighted return (XIRR)');
        expect(html).toContain('12.00%');
        expect(html).toContain('-3.00%');
        expect(html).toContain('No currency conversion');
        expect(html).not.toContain('Combined portfolio total');
    });

    it('escapes untrusted account and instrument names and creates a script-free standalone report', () => {
        const html = renderInvestmentPortfolioReportHtml(input({
            positions: [position({
                accountName: '<script>alert(1)</script>',
                instrumentName: '=HYPERLINK("https://example.invalid","click")'
            })]
        }));

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('=HYPERLINK(&quot;https://example.invalid&quot;,&quot;click&quot;)');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('https://fonts.googleapis.com');
        expect(html).not.toContain('<img');
    });

    it('marks open-position market value, unrealized P&L and net gain unavailable when valuation is missing', () => {
        const html = renderInvestmentPortfolioReportHtml(input({
            positions: [position({ marketPrice: null, marketValue: null, unrealizedGain: null, valuationAsOf: null, valuationSource: null, valuationSourceType: null })],
            performance: [performance({ status: 'unavailable', reason: 'Open position has no eligible valuation.' })]
        }));

        expect(html).toContain('Unavailable — open position valuation missing');
        expect(html).toContain('Open position has no eligible valuation.');
        expect(html).toContain('Realized P&amp;L');
        expect(html).not.toContain('Net gain / loss</span><strong>₹1,');
    });

    it('treats a closed position as having no unrealized P&L even when no later price is recorded', () => {
        const html = renderInvestmentPortfolioReportHtml(input({
            positions: [position({
                quantity: 0,
                openLotCount: 0,
                costBasis: 0,
                marketPrice: null,
                marketValue: null,
                unrealizedGain: null,
                valuationAsOf: null,
                valuationSource: null,
                valuationSourceType: null
            })],
            performance: []
        }));

        expect(html).toContain('Not applicable — position closed');
        expect(html).toContain('Closed position; no valuation required');
        expect(html).not.toContain('Unavailable — open position valuation missing');
    });

    it('exports fixed-width spreadsheet-safe CSV rows and preserves exact as-of provenance', () => {
        const csv = investmentPortfolioReportToCsv(input({
            positions: [position({ accountName: '=HYPERLINK("x","bad")', instrumentName: '+cmd' })]
        }));
        const rows = csv.trimEnd().split('\r\n').map(parseCsvRow);

        expect(rows[0][0]).toBe('RecordType');
        expect(rows.slice(1).every((row) => row.length === rows[0].length)).toBe(true);
        expect(rows[1][0]).toBe('Summary');
        expect(rows[1][3]).toBe(timestamps.asOfAt);
        expect(rows[1][4]).toBe(timestamps.recordedAtCutoff);
        expect(rows[2][6]).toBe("'=HYPERLINK(\"x\",\"bad\")");
        expect(rows[2][8]).toBe("'+cmd");
        expect(rows.some((row) => row[0] === 'XIRR' && row[25] === '0.12')).toBe(true);
    });

    it('retains explicit XIRR failure reasons in HTML and CSV without inventing a return', () => {
        const failed = performance({ status: 'unavailable', reason: 'Cash statement does not reconcile.' });
        delete failed.xirr;
        delete failed.terminalValue;
        delete failed.cashBalance;
        delete failed.holdingsValue;
        delete failed.cashFlowCount;
        const html = renderInvestmentPortfolioReportHtml(input({ performance: [failed] }));
        const csv = investmentPortfolioReportToCsv(input({ performance: [failed] }));

        expect(html).toContain('Unavailable — Cash statement does not reconcile.');
        expect(csv).toContain('Cash statement does not reconcile.');
        expect(csv).not.toContain(',0.12,');
    });

    it('rejects invalid timestamps, duplicate currency results and non-finite positions', () => {
        expect(() => renderInvestmentPortfolioReportHtml(input({ asOfAt: '2026-03-31' }))).toThrow(/canonical UTC/i);
        expect(() => renderInvestmentPortfolioReportHtml(input({
            recordedAtCutoff: '2026-03-31T00:00:00.000Z'
        }))).toThrow(/cannot be after/i);
        expect(() => renderInvestmentPortfolioReportHtml(input({
            performance: [performance(), performance()]
        }))).toThrow(/duplicate currency/i);
        expect(() => renderInvestmentPortfolioReportHtml(input({
            positions: [position({ costBasis: Number.NaN })]
        }))).toThrow(/finite number/i);
    });
});
