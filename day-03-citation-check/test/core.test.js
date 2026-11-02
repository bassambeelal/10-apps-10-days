// Run: node --test day-03-citation-check/test/core.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../app/cite-core.js');
const F = require('./fixtures.js');

test('splitting lists the way people paste them', () => {
  assert.equal(C.split('1. LeCun, Y. (2015). Deep learning. Nature.\n2. He, K. (2016). Deep residual learning\nfor image recognition. CVPR.').length, 2);
  assert.equal(C.split('[1] A. Author, "A first long title here," J. Things, 2020.\n[2] B. Author, "A second long title," J. Stuff, 2021.').length, 2);
  assert.equal(C.split('Author A (2020) The first title of a paper. Journal.\n\nAuthor B (2021) The second title of a paper. Journal.').length, 2);
  const wrapped = C.split('Smith, J. (2020). A rather long title that wraps onto\nthe next line in the copied text. Journal of Things, 3, 1-9.\nJones, K. (2019). Another paper with a different title. Proceedings.');
  assert.equal(wrapped.length, 2);
  assert.match(wrapped[0], /wraps onto the next line/);
  const bib = C.split('@article{lecun2015,\n  author = {LeCun, Yann and Bengio, Yoshua},\n  title = {Deep learning},\n  journal = {Nature},\n  year = {2015},\n  doi = {10.1038/nature14539}\n}');
  assert.equal(bib.length, 1);
  assert.match(bib[0], /Deep learning/);
  assert.equal(C.findDoi(bib[0]), '10.1038/nature14539');
});

test('DOIs, including ones with brackets', () => {
  assert.equal(C.findDoi('Nature 521, 436–444. https://doi.org/10.1038/nature14539.'), '10.1038/nature14539');
  assert.equal(C.findDoi('Lancet. doi:10.1016/S0140-6736(20)30183-5.'), '10.1016/s0140-6736(20)30183-5');
  assert.equal(C.findDoi('(see 10.1145/3351095.3372828)'), '10.1145/3351095.3372828');
  assert.equal(C.findDoi('No identifier here, 2020.'), null);
});

test('court citations are recognised and linked', () => {
  const l = C.legal('Mata v. Avianca, Inc., 678 F. Supp. 3d 443 (S.D.N.Y. 2023).');
  assert.equal(l.citation, '678 F. Supp. 3d 443');
  assert.equal(l.url, 'https://www.courtlistener.com/c/F.%20Supp.%203d/678/443/');
  assert.equal(C.legal('Varghese v. China Southern Airlines Co., 925 F.3d 1339 (11th Cir. 2019).').citation, '925 F.3d 1339');
  assert.equal(C.legal('Brown v. Board of Education, 347 U.S. 483 (1954)').citation, '347 U.S. 483');
  assert.equal(C.legal('LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521, 436.'), null);
});

test('matching: found, close and not found', () => {
  const rec = C.fromCrossref(F.records.deepLearning);
  assert.equal(C.assess('LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. Nature, 521(7553), 436–444.', rec).status, 'found');
  const wrongYear = C.assess('LeCun, Y., Bengio, Y., & Hinton, G. (2019). Deep learning. Nature, 521, 436.', rec);
  assert.equal(wrongYear.status, 'close');
  assert.match(wrongYear.diffs[0].text, /You wrote 2019; the record says 2015/);
  const wrongPaper = C.assess('Hinton, G. (2015). Capsule networks for vision. Nature, 521, 436.', rec);
  assert.equal(wrongPaper.status, 'none');
  const dna = C.fromCrossref(F.records.dna);
  assert.equal(C.assess('Watson JD, Crick FHC. Molecular structure of nucleic acids; a structure for deoxyribose nucleic acid. Nature. 1953;171(4356):737-8.', dna).status, 'found');
  const fake = 'Smith, J., & Patel, R. (2021). Neural pathways of trust in algorithmic hiring. Journal of Applied Cognitive Systems, 14(3), 211–229.';
  const top = C.best(fake, [F.records.hiringBias, F.records.trust].map(C.fromCrossref));
  assert.equal(top.a.status, 'none');
});

test('OpenAlex records read the same way', () => {
  const rec = C.fromOpenAlex(F.records.openAlexBook);
  assert.equal(rec.authors[0].family, 'Kahneman');
  assert.equal(C.assess('Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.', rec).status, 'found');
  assert.equal(C.authorsText(C.fromCrossref(F.records.resnet)), 'K He, X Zhang, S Ren and 1 more');
});
