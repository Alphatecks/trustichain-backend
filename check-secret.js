const { Wallet } = require('xrpl');

const secret = 'sEdTZ5kTvAA4NAQnuwDbNt7TV58LEjj';

try {
  const wallet = Wallet.fromSeed(secret);
  console.log('Valid secret! Address:', wallet.address);
} catch (e) {
  console.log('Invalid secret:', e.message);
}
