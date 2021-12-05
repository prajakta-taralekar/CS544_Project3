import mongo from 'mongodb';

/** Return DAO for DB URL url and options. Only option is
 *  options.doClear; if specified, then all data should be cleared.
 * 
 *  Returned DAO should support a close() method.  
 *
 *  Returned DAO should also support a newAccount(), info(), newAct(),
 *  query() and statement() methods with each method taking a single
 *  params object as argument.  The params argument and return values
 *  for these methods are as documented for project 1.
 *
 *  It is assumed that params is fully validated except that id may
 *  not refer to an existing account.  Can also assume that values
 *  in params have been converted as necessary:
 * 
 *    params.amount:  Number in cents.
 *    params.index:   Number with default filled in.
 *    params.count:   Number with default filled in.
 *
 *  (see table in accounts-services.mjs for validations and conversions).
 *
 *  [Note that unlike project 1, there is no intermediate account()
 *  method or corresponding object, all methods operate directly on
 *  the returned DAO.]
 *
 */
export default async function makeAccountsDao(url, options={}) {
  return await Dao.make(url, options);
}

//use in mongo.connect() to avoid warning
const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

class Dao {
  constructor(params) {  Object.assign(this, params); }

  //factory method which performs connection set up async calls
  //and all other necessary initialization, sets up properties
  //to be stored in the Dao instance and finally returns
  //the instance created using the properties.
  //Returns object containsing an errors property if a db errors.
  static async make(dbUrl, options={}) {
    const params = {};
    try {
      params._client = await mongo.connect(dbUrl, MONGO_CONNECT_OPTIONS);
      const db = params._client.db();
      for (const c of COLLECTIONS) { params[c] = db.collection(c); }
      // params[NEXT_ID_KEY] =
      //   (await params._idBase.findOne({_id: NEXT_ID_KEY}))?.[NEXT_ID_KEY] ?? 0;
    }
    catch (err) {
      const message = `cannot set up db at URL "${dbUrl}": ${err}`;
      return { errors: [ { message, options: { code: 'DB'} }, ] };
    }
    const dao = new Dao(params);
    if (options.doClear) await dao._clear();
    return dao;
  }

  
  /** Return a new order object { id, eateryId } having an id
   *  field set to an ID different from that of any existing order.
   *  The order-id should be hard to guess.
   *  Returns an object with errors property if db errors encountered.
   */ 
  async newAccount({holderId}) {
    try {
      const id = await this._nextId();
      if (id.errors) return id;
      const dbAccount = { _id: id, id, holderId };
      const nIns = (await this._accounts.insertOne(dbAccount))?.insertedCount;
      if (nIns !== 1) {
	const msg = `account create: expected 1 insert, got ${nIns} updates`;
	return { errors: [ { message: msg, options: { code: 'DB'} } ] };
      }
      return id
    }
    catch (err) {
      const msg = `cannot create new account: ${err}`;
      return { errors: [ { message: msg, options: { code: 'DB'} } ] };
    }
  }
 
  /** Release all resources held by this instance.
   *  Specifically, close any database connections.
   */
  async close() {
    await this._client.close();
  }

  async info({id}) {
    const account = await this._account(id);
    if (account.errors) return account;
    return { ...account, balance: (await this._balanceInCents(id))/100, };
  }

  async searchAccounts(params) {
    try {
      const q = { ...params };
      delete q.index; delete q.count;
      const cursor = await this._accounts.find(q);
      const dbAccounts = await cursor.sort({ holderId: 1, _id: 1})
	.skip(params.index)
        .limit(params.count)
        .toArray();
      const accounts =
	dbAccounts.map(a => { const a1 = {...a}; delete a1._id; return a1; });
      return accounts;
    }
    catch (err) {
      console.error(err);
      const msg = `cannot create new account: ${err}`;
      return { errors: [ { message: msg, options: { code: 'DB'} } ] };
    }
  }

  async newAct(params) {
    const account = await this._account(params.id);
    if (account.errors) return account;
    try {
      const actId = await this._nextId();
      const dbAct = { _id: actId, ...params };
      const nIns = (await this._transactions.insertOne(dbAct))?.insertedCount;
      if (nIns !== 1) {
	const message =
	  `transaction create: expected 1 insert, got ${nIns} updates`;
	return { errors: [ { message, options: { code: 'DB'} } ] };
      }
      return actId;
    }
    catch (err) {
      const message =
	`cannot create new transaction for account ${params.id}: ${err}`;
      return { errors: [ { message, options: { code: 'DB'} } ] };
    }
  }

  async query(params) {
    const account = await this._account(params.id);
    if (account.errors) return account;
    try {
      const q = { id: params.id };
      if (params.actId) q._id = params.actId;
      if (params.date) q.date = params.date;
      if (params.memoText) q.memo = new RegExp(params.memoText, 'i')
      const cursor = await this._transactions.find(q);
      const dbActs =  await cursor.sort({date: 1, _id: 1 })
	.skip(params.index)
        .limit(params.count)
        .toArray();
      return dbActs.map( a => {
	return { actId: a._id, amount: a.amount/100,
		 date: a.date, memo: a.memo, };
      });
    }
    catch (err) {
      const message =
	`cannot query transaction for account ${params.id}: ${err}`;
      return { errors: [ { message, options: { code: 'DB'} } ] };
    }
  }

  async statement(params) {
    const account = await this._account(params.id);
    if (account.errors) return account;
    try {
      const { fromDate: from, toDate: to } = params;
      const q = { id: params.id };
      if (from || to) {
	let d = {};
	if (from) d.$gte = from;
	if (to) d.$lte = to;
	q.date = d;
      }
      const cursor = await this._transactions.find(q);
      const dbActs =  await cursor.sort({date: 1, _id: 1}).toArray();
      let cents = from ? await this._balanceInCents(params.id, from) : 0;
      const acts = [];
      dbActs.forEach( a => {
	cents += a.amount;
	acts.push({ actId: a._id, amount: a.amount/100,
  		    date: a.date, memo: a.memo, balance: cents/100, });
      });
      return acts;
    }
    catch (err) {
      const message =
	`cannot get statement for account ${params.id}: ${err}`;
      return { errors: [ { message, options: { code: 'DB'} } ] };
    }
  }

  //id is a valid account id
  async _balanceInCents(id, toDate=undefined) {
    const q = { id };
    if (toDate) q.date = { $lt: toDate };
    const cursor = await this._transactions.find(q);
    const dbActs =  await cursor.sort('_id', 1).toArray();
    return dbActs.reduce((acc, a) => acc + a.amount, 0);
  }
  
  async _account(id) {
    const query =  { _id: id, };
    const dbAccount = await this._accounts.findOne(query);
    if (dbAccount) {
      const account = { ...dbAccount };
      account.id = id; delete account._id;
      return account;
    }
    else {
      const message = `no account for ID ${id}`;
      return { errors: [ { message, options: { code: 'NOT_FOUND' } } ], };
    }
  }


  // Returns a unique, difficult to guess id.
  async _nextId() {
    const query = { _id: NEXT_ID_KEY };
    const update = { $inc: { [NEXT_ID_KEY]: 1 } };
    const options = { upsert: true, returnDocument: 'after' };
    const ret =  await this._idBase.findOneAndUpdate(query, update, options);
    const seq = ret.value[NEXT_ID_KEY];
    return String(seq) + '_'
      + Math.random().toString().substring(2, 2 + RAND_LEN);
  }

  async _clear() {
    try {
      for (const c of COLLECTIONS) {
	await this[c].deleteMany({});
      }
      return {};
    }
    catch (err) {
      const message = `cannot clear db: ${err}`;
      return { errors: [ { message, options: { code: 'DB'} } ] };
    }
  }
 

  
  
}

const COLLECTIONS = [ '_accounts', '_transactions', '_idBase' ];

const NEXT_ID_KEY = '_nextIdBase';

const RAND_LEN = 2;