const { supabase } = require('./supabase');
const fs = require('fs').promises;
const path = require('path');

class TranscriptionService {
  constructor() {
    this.localFile = path.join(__dirname, '..', 'transcriptions.json');
  }

  async saveTranscription(data) {
    // If Supabase is configured, use it
    if (supabase) {
      try {
        const { data: result, error } = await supabase
          .from('transcriptions')
          .upsert({
            call_sid: data.callSid,
            recording_sid: data.recordingSid || null,
            from_number: data.fromNumber || data.from || null,
            to_number: data.toNumber || data.to || null,
            customer_name: data.customerName || null,
            customer_email: data.customerEmail || null,
            customer_phone: data.customerPhone || null,
            duration: data.duration || null,
            status: data.status || 'pending',
            recording_url: data.recordingUrl || null,
            transcript_id: data.transcriptId || null,
            transcript_text: data.transcript || null,
            transcript_status: data.transcriptStatus || 'pending'
          }, {
            onConflict: 'call_sid'
          });

        if (error) {
          console.error('Supabase error:', error);
          // Fall back to local storage
          return this.saveToLocalFile(data);
        }

        return result;
      } catch (err) {
        console.error('Error saving to Supabase:', err);
        // Fall back to local storage
        return this.saveToLocalFile(data);
      }
    } else {
      // Use local file storage as fallback
      return this.saveToLocalFile(data);
    }
  }

  async getTranscriptions() {
    // If Supabase is configured, use it
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('transcriptions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          // Fall back to local storage
          return this.getFromLocalFile();
        }

        // Convert to expected format
        const transcriptions = {};
        data.forEach(item => {
          transcriptions[item.call_sid] = {
            callSid: item.call_sid,
            recordingSid: item.recording_sid,
            from: item.from_number,
            to: item.to_number,
            customerName: item.customer_name,
            customerEmail: item.customer_email,
            customerPhone: item.customer_phone,
            duration: item.duration,
            status: item.status,
            recordingUrl: item.recording_url,
            transcriptId: item.transcript_id,
            transcript: item.transcript_text,
            transcriptStatus: item.transcript_status,
            timestamp: item.created_at
          };
        });

        return transcriptions;
      } catch (err) {
        console.error('Error fetching from Supabase:', err);
        // Fall back to local storage
        return this.getFromLocalFile();
      }
    } else {
      // Use local file storage as fallback
      return this.getFromLocalFile();
    }
  }

  async getTranscription(callSid) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('transcriptions')
          .select('*')
          .eq('call_sid', callSid)
          .single();

        if (error) {
          console.error('Supabase error:', error);
          // Fall back to local storage
          const localData = await this.getFromLocalFile();
          return localData[callSid] || null;
        }

        if (!data) return null;

        return {
          callSid: data.call_sid,
          recordingSid: data.recording_sid,
          from: data.from_number,
          to: data.to_number,
          customerName: data.customer_name,
          customerEmail: data.customer_email,
          customerPhone: data.customer_phone,
          duration: data.duration,
          status: data.status,
          recordingUrl: data.recording_url,
          transcriptId: data.transcript_id,
          transcript: data.transcript_text,
          transcriptStatus: data.transcript_status,
          timestamp: data.created_at
        };
      } catch (err) {
        console.error('Error fetching from Supabase:', err);
        // Fall back to local storage
        const localData = await this.getFromLocalFile();
        return localData[callSid] || null;
      }
    } else {
      const localData = await this.getFromLocalFile();
      return localData[callSid] || null;
    }
  }

  // Local file storage methods (fallback)
  async saveToLocalFile(data) {
    try {
      let transcriptions = {};

      try {
        const content = await fs.readFile(this.localFile, 'utf8');
        transcriptions = JSON.parse(content);
      } catch (err) {
        // File doesn't exist yet, start with empty object
      }

      transcriptions[data.callSid] = {
        ...transcriptions[data.callSid],
        ...data,
        timestamp: new Date().toISOString()
      };

      await fs.writeFile(this.localFile, JSON.stringify(transcriptions, null, 2));
      return transcriptions[data.callSid];
    } catch (err) {
      console.error('Error saving to local file:', err);
      throw err;
    }
  }

  async getFromLocalFile() {
    try {
      const content = await fs.readFile(this.localFile, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      // File doesn't exist yet
      return {};
    }
  }
}

module.exports = new TranscriptionService();