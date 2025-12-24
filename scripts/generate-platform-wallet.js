/**
 * Generate Platform Wallet Script
 * 
 * This script generates a new XRPL wallet that can be used as your platform wallet.
 * The seed generated here is what you need to put in XRPL_PLATFORM_SECRET.
 * 
 * Run: node scripts/generate-platform-wallet.js
 */

const { Wallet } = require('xrpl');

console.log('🔐 Generating Platform Wallet...\n');

try {
  // Generate a new XRPL wallet
  const wallet = Wallet.generate();
  
  console.log('✅ Platform Wallet Generated Successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 COPY THESE VALUES TO RENDER ENVIRONMENT VARIABLES:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('XRPL_PLATFORM_ADDRESS=' + wallet.address);
  console.log('\nXRPL_PLATFORM_SECRET=' + wallet.seed);
  console.log('\n(Secret length: ' + wallet.seed.length + ' characters, starts with "s")');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  IMPORTANT SECURITY NOTES:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Keep the SECRET safe - anyone with it can control the wallet');
  console.log('2. Fund this wallet address with XRP before using it');
  console.log('3. Copy the values EXACTLY - no spaces, no quotes');
  console.log('4. The SECRET starts with "s" and is what Wallet.fromSeed() needs');
  console.log('5. This is NOT the same as Xaman recovery codes\n');
  
  console.log('💡 Next Steps:');
  console.log('   1. Copy XRPL_PLATFORM_ADDRESS and XRPL_PLATFORM_SECRET above');
  console.log('   2. Go to Render → Your Service → Environment');
  console.log('   3. Paste these values (no spaces before/after)');
  console.log('   4. Fund the wallet address with XRP');
  console.log('   5. Redeploy your service\n');
  
} catch (error) {
  console.error('❌ Error generating wallet:', error.message);
  process.exit(1);
}

