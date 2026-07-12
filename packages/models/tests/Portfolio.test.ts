import { describe, expect, it } from 'vitest';

import { Identifier } from '@pfo/core';

import {
    Asset,
    AssetType,
    Investment,
    InvestmentType,
    Liability,
    LiabilityType,
    Money,
    Portfolio,
    Property,
    PropertyType
} from '../src/index.js';

describe('Portfolio', () => {
    it('should create an empty portfolio', () => {
        const portfolio = new Portfolio(
            Identifier.create(),
            'Personal',
            [],
            [],
            [],
            []
        );

        expect(portfolio.assets).toHaveLength(0);
        expect(portfolio.investments).toHaveLength(0);
        expect(portfolio.liabilities).toHaveLength(0);
        expect(portfolio.properties).toHaveLength(0);
    });

    it('should add entities immutably', () => {
        let portfolio = new Portfolio(
            Identifier.create(),
            'Personal',
            [],
            [],
            [],
            []
        );

        portfolio = portfolio.addAsset(
            new Asset(
                Identifier.create(),
                'Savings',
                AssetType.BankAccount,
                new Money(1000)
            )
        );

        portfolio = portfolio.addInvestment(
            new Investment(
                Identifier.create(),
                'PPF',
                InvestmentType.PublicProvidentFund,
                new Money(1000)
            )
        );

        portfolio = portfolio.addLiability(
            new Liability(
                Identifier.create(),
                'Home Loan',
                LiabilityType.HomeLoan,
                new Money(1000)
            )
        );

        portfolio = portfolio.addProperty(
            new Property(
                Identifier.create(),
                'Home',
                PropertyType.Residential,
                new Money(1000)
            )
        );

        expect(portfolio.assets).toHaveLength(1);
        expect(portfolio.investments).toHaveLength(1);
        expect(portfolio.liabilities).toHaveLength(1);
        expect(portfolio.properties).toHaveLength(1);
    });
});