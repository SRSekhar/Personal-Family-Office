import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Asset,
    AssetType,
    Currency,
    Investment,
    InvestmentType,
    Liability,
    LiabilityType,
    Money,
    Portfolio,
    Property,
    PropertyType
} from '@pfo/models';

import {
    NetWorthCalculationInput,
    NetWorthCalculator
} from '../src/index.js';

describe('NetWorthCalculator', () => {

    it('should calculate net worth', () => {

        const portfolio = new Portfolio(
            Identifier.create(),
            'Personal',
            [
                new Asset(
                    Identifier.create(),
                    'Savings',
                    AssetType.BankAccount,
                    new Money(1_000_000, Currency.INR)
                )
            ],
            [
                new Investment(
                    Identifier.create(),
                    'PPF',
                    InvestmentType.PublicProvidentFund,
                    new Money(2_000_000, Currency.INR)
                )
            ],
            [
                new Liability(
                    Identifier.create(),
                    'Home Loan',
                    LiabilityType.HomeLoan,
                    new Money(500_000, Currency.INR)
                )
            ],
            [
                new Property(
                    Identifier.create(),
                    'House',
                    PropertyType.Residential,
                    new Money(4_000_000, Currency.INR)
                )
            ]
        );

        const calculator = new NetWorthCalculator();

        const result = calculator.calculate(
            new NetWorthCalculationInput(portfolio)
        );

        expect(result.totalAssets.amount).toBe(7_000_000);

        expect(result.totalLiabilities.amount).toBe(500_000);

        expect(result.netWorth.amount).toBe(6_500_000);

    });

});