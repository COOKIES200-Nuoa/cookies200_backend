// test/sample/calculator.test.js
const calculator = require('../../src/sample/calculator');

test('adds 1 + 2 to equal 3', () => {
  expect(calculator.add(1, 2)).toBe(3);
});

test('subtracts 2 from 5 to equal 3', () => {
  expect(calculator.subtract(5, 2)).toBe(3);
});