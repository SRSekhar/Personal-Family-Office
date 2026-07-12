import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    FinancialSnapshot,
    Money,
    Portfolio
} from '../src/index.js';

describe('FinancialSnapshot', () => {
    it('should calculate net worth', () => {
        const portfolio = new Portfolio(
            Identifier.create(),
            'Personal',
            [],
            [],
            [],
            []
        );

        const snapshot = FinancialSnapshot.create(
            Identifier.create(),
            portfolio,
            new Date(),
            new Money(1000),
            new Money(400)
        );

        expect(snapshot.netWorth.amount).toBe(600);
    });
});