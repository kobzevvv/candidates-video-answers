CREATE VIEW 
    interview_answers_datamart AS

WITH add_questions AS (
    SELECT 
        answer.id AS answer_id,
        answer.video_url AS video_url,
        answer.transcription_text AS transcription_text,
        answer.transcription_language AS transcription_language,
        answer.transcription_words AS transcription_words,
        answer.created_at AS answer_created_at,
        answer.updated_at AS answer_updated_at,
        question.id AS question_id,
        question.title AS question_title,
        question.description AS question_description,
        question.question_order AS question_order,
        question.created_at AS question_created_at,
        question.interview_id AS interview_id
    FROM public.interview_answers AS answer
    LEFT JOIN public.interview_questions AS question ON answer.question_id = question.id
),

add_interviews AS (
    SELECT 
        add_questions.*,
        interview.candidate_email AS candidate_email,
        interview.candidate_first_name AS candidate_first_name,
        interview.candidate_last_name AS candidate_last_name,
        interview.status AS interview_status,
        interview.created_at AS interview_created_at,
        interview.updated_at AS interview_updated_at,
        interview.position_id AS position_id
    FROM add_questions AS add_questions
    LEFT JOIN public.interviews AS interview ON add_questions.interview_id = interview.id
),

add_positions AS (
    SELECT 
        add_interviews.*,
        position.name AS position_name,
        position.archived AS position_archived,
        position.first_seen AS position_first_seen,
        position.last_seen AS position_last_seen,
        position.created_at AS position_created_at,
        position.updated_at AS position_updated_at
    FROM add_interviews AS add_interviews
    LEFT JOIN public.position_tracking AS position ON add_interviews.position_id = position.id
)

-- final
    SELECT * FROM add_positions;