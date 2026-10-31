import type { Identifier } from '@pfo/core';

import { Currency } from '../common/Currency.js';
import { NamedEntity } from '../common/NamedEntity.js';
import { InvestmentAccountType } from './InvestmentAccountType.js';

export class InvestmentAccount extends NamedEntity {
    public readonly institution: string;

    public constructor(
        id: Identifier,
        name: string,
        public readonly type: InvestmentAccountType,
        public readonly currency: Currency,
        institution: string,
        description?: string
    ) {
        super(id, name, description);

        if (!Object.values(InvestmentAccountType).includes(type)) {
            throw new RangeError('Investment account type is not supported.');
        }
        if (!Object.values(Currency).includes(currency)) {
            throw new RangeError('Investment account currency is not supported.');
        }
        if (typeof institution !== 'string' || institution.trim().length === 0) {
            throw new RangeError('Investment account institution cannot be empty.');
        }

        this.institution = institution.trim();
    }
}
