import makeAccountsServices from '../src/accounts-services.mjs';
import { DEFAULT_COUNT }  from '../src/defs.mjs';

import AccountsDao from './mem-accounts-dao.mjs';
import chai from 'chai';
const { expect } = chai;

import { JAN, FEB, MAR } from './test-data.mjs';

const ALL = [ ...JAN, ...FEB, ...MAR ];


describe('query', () => {

  const TEST_HOLDER = 'Test Holder';

  let accounts, id, actIds, dao;

  beforeEach(async function () {
    dao = await AccountsDao.setup();
    accounts = makeAccountsServices(dao);
    id = await accounts.newAccount({holderId: TEST_HOLDER});
    actIds = [];
    for (const a of ALL) { actIds.push(await accounts.newAct({id, ...a})); }
  });

  afterEach(async function () {
    await AccountsDao.tearDown(dao);
  });
  
  it('should return all transactions for query without filter', async () => {
    const query = await accounts.query({id, count: '999'});
    expect(query).to.have.length(ALL.length);
  });

  it('should generate query results in order by date', async () => {
    const id = await accounts.newAccount({ holderId: TEST_HOLDER });
    for (const a of [...ALL].reverse()) {  await accounts.newAct({id, ...a}); }
    const results =  await accounts.query({id});
    expect(results.every((a, i, r) => i === 0 || a.date >= r[i - 1].date))
      .to.equal(true);
  });

  it('max DEFAULT_COUNT transactions for query without filter', async () => {
    const query = await accounts.query({id});
    expect(query).to.have.length(DEFAULT_COUNT);
  });

  it('should return one transaction for a specified actId', async () => {
    const actId = actIds[Math.floor(actIds.length/2)];
    const query = await accounts.query({id, actId});
    expect(query).to.have.length(1);
  });
  
  it('should return no transactions for a bad actId', async () => {
    const actId = actIds[actIds.length/2] + 'xx';
    const query = await accounts.query({id, actId});
    expect(query).to.have.length(0);
  });
  
  it('no transactions for actId and non-matching date', async () => {
    const actId = actIds[actIds.length/2];
    const query = await accounts.query({id, actId, date: '2020-12-31'});
    expect(query).to.have.length(0);
  });
  
  it('have 2 transactions with memo containing "winter"', async () => {
    const query = await accounts.query({id, memoText: 'winter'});
    expect(query).to.have.length(2);
  });
  
  it('have 2 transactions with case-insensitive "wIntER" in memo', async () => {
    const query = await accounts.query({id, memoText: 'wIntER'});
    expect(query).to.have.length(2);
  });
  
  it('no transactions for non-matching memoText',  async () => {
    const query = await accounts.query({id, memoText: 'xxx'});
    expect(query).to.have.length(0);
  });

  it('should respect index and count', async () => {
    const [index, count] = [2, 3];
    const actIds1 =
      await accounts.query({id, index: String(index), count: String(count),});
    expect(actIds1).to.have.length(count);
    expect(actIds1.map(a => a.actId))
      .to.deep.equal(actIds.slice(index, index+count));
  });

  it('should detect BAD_VAL error for a bad date in query', async () => {
    const err = await accounts.query({id, date: '2021-02-29'});
    expect(err).to.have.property('errors');
    expect(err.errors?.[0]?.options?.code).to.equal('BAD_VAL');
  });

  it('should get all transactions for a particular date', async () => {
    const query = await accounts.query({id, date: '2021-01-10'});
    expect(query).to.have.length(3);
  });

  it('should get no transactions for an inactive date', async () => {
    const query = await accounts.query({id, date: '2021-01-11'});
    expect(query).to.have.length(0);
  });

});