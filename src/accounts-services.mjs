import { getDate } from './util.mjs';
import { DEFAULT_COUNT } from './defs.mjs';

import { makeValidator } from 'cs544-js-utils';

export default function makeAccountsServices(dao) {
  const checker = makeValidator(CMDS);
  const fn = cmd => params =>  {
    const valid = checker.validate(cmd, params);
    return valid.errors ? valid : dao[cmd].call(dao, valid);
  };
  const services =
    Object.fromEntries(Object.keys(CMDS).map(c => [c, fn(c)]));
  return services;
}

function chkDate(yyyymmdd) {
  const chk = getDate(yyyymmdd);
  return chk.errors ? chk.errors[0].message : '';
}

const CMDS = {
  newAccount: {
    fields: {
      holderId: {
        name: 'account holder ID',
        required: true,
      },
    },
    doc: `
      create a new account and return its ID.
    `,
  },

  info: {
    fields: {
      id: {
        name: 'account ID',
        required: true,
      },
    },
    doc: `
      return { id, holderId, balance } for account identified by id.
    `,
  },
 
  searchAccounts: {
    fields: {
      id: {
        name: 'account ID',
      },
      holderId: {
        name: 'account holder ID',
      },
      index: {
        name: 'start index',
        chk: /\d+/,
        default: '0',
        valFn: valStr => Number(valStr),
      },
      count: {
        name: 'retrieved count',
        chk: /\d+/,
        default: String(DEFAULT_COUNT),
        valFn: valStr => Number(valStr),
      },
    },
    doc: `
      return list of { id, holderId, balance } of accounts
    `,
  },

  newAct: {
    fields: {
      id: {
        name: 'account ID',
        required: true,
      },
      amount: {
        name: 'transaction amount',
        chk: /[-+]?\d+\.\d\d/,
        valFn: valStr => Number(valStr.replace(/\./, '')),
        required: true,
      },
      date: {
        name: 'transaction date',
        chk: chkDate,
        required: true,
      },
      memo: {
        name: 'transaction memo',
        required: true,
      },
    },
    doc: `
      add transaction { amount, date, memo } to account id and
      return ID of newly created transaction.
    `,
  },

  query: {
    fields: {
      id: {
        name: 'account ID',
        required: true,
      },
      actId: {
        name: 'transaction ID',
      },
      date: {
        name: 'transaction date',
        chk: chkDate,
      },
      memoText: {
        name: 'memo substring',
      },
      index: {
        name: 'start index',
        chk: /\d+/,
        default: '0',
        valFn: valStr => Number(valStr),
      },
      count: {
        name: 'retrieved count',
        chk: /\d+/,
        default: String(DEFAULT_COUNT),
        valFn: valStr => Number(valStr),
      },
    },
    doc: `
      return list of { actId, amount, date, memo } of transactions
      for account id.
    `,
  },
    
  statement: {
    fields: {
      id: {
        name: 'account ID',
        required: true,
      },
      fromDate: {
        name: 'from date',
        chk: chkDate,
	required: true,
      },
      toDate: {
        name: 'to date',
        chk: chkDate,
	required: true,
      },
    },
    doc: `
      return list of { actId, amount, date, memo, balance } extended
      transactions for account id between fromDate and toDate.
    `,
  },
    
};