#!/usr/bin/env node

import Path from 'path';

export default async function addData(accounts, nAccounts, nActsPerAccount) {
  for (let a = 0; a < nAccounts; a++) {
    const id = await accounts.newAccount({ holderId: randHolder() });
    await accounts.newAct({id, amount: randAmount(+1, 1000), date: '2021-01-01',
			   memo: randChoice(INITS)});
    for (let t = 0; t < nActsPerAccount; t++) {
      const type = randChoice([-1, +1]);
      const memo = randChoice(type > 0 ? DEPOSITS : WITHDRAWALS);
      const amount = randAmount(type, 50);
      const date = randDate();
      await accounts.newAct({id, amount, date, memo});
    }
  }
}

class DummyAccounts {
  constructor() { this.accounts = []; }

  newAccount(params) {
    this.accounts.push({ ...params, acts: [] });
    return (this.accounts.length - 1).toString();
  }
  
  newAct(params) {
    const account = this.accounts[Number(params.id)];
    account.acts.push({...params});
    return account.acts - 1;
  }

  sort() {
    const cmp = (a, b) => a.date < b.date ? -1 : a.date > b.date ? +1 : 0;
    for (const a of this.accounts) a.acts.sort((a, b) => cmp(a, b));
  }
}

function randDate() {
  const month = randChoice(MONTHS);
  const day = randInt(1, DAYS[month - 1] + 1);
  const pad = i => i.toString().padStart(2, '0');
  return `${YEAR}-${pad(month)}-${pad(day)}`;
}

function randHolder() {
  return randChoice(['homer', 'bart', 'marge', 'lisa', 'maggie', 'john',
		     'carey', 'mary', 'mariah', 'jane', 'julie', 'tony', ]);
}


function randAmount(sign, base) {
  const dollars = sign*randInt(base/2, base*2);
  const cents = randInt(0, 100);
  return `${dollars}.${cents.toString().padStart(2, '0')}`;
}

function randChoice(choices) {
  return choices[randInt(0, choices.length)];
}

//From <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random>
/** Returns random int in [min, max) */
function randInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; 
}

const YEAR = 2021;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30];
const WITHDRAWALS = [
  'rent',
  'bloodsucking landlord',
  'groceries',
  'gotta eat',
  'tuition',
  'credit card payment',
  'need some spending money',
  'split meal with karen',
  'dinner with the gang',
  'club dues',
  'green fees',
  'fitness club payment',
  'mortgage payment',
  'car payment',
  'car repair',
  'computer repair',
  'cell phone bill',
  'movies',
  'snacks at movie',
  'cell phone repair',
  'new batteries for cell phone',
  'laptop repair',
  'transfer to my other account',
  'internet bill',
];


const DEPOSITS = [
  'slave wages',
  'transfer from my other account',
  'interest',
  'closing my CD',
  'salary',
  'check from mary for meal',
  'cashback on credit card',
  'rental income',
  'royalties',
  'from mary for dinner',
  'repayment from john',
  'tips',
];

const INITS = [
  'initial deposit',
  'start my account',
];

		 
if (Path.basename(process.argv[1]) === 'rand-data.mjs') {
  const dummy = new DummyAccounts();
  addData(dummy, 2, 100);
  dummy.sort();
  console.dir(dummy.accounts, { depth: null, maxArrayLength: null});
}