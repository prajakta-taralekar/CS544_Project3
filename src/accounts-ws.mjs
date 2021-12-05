import Path from 'path'
import { fileURLToPath } from 'url'

import { DEFAULT_COUNT } from './defs.mjs'

import cors from 'cors'
import express from 'express'
//HTTP status codes
import STATUS from 'http-status'
import assert from 'assert'
import bodyParser from 'body-parser'

export default function serve(model, base = '') {
  const app = express()
  cdThisDir()
  app.locals.model = model
  app.locals.base = base
  app.use(express.static('statics'))
  setupRoutes(app)
  return app
}

/** set up mapping between URL routes and handlers */
function setupRoutes(app) {
  const base = app.locals.base
  app.use(cors())
  app.use(bodyParser.json())

  //TODO: add routes as necessary
  app.use()
  app.post('/account', createAccount)
  app.get('/account/:accountId', getAccountById)
  app.get('/accounts', getAccounts)
  app.post('/accounts/:accountId/transactions', postTransactions)
  app.get('/account/:accountId/transactions', getTransactionsByAccountId)
  app.get(
    '/account/:accountId/transactions/:actId',
    getTransactionByTransactionId
  )
  app.get(
    '/accounts/:accountId/statements/fromDate/toDate',
    getAccountStatementByIdFromDataToDate
  )

  //must be last
  app.use(do404(app))
  app.use(doErrors(app))
}

function getAccountStatementByIdFromDataToDate(app) {
  const model = app.locals.model
  return async function (req, res) {
    try {
      const { accountId, fromDate, toDate } = req.params
      if (!accountId || fromDate || toDate) {
        const result = {
          status: ERROR_MAP.BAD_REQUEST,
          errors: [
            {
              code: 'Error with request',
              message: 'all parameters was not passed to the request'
            }
          ]
        }
        res.status(ERROR_MAP.BAD_REQUEST).json(result)
      } else {
        const statements = await model.statement({
          ...req.params,
          id: accountId
        })
        if (statement.errors) throw statements
        if (!statements) {
          resp = addSelfLinks(req, { ...query, id: accountId }, 'id')
        } else {
          resp = addPagingLinks(req, statements)
        }
        res.status(SUCCESS_MAP.SUCCESS).json(resp)
      }
    } catch (err) {
      const mapped = mapResultErrors(err)
      res.status(mapped.status).json(mapped)
    }
  }
}

function postTransactions(app) {
  const model = app.locals.model
  return async function (req, res) {
    try {
      const { accountId } = req.params
      if (!accountId) {
        const result = {
          status: ERROR_MAP.BAD_REQUEST,
          errors: [
            {
              code: 'Error with request',
              message: 'account id id was not passed to the body of the request'
            }
          ]
        }
        res.status(ERROR_MAP.BAD_REQUEST).json(result)
      } else {
        const id = await model.newAct({ ...req.body, id: accountId })
        if (id?.errors) throw id
        res.append('Location', `${requestUrl(req)}/${id}`)
        res.status(SUCCESS_MAP.CREATED).json({})
      }
    } catch (err) {
      const mapped = mapResultErrors(err)
      res.status(mapped.status).json(mapped)
    }
  }
}

function createAccount(app) {
  const model = app.locals.model
  return async function (req, res) {
    try {
      const { holderId } = req.body || 0
      if (!holderId) {
        const result = {
          status: ERROR_MAP.BAD_REQUEST,
          errors: [
            {
              code: 'Error with request',
              message: 'Holder id was not passed to the body of the request'
            }
          ]
        }
        res.status(ERROR_MAP.BAD_REQUEST).json(result)
      } else {
        const accountId = await model.newAccount({ holderId })
        if (accountId?.errors) throw accountId
        res.append('Location', `${requestUrl(req)}/${accountId}`)
        res.status(SUCCESS_MAP.CREATED).json({})
      }
    } catch (err) {
      const mapped = mapResultErrors(err)
      res.status(mapped.status).json(mapped)
    }
  }
}

function getAccountById(app) {
  const model = app.locals.model
  return async function (req, res) {
    try {
      const { accountId } = req.params || 0
      if (!accountId) {
        const result = {
          status: ERROR_MAP.BAD_REQUEST,
          errors: [
            {
              code: 'Error with request',
              message: 'Holder id was not passed to the body of the request'
            }
          ]
        }
        res.status(ERROR_MAP.BAD_REQUEST).json(result)
      } else {
        const account = await model.searchAccounts({ id: accountId })
        if (account.errors) throw account
        const result = addSelfLinks(req, { ...account, id: accountId }, 'id')
        res.status(SUCCESS_MAP.SUCCESS).json(result)
      }
    } catch (err) {
      const mapped = mapResultErrors(err)
      res.status(mapped.status).json(mapped)
    }
  }
}
function getTransactionByTransactionId(app) {
  const model = app.locals.model
  return async function (req, res) {
    try {
      const { accountId, actId: transactionId } = req.params || 0
      if (!accountId || !transactionId) {
        const result = {
          status: ERROR_MAP.BAD_REQUEST,
          errors: [
            {
              code: 'Error with request',
              message:
                'Request id and transaction id was not passed to the body of the request'
            }
          ]
        }
        res.status(ERROR_MAP.BAD_REQUEST).json(result)
      } else {
        const transaction = await model.query({
          ...params,
          actId: transactionId,
          id: accountId
        })
        if (transaction.errors) throw transaction
        const result = addSelfLinks(req, { ...transaction }, 'id')
        res.status(SUCCESS_MAP.SUCCESS).json(result)
      }
    } catch (err) {
      const mapped = mapResultErrors(err)
      res.status(mapped.status).json(mapped)
    }
  }
}

function getTransactionsByAccountId(app) {
  const model = app.locals.model
  return async function (req, res) {
    try {
      const { accountId } = req.params || {}
      const query = req.query
      if (!accountId) {
        const result = {
          status: ERROR_MAP.BAD_REQUEST,
          errors: [
            {
              code: 'Error with request',
              message: 'Holder id was not passed to the body of the request'
            }
          ]
        }
        res.status(ERROR_MAP.BAD_REQUEST).json(result)
      } else {
        const transactions = await model.query({ ...query, id: accountId })
        if (transactions.errors) throw transactions
        if (!transactions) {
          resp = addSelfLinks(req, { ...query, id: accountId }, 'id')
        } else {
          resp = addPagingLinks(req, transactions)
        }
        res.status(SUCCESS_MAP.SUCCESS).json(resp)
      }
    } catch (err) {
      const mapped = mapResultErrors(err)
      res.status(mapped.status).json(mapped)
    }
  }
}

function getAccounts(app) {
  const model = app.locals.model
  return async function (req, res) {
    try {
      const query = req.query
      const results = await model.searchAccounts(query)
      if (results.errors) throw results
      let resp
      if (!results) {
        resp = addSelfLinks(req, { ...query })
      } else {
        resp = addPagingLinks(req, results, (sefId = query?.id))
      }
      res.status(SUCCESS_MAP.SUCCESS).json(resp)
    } catch (err) {
      const mapped = mapResultErrors(err)
      res.status(mapped.status).json(mapped)
    }
  }
}

/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function (req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`
    const result = {
      status: STATUS.NOT_FOUND,
      errors: [{ code: 'NOT_FOUND', message }]
    }
    res.status(STATUS.NOT_FOUND).json(result)
  }
}

/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */
function doErrors(app) {
  return async function (err, req, res, next) {
    const result = {
      status: STATUS.INTERNAL_SERVER_ERROR,
      errors: [{ code: 'SERVER_ERROR', message: err.message }]
    }
    res.status(STATUS.INTERNAL_SERVER_ERROR).json(result)
    console.error(result.errors)
  }
}

/************************* HATEOAS Utilities ***************************/

/** Return original URL for req (excluding query params) */
function requestUrl(req) {
  const url = req.originalUrl.replace(/\/?(\?.*)?$/, '')
  return `${req.protocol}://${req.get('host')}${url}`
}

/** Return req URL with query params appended */
function queryUrl(req, query = {}) {
  const url = new URL(requestUrl(req))
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.href
}

/** Return object containing { result: obj, links: [{ rel: 'self',
 *  name: 'self', href }] } where href is req-url + suffix /obj[id] if
 *  id.
 */
function addSelfLinks(req, obj, id = undefined) {
  const baseUrl = requestUrl(req)
  const href = id ? `${baseUrl}/${obj[id]}` : baseUrl
  const links = [{ rel: 'self', name: 'self', href }]
  return { result: obj, links: links }
}

/** Wrap results in paging links.  Specifically, return
 *  { result, links: [self, next, prev] } where result
 *  is req-count prefix of results with each individual
 *  result wrapped in a self-link. self will always
 *  be present, next/prev are present if there
 *  are possibly more/earlier results.
 */
function addPagingLinks(req, results, selfId = undefined) {
  const links = [{ rel: 'self', name: 'self', href: queryUrl(req, req.query) }]
  const count = Number(req.query?.count ?? DEFAULT_COUNT)
  const nResults = results.length //may be 1 more than count
  const next = pagingUrl(req, nResults, +1)
  if (next) links.push({ rel: 'next', name: 'next', href: next })
  const prev = pagingUrl(req, nResults, -1)
  if (prev) links.push({ rel: 'prev', name: 'prev', href: prev })
  const results1 = results
    .slice(0, count)
    .map(obj => addSelfLinks(req, obj, selfId))
  return { result: results1, links: links }
}

/** Return paging url (dir == +1: next; dif == -1: prev);
 *  returns null if no paging link necessary.
 *  (no prev if index == 0, no next if nResults <= count).
 */
//index and count have been validated
function pagingUrl(req, nResults, dir) {
  const q = req.query
  const index = Number(q?.index ?? 0)
  const count = Number(q?.count ?? DEFAULT_COUNT)
  const index1 = index + dir * count < 0 ? 0 : index + dir * count
  const query1 = Object.assign({}, q, { index: index1 })
  return (dir > 0 && nResults <= count) || (dir < 0 && index1 === index)
    ? null
    : queryUrl(req, query1)
}

/*************************** Mapping Errors ****************************/

//map from domain errors to HTTP status codes.  If not mentioned in
//this map, an unknown error will have HTTP status BAD_REQUEST.
const ERROR_MAP = {
  EXISTS: STATUS.CONFLICT,
  NOT_FOUND: STATUS.NOT_FOUND,
  DB: STATUS.INTERNAL_SERVER_ERROR,
  INTERNAL: STATUS.INTERNAL_SERVER_ERROR,
  BAD_REQUEST: STATUS.BAD_REQUEST,
  NOT_FOUND: STATUS.NOT_FOUND
}
const SUCCESS_MAP = {
  CREATED: STATUS.CREATED,
  SUCCESS: STATUS.OK
}
/** Return first status corresponding to first option.code in
 *  appErrors, but SERVER_ERROR dominates other statuses.  Returns
 *  BAD_REQUEST if no code found.
 */
function getHttpStatus(appErrors) {
  let status = null
  for (const appError of appErrors) {
    const errStatus = ERROR_MAP[appError.options?.code]
    if (!status) status = errStatus
    if (errStatus === STATUS.INTERNAL_SERVER_ERROR) status = errStatus
  }
  return status ?? STATUS.BAD_REQUEST
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapResultErrors(err) {
  const errors = err.errors || [
    { message: err.message, options: { code: 'INTERNAL' } }
  ]
  const status = getHttpStatus(errors)
  if (status === STATUS.INTERNAL_SERVER_ERROR) {
    console.error(err.val.toString())
  }
  return { status, errors }
}

/**************************** Misc Utilities ***************************/

function cdThisDir() {
  try {

    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    console.log("dir:", __dirname);
    process.chdir(__dirname)


  } catch (err) {
    console.error(`cannot cd to this dir: ${err}`)
    process.exit(1)
  }
}
