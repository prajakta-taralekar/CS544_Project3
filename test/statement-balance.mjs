import makeAccountsServices from '../src/accounts-services.mjs';
import { DEFAULT_COUNT }  from '../src/defs.mjs';

import AccountsDao from './mem-accounts-dao.mjs';
import chai from 'chai';
const { expect } = chai;

import { JAN, FEB, MAR } from './test-data.mjs';

const ALL = [ ...JAN, ...FEB, ...MAR ];


describe('statement', () => {

  const TEST_HOLDER = 'Test Holder';

  let dao, accounts, id;
  beforeEach(async function () {
    dao = await AccountsDao.setup();
    accounts = makeAccountsServices(dao);
    id = await accounts.newAccount({holderId: TEST_HOLDER});
  });

  afterEach(async function () {
    await AccountsDao.tearDown(dao);
  });
  
  it('should return correct balance after all transactions', async () => {
    for (const a of ALL) { await accounts.newAct({id, ...a}); }
    const balance = ALL.reduce((acc, a) => acc + Number(a.amount), 0);
    const rounded = Number(balance.toFixed(2));
    const info = await accounts.info({id});
    expect(info.balance).to.equal(rounded);
  });

  it('should have correct statement balance at end-of-month', async () => {
    for (const a of ALL) { await accounts.newAct({id, ...a}); }
    const month = '2021-01';  //must be first month in data ALL
    const monthActs = ALL.filter(a => a.date.startsWith(month))
    const balance = monthActs.reduce((acc, a) => acc + Number(a.amount), 0);
    const rounded = Number(balance.toFixed(2));
    const statement = await
      accounts.statement({id, fromDate: `${month}-01`, toDate: `${month}-31`});
    expect(statement.length).to.equal(monthActs.length);
    expect(statement.slice(-1)[0].balance).to.equal(rounded);
  });

  it('should respect statement fromDate and toDate', async () => {
    for (const a of ALL) { await accounts.newAct({id, ...a}); }
    const [fromDate, toDate] = [ FEB[0].date, FEB.slice(-1)[0].date ];
    const balance =
      [...JAN, ...FEB].reduce((acc, a) => acc + Number(a.amount), 0);
    const rounded = Number(balance.toFixed(2));
    const statement =  await accounts.statement({id, fromDate, toDate});
    expect(statement.length).to.equal(FEB.length);
    expect(statement.map(a => a.memo)).to.deep.equal(FEB.map(a => a.memo));
    expect(statement.slice(-1)[0].balance).to.equal(rounded);
  });

  it('should generate statement in order by date', async () => {
    for (const a of ALL.reverse()) { await accounts.newAct({id, ...a}); }
    const statement =  await accounts.statement({id});
    expect(statement.every((a, i, s) => i === 0 || a.date >= s[i - 1].date))
      .to.equal(true);
  });

});