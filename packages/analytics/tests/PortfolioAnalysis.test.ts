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
import { describe, expect, it } from 'vitest';

import { analyzePortfolio } from '../src/PortfolioAnalysis.js';
import { mapPortfolioPositions } from '../src/PortfolioPositionMapper.js';

function createPortfolio(): Portfolio {
    return new Portfolio(
        Identifier.create('portfolio-1'),
        'Household',
        [
            new Asset(Identifier.create('asset-cash'), 'Cash', AssetType.Cash, new Money(100, Currency.INR))
        ],
        [
            new Investment(
                Identifier.create('investment-equity'),
                'Equity fund',
                InvestmentType.MutualFund,
                new Money(300, Currency.INR)
            )
        ],
        [
            new Liability(
                Identifier.create('liability-loan'),
                'Home loan',
                LiabilityType.HomeLoan,
                new Money(50, Currency.INR)
            )
        ],
        [
            new Property(
                Identifier.create('property-home'),
                'Home',
                PropertyType.Residential,
                new Money(600, Currency.INR)
            )
        ]
    );
}

const selections = [
    { source: 'asset', sourceId: 'asset-cash', canonicalId: 'cash', category: 'Cash' },
    { source: 'investment', sourceId: 'investment-equity', canonicalId: 'equity', category: 'Equity' },
    { source: 'property', sourceId: 'property-home', canonicalId: 'home', category: 'Real Estate' },
    { source: 'liability', sourceId: 'liability-loan', canonicalId: 'home-loan', category: 'Loans' }
] as const;

describe('mapPortfolioPositions', () => {
    it('maps explicitly selected source records into canonical positions', () => {
        const positions = mapPortfolioPositions(createPortfolio(), selections);

        expect(positions).toHaveLength(4);
        expect(positions.map((position) => position.kind)).toEqual([
            'asset',
            'asset',
            'asset',
            'liability'
        ]);
        expect(positions.map((position) => position.value.amount)).toEqual([100, 300, 600, 50]);
    });

    it('rejects duplicate canonical IDs across different source types', () => {
        const duplicated = [
            { source: 'asset', sourceId: 'asset-cash', canonicalId: 'same-holding', category: 'Cash' },
            { source: 'investment', sourceId: 'investment-equity', canonicalId: 'same-holding', category: 'Equity' }
        ] as const;

        expect(() => mapPortfolioPositions(createPortfolio(), duplicated))
            .toThrow(/Duplicate canonical position ID/);
    });

    it('rejects selecting one source record more than once', () => {
        const duplicated = [
            { source: 'asset', sourceId: 'asset-cash', canonicalId: 'cash-1', category: 'Cash' },
            { source: 'asset', sourceId: 'asset-cash', canonicalId: 'cash-2', category: 'Cash' }
        ] as const;

        expect(() => mapPortfolioPositions(createPortfolio(), duplicated))
            .toThrow(/selected more than once/);
    });

    it('rejects source IDs that do not exist in the portfolio', () => {
        expect(() => mapPortfolioPositions(createPortfolio(), [
            { source: 'asset', sourceId: 'missing', canonicalId: 'missing', category: 'Cash' }
        ])).toThrow(/record not found/);
    });
});

describe('analyzePortfolio', () => {
    it('calculates net worth and allocation using explicit source selections', () => {
        const result = analyzePortfolio({
            portfolio: createPortfolio(),
            currency: Currency.INR,
            selections
        });

        expect(result.portfolioId).toBe('portfolio-1');
        expect(result.portfolioName).toBe('Household');
        expect(result.positionCount).toBe(4);
        expect(result.netWorth.totalAssets.amount).toBe(1000);
        expect(result.netWorth.totalLiabilities.amount).toBe(50);
        expect(result.netWorth.netWorth.amount).toBe(950);
        expect(result.assetAllocation.totalValue.amount).toBe(1000);
        expect(result.assetAllocation.allocations.map((item) => item.category))
            .toEqual(['Cash', 'Equity', 'Real Estate']);
        expect(result.financialRatios.liabilitiesToAssets).toBe(0.05);
        expect(result.financialRatios.netWorthToAssets).toBe(0.95);
        expect(result.financialRatios.assetsToLiabilities).toBe(20);
    });

    it('rejects selected positions with different currencies', () => {
        const portfolio = new Portfolio(
            Identifier.create('mixed-currency'),
            'Mixed Currency',
            [
                new Asset(Identifier.create('usd-cash'), 'USD cash', AssetType.Cash, new Money(100, Currency.USD))
            ],
            [],
            [],
            []
        );

        expect(() => analyzePortfolio({
            portfolio,
            currency: Currency.INR,
            selections: [
                { source: 'asset', sourceId: 'usd-cash', canonicalId: 'cash', category: 'Cash' }
            ]
        })).toThrow(/Convert currencies explicitly/);
    });
});
