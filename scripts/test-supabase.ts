#!/usr/bin/env npx tsx
/**
 * Test Supabase Connection
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('🔗 Testing Supabase connection...');
console.log('   URL:', url ? url.substring(0, 40) + '...' : 'NOT SET');
console.log('   Key:', key ? 'SET (' + key.substring(0, 20) + '...)' : 'NOT SET');

if (!url || !key) {
  console.log('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  try {
    // Test knowledge_items table
    const { data, error } = await supabase
      .from('knowledge_items')
      .select('id')
      .limit(1);

    if (error) {
      console.log('❌ Query failed:', error.message);
      process.exit(1);
    }

    console.log('✅ Connection successful!');
    console.log('📊 knowledge_items table accessible');

    // Test influencers table
    const { error: infError } = await supabase
      .from('influencers')
      .select('id')
      .limit(1);

    if (infError) {
      console.log('⚠️  influencers table error:', infError.message);
    } else {
      console.log('📊 influencers table accessible');
    }

    console.log('\n✅ Supabase setup complete!');
  } catch (err) {
    console.log('❌ Error:', err);
    process.exit(1);
  }
}

test();
