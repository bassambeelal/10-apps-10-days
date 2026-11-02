// Records in the shapes Crossref's REST API and OpenAlex's API return (message.items / results).
// The real papers are well known; the made-up references below have no record.
const deepLearning = { DOI: '10.1038/nature14539', title: ['Deep learning'], author: [{ given: 'Yann', family: 'LeCun' }, { given: 'Yoshua', family: 'Bengio' }, { given: 'Geoffrey', family: 'Hinton' }], issued: { 'date-parts': [[2015, 5, 27]] }, 'container-title': ['Nature'], type: 'journal-article', score: 42 };
const dna = { DOI: '10.1038/171737a0', title: ['Molecular Structure of Nucleic Acids: A Structure for Deoxyribose Nucleic Acid'], author: [{ given: 'J. D.', family: 'WATSON' }, { given: 'F. H. C.', family: 'CRICK' }], issued: { 'date-parts': [[1953, 4]] }, 'container-title': ['Nature'], type: 'journal-article', score: 60 };
const resnet = { DOI: '10.1109/cvpr.2016.90', title: ['Deep Residual Learning for Image Recognition'], author: [{ given: 'Kaiming', family: 'He' }, { given: 'Xiangyu', family: 'Zhang' }, { given: 'Shaoqing', family: 'Ren' }, { given: 'Jian', family: 'Sun' }], issued: { 'date-parts': [[2016, 6]] }, 'container-title': ['2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)'], type: 'proceedings-article', score: 55 };
const trust = { DOI: '10.1518/hfes.46.1.50_30392', title: ['Trust in Automation: Designing for Appropriate Reliance'], author: [{ given: 'John D.', family: 'Lee' }, { given: 'Katrina A.', family: 'See' }], issued: { 'date-parts': [[2004, 3]] }, 'container-title': ['Human Factors'], type: 'journal-article', score: 18 };
const hiringBias = { DOI: '10.1145/3351095.3372828', title: ['Mitigating bias in algorithmic hiring'], author: [{ given: 'Manish', family: 'Raghavan' }, { given: 'Solon', family: 'Barocas' }], issued: { 'date-parts': [[2020, 1, 27]] }, 'container-title': ['Proceedings of the 2020 Conference on Fairness, Accountability, and Transparency'], type: 'proceedings-article', score: 20 };
const openAlexBook = { id: 'https://openalex.org/W2045435533', doi: null, display_name: 'Thinking, Fast and Slow', publication_year: 2011, authorships: [{ author: { display_name: 'Daniel Kahneman' } }], primary_location: { source: { display_name: 'Farrar, Straus and Giroux' } }, type: 'book' };

module.exports = {
  works: { '10.1038/nature14539': deepLearning, '10.1038/171737a0': dna, '10.1109/cvpr.2016.90': resnet },
  search: [
    [/watson|nucleic/i, [dna, trust]],
    [/residual/i, [resnet, deepLearning]],
    [/lecun|deep learning/i, [deepLearning, resnet]],
    [/trust|algorithmic hiring|neural pathways|recruit/i, [hiringBias, trust]],
    [/.*/, [trust]],
  ],
  openalex: [
    [/kahneman|thinking/i, [openAlexBook]],
    [/.*/, []],
  ],
  records: { deepLearning, dna, resnet, trust, hiringBias, openAlexBook },
};
