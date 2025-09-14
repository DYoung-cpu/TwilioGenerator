-- Create transcriptions table
CREATE TABLE IF NOT EXISTS transcriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid VARCHAR(255) UNIQUE NOT NULL,
  recording_sid VARCHAR(255) UNIQUE,
  from_number VARCHAR(50),
  to_number VARCHAR(50),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  duration INTEGER,
  status VARCHAR(50),
  recording_url TEXT,
  transcript_id VARCHAR(255),
  transcript_text TEXT,
  transcript_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transcriptions_call_sid ON transcriptions(call_sid);
CREATE INDEX IF NOT EXISTS idx_transcriptions_recording_sid ON transcriptions(recording_sid);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transcriptions_updated_at BEFORE UPDATE ON transcriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();