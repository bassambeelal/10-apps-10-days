// Answers Crossref and OpenAlex from Citation Check's test fixtures, in their documented response shapes,
// for the demo video (the recording machine can't reach the live services). A short delay per answer lets
// the checking state show, as it would on a real connection.
const F = require('../../day-03-citation-check/test/fixtures.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const delay = () => wait(260 + ((n++ * 137) % 420));

module.exports = async function (context) {
  await context.route('https://api.crossref.org/**', async (route) => {
    await delay();
    const u = new URL(route.request().url());
    const m = u.pathname.match(/^\/works\/(.+)$/);
    if (m) {
      const item = F.works[decodeURIComponent(m[1]).toLowerCase()];
      return item ? route.fulfill({ json: { status: 'ok', 'message-type': 'work', message: item } }) : route.fulfill({ status: 404, body: 'Resource not found.' });
    }
    const q = u.searchParams.get('query.bibliographic') || '';
    const items = F.search.find(([re]) => re.test(q))[1];
    return route.fulfill({ json: { status: 'ok', 'message-type': 'work-list', message: { items, 'total-results': items.length } } });
  });
  await context.route('https://api.openalex.org/**', async (route) => {
    await delay();
    const u = new URL(route.request().url());
    if (/^\/works\/doi:/.test(u.pathname)) return route.fulfill({ status: 404, json: { error: 'Not found' } });
    const q = u.searchParams.get('search') || '';
    const results = F.openalex.find(([re]) => re.test(q))[1];
    return route.fulfill({ json: { meta: { count: results.length }, results } });
  });
};
