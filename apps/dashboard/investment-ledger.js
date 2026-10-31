const CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF']);
const ACCOUNT_TYPES = new Set(['Brokerage', 'MutualFund', 'Retirement', 'ProvidentFund', 'FixedDeposit', 'Other']);
const INSTRUMENT_TYPES = new Set(['Equity', 'MutualFund', 'ETF', 'Bond', 'FixedDeposit', 'PublicProvidentFund', 'NationalPensionSystem', 'EmployeesProvidentFund', 'Gold', 'Silver', 'RealEstateInvestment', 'Cryptocurrency', 'AlternativeInvestment', 'Other']);
const TRANSACTION_TYPES = new Set(['Purchase', 'Sale', 'Dividend', 'Interest', 'Fee', 'Tax']);
const SOURCE_TYPES = new Set(['manual', 'provider']);

function requireText(value, label) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(label + ' must be a non-empty string.');
    return value.trim();
}
function requireDate(value, label) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(label + ' must be a canonical ISO-8601 timestamp.');
    }
    return value;
}
function requireMoney(value, label) {
    if (!value || typeof value !== 'object' || !Number.isFinite(value.amount)
        || typeof value.currency !== 'string' || !CURRENCIES.has(value.currency)) {
        throw new Error(label + ' must contain a finite amount and supported currency.');
    }
    return { amount: value.amount, currency: value.currency };
}
function unique(items, label) {
    const seen = new Set();
    for (const item of items) {
        const id = requireText(item?.id, label + ' ID');
        if (seen.has(id)) throw new Error(label + ' IDs must be unique.');
        seen.add(id);
    }
}
function optionalText(value, label) {
    return value === undefined ? undefined : requireText(value, label);
}

/** Validate and normalize the serialized investment-ledger collections used by full-workspace backups. */
export function validateInvestmentLedgerCollections(input) {
    if (!input || typeof input !== 'object') throw new Error('Investment ledger collections are required.');
    const { investmentAccounts, investmentInstruments, investmentTransactions, investmentValuations } = input;
    for (const [items, label] of [
        [investmentAccounts, 'Investment accounts'], [investmentInstruments, 'Investment instruments'],
        [investmentTransactions, 'Investment transactions'], [investmentValuations, 'Investment valuations']
    ]) if (!Array.isArray(items)) throw new Error(label + ' must be arrays.');

    const accounts = investmentAccounts.map((item) => {
        const id = requireText(item?.id, 'Investment account ID');
        const name = requireText(item?.name, 'Investment account name');
        const institution = requireText(item?.institution, 'Investment account institution');
        if (!ACCOUNT_TYPES.has(item.type) || !CURRENCIES.has(item.currency)) throw new Error('Investment account type or currency is unsupported.');
        if (item.description !== undefined && typeof item.description !== 'string') throw new Error('Investment account description must be text.');
        return { id, name, institution, type: item.type, currency: item.currency, ...(item.description === undefined ? {} : { description: item.description }) };
    });
    unique(accounts, 'Investment account');

    const instruments = investmentInstruments.map((item) => {
        const id = requireText(item?.id, 'Investment instrument ID');
        const name = requireText(item?.name, 'Investment instrument name');
        if (!INSTRUMENT_TYPES.has(item.type) || !CURRENCIES.has(item.currency)) throw new Error('Investment instrument type or currency is unsupported.');
        const symbol = optionalText(item.symbol, 'Investment symbol');
        const exchange = optionalText(item.exchange, 'Investment exchange');
        const isin = optionalText(item.isin, 'Investment ISIN')?.toUpperCase();
        if (isin !== undefined && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)) throw new Error('Investment ISIN is invalid.');
        if (item.description !== undefined && typeof item.description !== 'string') throw new Error('Investment instrument description must be text.');
        return { id, name, type: item.type, currency: item.currency,
            ...(symbol === undefined ? {} : { symbol }), ...(exchange === undefined ? {} : { exchange }),
            ...(isin === undefined ? {} : { isin }), ...(item.description === undefined ? {} : { description: item.description }) };
    });
    unique(instruments, 'Investment instrument');

    const accountById = new Map(accounts.map((item) => [item.id, item]));
    const instrumentById = new Map(instruments.map((item) => [item.id, item]));
    const transactions = investmentTransactions.map((item) => {
        const id = requireText(item?.id, 'Investment transaction ID');
        const accountId = requireText(item.accountId, 'Investment transaction account ID');
        const instrumentId = requireText(item.instrumentId, 'Investment transaction instrument ID');
        const account = accountById.get(accountId);
        const instrument = instrumentById.get(instrumentId);
        if (!account || !instrument) throw new Error('Investment transaction references an unknown account or instrument.');
        if (!TRANSACTION_TYPES.has(item.type)) throw new Error('Investment transaction type is unsupported.');
        const cashAmount = requireMoney(item.cashAmount, 'Investment transaction cash amount');
        if (cashAmount.currency !== account.currency || cashAmount.currency !== instrument.currency) throw new Error('Investment transaction currencies must match its account and instrument.');
        const date = requireDate(item.date, 'Investment transaction date');
        const recordedAt = requireDate(item.recordedAt, 'Investment transaction recordedAt');
        const trade = item.type === 'Purchase' || item.type === 'Sale';
        let quantity; let unitPrice;
        if (trade) {
            if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('Trade quantity must be positive and finite.');
            quantity = item.quantity;
            unitPrice = requireMoney(item.unitPrice, 'Investment transaction unit price');
            if (unitPrice.currency !== cashAmount.currency || unitPrice.amount <= 0
                || !Number.isFinite(quantity * unitPrice.amount)
                || Math.abs(Math.abs(cashAmount.amount) - quantity * unitPrice.amount) > 0.01) {
                throw new Error('Trade cash amount must reconcile to quantity multiplied by unit price.');
            }
            if ((item.type === 'Purchase' && cashAmount.amount >= 0) || (item.type === 'Sale' && cashAmount.amount <= 0)) {
                throw new Error('Purchase cash must be negative and sale cash must be positive.');
            }
        } else if (item.quantity !== undefined || item.unitPrice !== undefined) {
            throw new Error('Non-trade transactions cannot include quantity or unit price.');
        }
        if ((item.type === 'Fee' || item.type === 'Tax') && cashAmount.amount >= 0) throw new Error('Fee and tax cash amounts must be negative.');
        if ((item.type === 'Dividend' || item.type === 'Interest') && cashAmount.amount <= 0) throw new Error('Dividend and interest cash amounts must be positive.');
        const externalReference = optionalText(item.externalReference, 'External reference');
        if (item.notes !== undefined && typeof item.notes !== 'string') throw new Error('Investment transaction notes must be text.');
        return { id, accountId, instrumentId, type: item.type, cashAmount, date, recordedAt,
            ...(quantity === undefined ? {} : { quantity }), ...(unitPrice === undefined ? {} : { unitPrice }),
            ...(externalReference === undefined ? {} : { externalReference }),
            ...(item.notes === undefined ? {} : { notes: item.notes }) };
    });
    unique(transactions, 'Investment transaction');

    const valuations = investmentValuations.map((item) => {
        const instrumentId = requireText(item?.instrumentId, 'Valuation instrument ID');
        const instrument = instrumentById.get(instrumentId);
        if (!instrument) throw new Error('Investment valuation references an unknown instrument.');
        const price = requireMoney(item.price, 'Investment valuation price');
        if (price.amount < 0 || price.currency !== instrument.currency) throw new Error('Investment valuation price must be non-negative and match instrument currency.');
        if (!SOURCE_TYPES.has(item.sourceType)) throw new Error('Investment valuation source type is unsupported.');
        return { instrumentId, price, asOf: requireDate(item.asOf, 'Valuation asOf'),
            recordedAt: requireDate(item.recordedAt, 'Valuation recordedAt'),
            sourceType: item.sourceType, sourceName: requireText(item.sourceName, 'Valuation source name') };
    });

    return { investmentAccounts: accounts, investmentInstruments: instruments,
        investmentTransactions: transactions, investmentValuations: valuations };
}
