module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['test/bdd/steps/**/*.ts'],
    paths: ['test/bdd/features/**/*.feature'],
    format: ['progress', 'html:coverage/bdd-report.html'],
  },
};
