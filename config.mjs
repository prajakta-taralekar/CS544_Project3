const CERT_BASE = `${process.env.HOME}/tmp/localhost-certs`;

export default {

  db: {
    url:  'mongodb://localhost:27017/accounts',
  },

  ws: {
    port: 2345,
    base: '/accounts',
  },

  https: {
    certPath: `${CERT_BASE}/localhost.crt`,
    keyPath: `${CERT_BASE}/localhost.key`,
  },
  

};