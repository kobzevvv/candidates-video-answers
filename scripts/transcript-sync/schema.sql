-- Database schema for storing Hireflix transcripts

-- Main interviews table
CREATE TABLE IF NOT EXISTS interviews (
    id VARCHAR(255) PRIMARY KEY,
    candidate_email VARCHAR(255),
    candidate_first_name VARCHAR(255),
    candidate_last_name VARCHAR(255),
    position_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS interview_questions (
    id VARCHAR(255) PRIMARY KEY,
    interview_id VARCHAR(255) REFERENCES interviews(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    question_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Answers and transcripts table
CREATE TABLE IF NOT EXISTS interview_answers (
    id VARCHAR(255) PRIMARY KEY,
    question_id VARCHAR(255) REFERENCES interview_questions(id) ON DELETE CASCADE,
    interview_id VARCHAR(255) REFERENCES interviews(id) ON DELETE CASCADE,
    video_url TEXT,
    transcription_text TEXT,
    transcription_language VARCHAR(10),
    transcription_words JSONB, -- Store word-level timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_interviews_position_id ON interviews(position_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at);
CREATE INDEX IF NOT EXISTS idx_interview_questions_interview_id ON interview_questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_interview_id ON interview_answers(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_question_id ON interview_answers(question_id);

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_answers_updated_at BEFORE UPDATE ON interview_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();