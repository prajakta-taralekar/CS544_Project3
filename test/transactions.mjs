import makeAccountsServices from '../src/accounts-services.mjs';
import { DEFAULT_COUNT }  from '../src/defs.mjs';

import AccountsDao from './mem-accounts-dao.mjs';
import chai from 'chai';
const { expect } = chai;

describe('transaction creation', () => {

  const TEST_HOLDER = 'Test Holder';
  const AMOUNT = 1.11;

  let dao, accounts, act0, id;
  beforeEach(async function () {
    dao = await AccountsDao.setup();
    accounts = makeAccountsServices(dao);
    id = await accounts.newAccount({holderId: TEST_HOLDER});
    act0 = { amount: String(AMOUNT), date: '2021-01-15', memo: 'test' };
  });

  afterEach(async function () {
    await AccountsDao.tearDown(dao);
  });
  
  
  it('should create a transaction without any errors', async () => {
    const act = { id, ...act0 };
    const ret = await accounts.newAct(act);
    expect(ret).to.be.a('string');
  });
  
  it('should retrieve balance after one successful transaction', async () => {
    const act = { id, ...act0 };
    await accounts.newAct(act);
    const info = await accounts.info({id});
    expect(info.balance).to.equal(AMOUNT);
  });
  
  it('BAD_REQ error if creating transaction without account ID', async () => {
       const act = { ...act0 };
       const err = await accounts.newAct(act);
       expect(err).to.have.property('errors');
       expect(err.errors?.[0]?.options?.code).to.equal('BAD_REQ');
    });

  it('BAD_REQ error if creating a transaction without a date', async () => {
       const act = { id, ...act0 };
       delete act.date;
       const err = await accounts.newAct(act);
       expect(err).to.have.property('errors');
       expect(err.errors?.[0]?.options?.code).to.equal('BAD_REQ');
    });

  it('BAD_REQ error if creating a transaction without a amount', async () => {
       const act = { id, ...act0 };
       delete act.amount;
       const err = await accounts.newAct(act);
       expect(err).to.have.property('errors');
       expect(err.errors?.[0]?.options?.code).to.equal('BAD_REQ');
    });

  it('BAD_VAL error if creating a transaction with a bad amount', async () => {
       const act = { id, ...act0 };
       act.amount = '1.1';
       const err = await accounts.newAct(act);
       expect(err).to.have.property('errors');
       expect(err.errors?.[0]?.options?.code).to.equal('BAD_VAL');
    });

  it('BAD_REQ error if creating a transaction without a memo', async () => {
       const act = { id, ...act0 };
       delete act.memo;
       const err = await accounts.newAct(act);
       expect(err).to.have.property('errors');
       expect(err.errors?.[0]?.options?.code).to.equal('BAD_REQ');
    });

  it('BAD_VAL error if creating a transaction with a bad date', async () => {
       const act = { id, ...act0 };
       act.date = '2021-02-29';
       const err = await accounts.newAct(act);
       expect(err).to.have.property('errors');
       expect(err.errors?.[0]?.options?.code).to.equal('BAD_VAL');
    });

  
  
});