//account services will use the DAO being built for this project
import makeAccountsServices from '../src/accounts-services.mjs';

//will run the project DAO using an in-memory mongodb server
import AccountsDao from './mem-accounts-dao.mjs';

import chai from 'chai';
const { expect } = chai;

describe('basic accounts', () => {

  const TEST_HOLDER = 'Test Holder';

  //mocha will run beforeEach() before each test to set up these variables
  let accounts, dao;
  beforeEach(async function () {
    dao = await AccountsDao.setup();
    accounts = makeAccountsServices(dao);
  });

  //mocha runs this after each test; we use this to clean up the DAO.
  afterEach(async function () {
    await AccountsDao.tearDown(dao);
  });
  
  it('should return account ID when creating an account', async () => {
    const ret = await accounts.newAccount({holderId: TEST_HOLDER});
   expect(ret).to.be.a('string');
  });
  
  it('should return BAD_REQ error when holderId is not specified', async () => {
    const account = await accounts.newAccount();
    expect(account).to.have.property('errors');
    expect(account.errors?.[0]?.options?.code).to.equal('BAD_REQ');
  });

  it('should create multiple accounts for the same holderId', async () => {
    const id1 = await accounts.newAccount({ holderId: TEST_HOLDER});
    const id2 = await accounts.newAccount({ holderId: TEST_HOLDER});
    expect(id1).to.not.equal(id2);
  });

  it('should retrieve a created account', async () => {
    const id = await accounts.newAccount({ holderId: TEST_HOLDER});
    const info = await accounts.info({id});
    expect(info).to.not.be.undefined.and.not.be.null;
    expect(info.id).to.equal(id);    
  });

  it('should have correct holderId when retrieving a account', async () => {
    const id = await accounts.newAccount({ holderId: TEST_HOLDER});
    const info = await accounts.info({id});
    expect(info.holderId).to.equal(TEST_HOLDER);
  });

  it('should have a 0 balance for a newly created account', async () => {
    const id = await accounts.newAccount({ holderId: TEST_HOLDER});
    const info = await accounts.info({id});
    expect(info.balance).to.equal(0);
  });

  it('NOT_FOUND error when retrieving by bad account ID', async () => {
    const id = await accounts.newAccount({ holderId: TEST_HOLDER});
    const info = await accounts.info({id: id + 'x' });
    expect(info).to.have.property('errors');
    expect(info?.errors?.[0]?.options?.code).to.equal('NOT_FOUND');
  });

  describe('search accounts', () => {

    const HOLDERS = [ 'Test Holder1', 'Test Holder2', 'Test Holder3', ];
    const N_ACCOUNTS_PER_HOLDER = 4;
    let ids;

    beforeEach(async () => {
      ids = [];
      for (let i = 0; i < N_ACCOUNTS_PER_HOLDER; i++) {
	for (const holderId of HOLDERS) {
	  ids.push(await accounts.newAccount({holderId}));
	}
      }
    });

    it('should find all accounts when given unlimited count', async () => {
      const [ index, count ] = [0, 99999];
      const infos = await accounts.searchAccounts({index, count});
      expect(infos).to.have.length(ids.length);
    });

    it('should find accounts for holder with infinite count', async () => {
      const [ index, count ] = [0, 99999];
      const holderId = HOLDERS[0];
      const infos = await accounts.searchAccounts({holderId, index, count});
      expect(infos).to.have.length(N_ACCOUNTS_PER_HOLDER);
    });
    
    it('should respect count', async () => {
      const [ index, count ] = [ids.length - 2, 2];
      const infos = await accounts.searchAccounts({index, count});
      expect(infos).to.have.length(count);
    });
    
    it('should respect index', async () => {
      const [ index, count ] = [ids.length - 1, 2];
      const infos = await accounts.searchAccounts({index, count});
      expect(infos).to.have.length(1);
    });
    
  });
  
});
