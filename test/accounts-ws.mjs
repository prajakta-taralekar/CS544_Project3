import makeAccountsServices from '../src/accounts-services.mjs';
import makeWs from '../src/accounts-ws.mjs';

import STATUS from 'http-status';
import { DEFAULT_COUNT } from '../src/defs.mjs';

import supertest from 'supertest';

import { JAN, FEB, MAR } from './test-data.mjs';
const ALL = [ ...JAN, ...FEB, ...MAR ];

//will run the project DAO using an in-memory mongodb server
import AccountsDao from './mem-accounts-dao.mjs';

import chai from 'chai';
const { expect } = chai;

const BASE = '/accounts';
describe('web services', () => {

  const TEST_HOLDER = 'Test Holder';
  
  //mocha will run beforeEach() before each test to set up these variables
  let ws, dao, accounts;
  beforeEach(async function () {
    dao = await AccountsDao.setup();
    accounts = makeAccountsServices(dao);
    const app = makeWs(accounts, BASE);
    ws = supertest(app);
  });
	 
  //mocha runs this after each test; we use this to clean up the DAO.
  afterEach(async function () {
    await AccountsDao.tearDown(dao);
  });
	 
  async function createAccount(holderId) {
    try {
      return await
        ws.post(`${BASE}`)
	  .set('Content-Type', 'application/json')
	  .send({ holderId});
    }
    catch (err) {
      console.error(err);
    }
  }
  
  async function createAct(id, params) {
    try {
      return await
        ws.post(`${BASE}/${id}/transactions`)
	  .set('Content-Type', 'application/json')
	  .send({id, ...params});
    }
    catch (err) {
      console.error(err);
    }
  }

  async function createAccountAndAct(actParams) {
    const res1 = await createAccount(TEST_HOLDER);
    const loc1 = res1.headers.location;
    const id1 = loc1.substring(loc1.indexOf(BASE) + BASE.length + 1);
    const res2 = await createAct(id1, actParams);
    const loc2 = res2.headers.location;
    const [ actId ] = loc2.match(/\w+$/);
    return [ id1, actId ];
  }

  function actUrl(id, actId) {
    const suffix = (actId !== undefined) ? `/${actId}` : '';
    return `${BASE}/${id}/transactions${suffix}`;
  }

  describe('accounts', () => {
  
    it('must create account with location', async () => {
      const res = await createAccount(TEST_HOLDER);
      expect(res.status).to.equal(STATUS.CREATED);
      expect(res.headers.location).to.match(new RegExp(`${BASE}/.+$`));
    });

    it('must get BAD_REQUEST for creating account without holder', async () => {
      const res = await createAccount();
      expect(res.status).to.equal(STATUS.BAD_REQUEST);
    });
  
    it('must retrieve created account', async () => {
      const res1 = await createAccount(TEST_HOLDER);
      const loc = res1.headers.location;
      const id = loc.substring(loc.indexOf(BASE) + BASE.length + 1);
      const res2 = await ws.get(`${BASE}/${id}`);
      expect(res2.status).to.equal(STATUS.OK);
      const newAccount = {id, holderId: TEST_HOLDER, balance: 0.00};
      expect(res2.body.result).to.deep.equal(newAccount);
    });

    it ('must return correct self link for retrieved account', async () => {
      const res1 = await createAccount(TEST_HOLDER);
      const loc = res1.headers.location;
      const id = loc.substring(loc.indexOf(BASE) + BASE.length + 1);
      const url = `${BASE}/${id}`;
      const res2 = await ws.get(url);
      expect(res2.status).to.equal(STATUS.OK);
      const links = res2.body.links;
      expect(links).to.have.length(1);
      expect(links[0].rel).to.equal('self');
      expect(links[0].href).to.match(new RegExp(`${url}$`));
    });
    
    it('must get 404 for bad account id', async () => {
      const res1 = await createAccount(TEST_HOLDER);
      const loc = res1.headers.location;
      const id = loc.substring(loc.indexOf(BASE) + BASE.length + 1);
      const res2 = await ws.get(`${BASE}/${id}x`);
      expect(res2.status).to.equal(STATUS.NOT_FOUND);
    });

    it('must retrieve created account with single self link', async () => {
      const res1 = await createAccount(TEST_HOLDER);
      const loc = res1.headers.location;
      const id = loc.substring(loc.indexOf(BASE) + BASE.length + 1);
      const res2 = await ws.get(`${BASE}/${id}`);
      expect(res2.status).to.equal(STATUS.OK);
      const links = res2.body.links;
      expect(links).to.have.lengthOf(1);
      expect(links[0].rel).to.equal('self');
      //supertest uses different  ephemeral port for each req
      expect(links[0].href.replace(/:\d+/, ''))
	.to.equal(loc.replace(/:\d+/, ''));
    });

  });

  describe ('single transaction', () => {

    it('must create transaction', async () => {
      const res1 = await createAccount(TEST_HOLDER);
      const loc = res1.headers.location;
      const id = loc.substring(loc.indexOf(BASE) + BASE.length + 1);
      const res2 = await createAct(id, JAN[0]);
      expect(res2.status).to.equal(STATUS.CREATED);
      const actRe = new RegExp(`${actUrl(id)}/.+$`);
      expect(res2.headers.location).to.match(actRe);
    });

    for (const miss of [ 'amount', 'date', 'memo' ]) {
      it(`must get BAD_REQUEST for missing param ${miss}`, async () => {
	const res1 = await createAccount(TEST_HOLDER);
	const loc = res1.headers.location;
	const id = loc.substring(loc.indexOf(BASE) + BASE.length + 1);
	const actParams = { ... JAN[0] };
	delete actParams[miss];
	const res2 = await createAct(id, actParams);
	expect(res2.status).to.equal(STATUS.BAD_REQUEST);
      });
    }
    
    for (const bad of [ 'amount', 'date' ]) {
      it(`must get BAD_REQUEST for bad  param ${bad}`, async () => {
	const res1 = await createAccount(TEST_HOLDER);
	const loc = res1.headers.location;
	const id = loc.substring(loc.indexOf(BASE) + BASE.length + 1);
	const actParams = { ... JAN[0] };
	actParams[bad] += 'x';
	const res2 = await createAct(id, actParams);
	expect(res2.status).to.equal(STATUS.BAD_REQUEST);
      });
    }
    
    it ('must retrieve created transaction', async () => {
      const actParams = JAN[0];
      const [ id, actId ] = await createAccountAndAct(actParams);
      const url = actUrl(id, actId);
      const res = await ws.get(url);
      expect(res.status).to.equal(STATUS.OK);
      const amount = Number(actParams.amount);
      expect(res.body.result).to.deep.equal({actId, ...actParams, amount});
    });

    it ('must return correct self link for retrieved transaction', async () => {
      const actParams = JAN[0];
      const [ id, actId ] = await createAccountAndAct(actParams);
      const url = actUrl(id, actId);
      const res = await ws.get(url);
      expect(res.status).to.equal(STATUS.OK);
      const links = res.body.links;
      expect(links).to.have.length(1);
      expect(links[0].rel).to.equal('self');
      expect(links[0].href).to.match(new RegExp(`${url}$`));
    });
    
    it ('must get 404 for bad account id', async () => {
      const actParams = JAN[0];
      const [ id, actId ] = await createAccountAndAct(actParams);
      const url = actUrl(id + 'x', actId);
      const res = await ws.get(url);
      expect(res.status).to.equal(STATUS.NOT_FOUND);
    });

    it ('must get 404 for bad transaction id', async () => {
      const actParams = JAN[0];
      const [ id, actId ] = await createAccountAndAct(actParams);
      const url = actUrl(id, actId + 'x');
      const res = await ws.get(url);
      expect(res.status).to.equal(STATUS.NOT_FOUND);
    });

    it ('must have correct balance after single transaction', async () => {
      const actParams = JAN[0];
      const [ id, actId ] = await createAccountAndAct(actParams);
      const res2 = await ws.get(`${BASE}/${id}`);
      expect(res2.status).to.equal(STATUS.OK);
      expect(res2.body.result.balance).to.equal(Number(actParams.amount));
    });

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

    async function doSearch(params={}) {
      const q = new URLSearchParams(params).toString();
      const suffix = (q.length > 0) ? `?${q}` : '';
      const url = BASE + suffix;
      return await ws.get(url);
    }
    
    it('must find all accounts when given unlimited count', async () => {
      const [ index, count ] = [0, 99999];
      const infos = await doSearch({index, count});
      expect(infos.status).to.equal(STATUS.OK);
      expect(infos.body.result).to.have.length(ids.length);
    });

    it('must find accounts for holder with infinite count', async () => {
      const [ index, count ] = [0, 99999];
      const holderId = HOLDERS[0];
      const infos = await doSearch({index, count, holderId});
      expect(infos.status).to.equal(STATUS.OK);
      expect(infos.body.result).to.have.length(N_ACCOUNTS_PER_HOLDER);
    });
    
    it('must respect count', async () => {
      const [ index, count ] = [ids.length - 2, 2];
      const infos = await doSearch({index, count});
      expect(infos.status).to.equal(STATUS.OK);
      expect(infos.body.result).to.have.length(count);
    });
    
    it('must respect index', async () => {
      const [ index, count ] = [ids.length - 1, 2];
      const infos = await doSearch({index, count});
      expect(infos.status).to.equal(STATUS.OK);
      expect(infos.body.result).to.have.length(1);
    });

    it('must detect BAD_REQUEST for bad index', async () => {
      const [index, count] = [2, 3];
      const res = await doSearch({index: '2x', count});
      expect(res.status).to.equal(STATUS.BAD_REQUEST);
    });

    it('must detect BAD_REQUEST for bad count', async () => {
      const [index, count] = [2, 3];
      const res = await doSearch({index, count: '3x'});
      expect(res.status).to.equal(STATUS.BAD_REQUEST);
    });

    it('must have self link in each result', async () => {
      const [ index, count ] = [0, ids.length];
      const infos = await doSearch({index, count});
      expect(infos.status).to.equal(STATUS.OK);
      const allLinks = infos.body.result.map(r => r.links);
      expect(allLinks.every(links => links.length === 1)).to.equal(true);
      expect(allLinks.every(links => links[0].rel === 'self')).to.equal(true);
      const actualIds = allLinks.map(links => links[0].href.match(/\w+$/)[0]);
      expect(actualIds.sort()).to.deep.equal(ids.sort());
    });
    
    it('must get single last transaction', async () => {
      const index = ids.length - 1;
      const res = await doSearch({index});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(1);
      expect(results[0].id).is.oneOf(ids);
    });

    it ('must have next and prev links for intermediate results', async () => {
      const [index, count] = [2, ids.length-3];
      const res = await doSearch({index, count});
      expect(res.status).to.equal(STATUS.OK);
      const links = res.body.links;
      expect(links).to.have.length(3);
      const next = links.find(link => link.rel === 'next');
      expect(next).to.not.be.undefined;
      const prev = links.find(link => link.rel === 'prev');
      expect(prev).to.not.be.undefined;
      const nextIndex = next.href.match(/index=(\d+)/)[1];
      expect(Number(nextIndex)).to.equal(index + count);
      const prevIndex = prev.href.match(/index=(\d+)/)[1];
      expect(Number(prevIndex)).to.equal(index > count ? index - count : 0);
    });

    it ('must have next but no prev links for first results', async () => {
      const [index, count] = [0, DEFAULT_COUNT];
      const res = await doSearch({index, count});
      expect(res.status).to.equal(STATUS.OK);
      const links = res.body.links;
      expect(links).to.have.length(2);
      const next = links.find(link => link.rel === 'next');
      expect(next).to.not.be.undefined;
      const prev = links.find(link => link.rel === 'prev');
      expect(prev).to.be.undefined;
      const nextIndex = next.href.match(/index=(\d+)/)[1];
      expect(Number(nextIndex)).to.equal(index + count);
    });

    it ('must have prev but no next links for last results', async () => {
      const [index, count] = [ids.length - DEFAULT_COUNT, DEFAULT_COUNT];
      const res = await doSearch({index, count});
      expect(res.status).to.equal(STATUS.OK);
      const links = res.body.links;
      expect(links).to.have.length(2);
      const next = links.find(link => link.rel === 'next');
      expect(next).to.be.undefined;
      const prev = links.find(link => link.rel === 'prev');
      expect(prev).to.not.be.undefined;
      const prevIndex = prev.href.match(/index=(\d+)/)[1];
      expect(Number(prevIndex)).to.equal(index > count ? index - count : 0);
    });


  });

  describe('query', () => {
    let id, actIds;

    beforeEach(async function () {
      id = await accounts.newAccount({holderId: TEST_HOLDER});
      actIds = [];
      for (const a of ALL) { actIds.push(await accounts.newAct({id, ...a})); }
    });

    async function doQuery(id, params={}) {
      const q = new URLSearchParams(params).toString();
      const suffix = (q.length > 0) ? `?${q}` : '';
      const url = actUrl(id) + suffix;
      return ws.get(url);
    }

    it('must return all transactions for query without filter', async () => {
      const res = await doQuery(id, {count: '999'});
      expect(res.status).to.equal(STATUS.OK);
      expect(res.body.result).to.have.lengthOf(ALL.length);
    });

    it('must generate query results in order by date', async () => {
      const res = await doQuery(id, {count: '999'});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results.every((a, i, r) => i === 0 || a.date >= r[i - 1].date))
	.to.equal(true);
    });

    it('max DEFAULT_COUNT transactions for query without filter', async () => {
      const res = await doQuery(id);
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(DEFAULT_COUNT);
    });

    it('must return one transaction for a specified actId', async () => {
      const actId = actIds[Math.floor(actIds.length/2)];
      const res = await doQuery(id, {count: '999', actId});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(1);
    });
  
    it('must return no transactions for a bad actId', async () => {
      const actId = actIds[Math.floor(actIds.length/2)] + 'xx';
      const res = await doQuery(id, {count: '999', actId});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(0);
    });

    it('no transactions for actId and non-matching date', async () => {
      const actId = actIds[actIds.length/2];
      const res = await doQuery(id, {date: '2020-12-31', actId});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(0);
    });
    
    it('have 2 transactions with memo containing "winter"', async () => {
      const res = await doQuery(id, {memoText: 'winter'});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(2);
    });

    it('have 2 transactions with case-insensitive "wIntER" memo', async () => {
      const res = await doQuery(id, {memoText: 'wIntER'});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(2);
    });
  
    it('no transactions for non-matching memoText',  async () => {
      const res = await doQuery(id, {memoText: 'xxx'});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(0);
    });

    it('must respect index and count', async () => {
      const [index, count] = [2, 3];
      const res = await doQuery(id, {index, count});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(count);
      expect(results.map(a => a.actId))
	.to.deep.equal(actIds.slice(index, index+count));
    });

    it('must detect BAD_REQUEST for bad index', async () => {
      const [index, count] = [2, 3];
      const res = await doQuery(id, {index: '2x', count});
      expect(res.status).to.equal(STATUS.BAD_REQUEST);
    });

    it('must detect BAD_REQUEST for bad count', async () => {
      const [index, count] = [2, 3];
      const res = await doQuery(id, {index, count: '3x'});
      expect(res.status).to.equal(STATUS.BAD_REQUEST);
    });

    it('must have working self links in returned transactions', async () => {
      const [index, count] = [4, 4];
      const res = await doQuery(id, {index, count});
      expect(res.status).to.equal(STATUS.OK);
      const linksAll = res.body.result.map(r => r.links);
      expect(linksAll).to.have.length(count);
      expect(linksAll.every(links => links.length === 1)).to.equal(true);
      const getActId = href => href.match(/\w+$/)[0];
      const linkActIds = linksAll.map(links => getActId(links[0].href));
      expect(linkActIds).to.deep.equal(actIds.slice(index, index + count));
    });

    it('must get single last transaction', async () => {
      const index = actIds.length - 1;
      const res = await doQuery(id, {index});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(1);
      expect(results.map(a => a.actId))
	.to.deep.equal(actIds.slice(index));
    });

    it ('must have next and prev links for intermediate results', async () => {
      const [index, count] = [4, 4];
      const res = await doQuery(id, {index, count});
      expect(res.status).to.equal(STATUS.OK);
      const links = res.body.links;
      expect(links).to.have.length(3);
      const next = links.find(link => link.rel === 'next');
      expect(next).to.not.be.undefined;
      const prev = links.find(link => link.rel === 'prev');
      expect(prev).to.not.be.undefined;
      const nextIndex = next.href.match(/index=(\d+)/)[1];
      expect(Number(nextIndex)).to.equal(index + count);
      const prevIndex = prev.href.match(/index=(\d+)/)[1];
      expect(Number(prevIndex)).to.equal(index > count ? index - count : 0);
    });

    it ('must have next but no prev links for first results', async () => {
      const [index, count] = [0, DEFAULT_COUNT];
      const res = await doQuery(id, {index, count});
      expect(res.status).to.equal(STATUS.OK);
      const links = res.body.links;
      expect(links).to.have.length(2);
      const next = links.find(link => link.rel === 'next');
      expect(next).to.not.be.undefined;
      const prev = links.find(link => link.rel === 'prev');
      expect(prev).to.be.undefined;
      const nextIndex = next.href.match(/index=(\d+)/)[1];
      expect(Number(nextIndex)).to.equal(index + count);
    });

    it ('must have prev but no next links for last results', async () => {
      const [index, count] = [ALL.length - DEFAULT_COUNT, DEFAULT_COUNT];
      const res = await doQuery(id, {index, count});
      expect(res.status).to.equal(STATUS.OK);
      const links = res.body.links;
      expect(links).to.have.length(2);
      const next = links.find(link => link.rel === 'next');
      expect(next).to.be.undefined;
      const prev = links.find(link => link.rel === 'prev');
      expect(prev).to.not.be.undefined;
      const prevIndex = prev.href.match(/index=(\d+)/)[1];
      expect(Number(prevIndex)).to.equal(index > count ? index - count : 0);
    });

    it('must return BAD_REQUEST for a bad date in query', async () => {
      const res = await doQuery(id, {date: '2021-02-29'});
      expect(res.status).to.equal(STATUS.BAD_REQUEST);
    });

    it('must get all transactions for a particular date', async () => {
      const res = await doQuery(id, {date: '2021-01-10'});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(3);
    });

    it('must get no transactions for an inactive date', async () => {
      const res = await doQuery(id, {date: '2021-01-11'});
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result.map(r => r.result);
      expect(results).to.have.length(0);
    });

  });

  describe('statement', () => {
  
    let id;

    beforeEach(async function () {
      id = await accounts.newAccount({holderId: TEST_HOLDER});
      for (const a of ALL) { await accounts.newAct({id, ...a}); }
    });

    async function doStmt(id, fromDate, toDate=fromDate) {
      const stmtUrl = `${BASE}/${id}/statements/${fromDate}/${toDate}`;
      return await ws.get(stmtUrl);
    }

    it('must return correct balance after all transactions', async () => {
      const balance = ALL.reduce((acc, a) => acc + Number(a.amount), 0);
      const rounded = Number(balance.toFixed(2));
      const res = await ws.get(`${BASE}/${id}`);
      expect(res.status).to.equal(STATUS.OK);
      const result = res.body.result;
      expect(result.balance).to.equal(rounded);
    });

    it('must have correct statement balance at end-of-month', async () => {
      const month = '2021-01';  //must be first month in data ALL
      const monthActs = ALL.filter(a => a.date.startsWith(month))
      const balance = monthActs.reduce((acc, a) => acc + Number(a.amount), 0);
      const rounded = Number(balance.toFixed(2));
      const res = await doStmt(id, `${month}-01`, `${month}-31`);
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result;
      expect(results.length).to.equal(monthActs.length);
      expect(results.slice(-1)[0].balance).to.equal(rounded);
    });

    it('must respect statement fromDate and toDate', async () => {
      const [fromDate, toDate] = [ FEB[0].date, FEB.slice(-1)[0].date ];
      const balance =
	    [...JAN, ...FEB].reduce((acc, a) => acc + Number(a.amount), 0);
      const rounded = Number(balance.toFixed(2));
      const res = await doStmt(id, fromDate, toDate);
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result;
      expect(results.length).to.equal(FEB.length); 
      expect(results.map(a => a.memo)).to.deep.equal(FEB.map(a => a.memo));
      expect(results.slice(-1)[0].balance).to.equal(rounded);
    });

    it('must generate statement in order by date', async () => {
      const fromDate = ALL[0].date;
      const toDate = ALL.slice(-1)[0].date;
      const res = await doStmt(id, fromDate, toDate);
      expect(res.status).to.equal(STATUS.OK);
      const results = res.body.result;
      expect(results.every((a, i, s) => i === 0 || a.date >= s[i - 1].date))
	.to.equal(true);
  });

});
  
});
