require('dotenv').config();
const { supabase } = require('./lib/supabase');
const fs = require('fs');
const path = require('path');

async function migrateTranscriptions() {
  console.log('🚀 Starting migration to Supabase...');

  // Read local transcriptions
  const transcriptionsFile = path.join(__dirname, 'transcriptions.json');

  if (!fs.existsSync(transcriptionsFile)) {
    console.log('No local transcriptions found');
    return;
  }

  const localData = JSON.parse(fs.readFileSync(transcriptionsFile, 'utf8'));

  console.log(`Found ${Object.keys(localData).length} transcriptions to migrate`);

  // Migrate each transcription
  for (const [recordingSid, data] of Object.entries(localData)) {
    try {
      const transcriptionData = {
        call_sid: data.callSid || recordingSid,
        recording_sid: recordingSid,
        from_number: data.from || null,
        to_number: data.to || null,
        customer_name: data.customerName || null,
        customer_email: data.customerEmail || null,
        customer_phone: data.customerPhone || null,
        duration: data.duration || null,
        status: data.status || 'completed',
        recording_url: data.recordingUrl || null,
        transcript_id: data.transcriptId || null,
        transcript_text: typeof data === 'string' ? data : (data.text || data.transcript || JSON.stringify(data)),
        transcript_status: data.transcriptStatus || 'completed',
        created_at: data.timestamp || new Date().toISOString()
      };

      if (!supabase) {
        console.log('Supabase not configured, skipping...');
        continue;
      }

      const { error } = await supabase
        .from('transcriptions')
        .upsert(transcriptionData, {
          onConflict: 'recording_sid'
        });

      if (error) {
        console.error(`Error migrating ${recordingSid}:`, error);
      } else {
        console.log(`✅ Migrated ${recordingSid}`);
      }
    } catch (err) {
      console.error(`Failed to migrate ${recordingSid}:`, err);
    }
  }

  console.log('✨ Migration complete!');
}

// Run migration
migrateTranscriptions().catch(console.error);